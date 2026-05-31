import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdminAuth } from "@/lib/auth-check";
import { PARTNER_TYPES } from "@/lib/entitlements";
import {
  createPartnerDomain,
  listPartnerDomains,
  normalizeDomain,
} from "@/lib/partner-domains";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

const DOMAIN_REGEX =
  /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Normalise + valide segment / partnerType (sous-type partenaire). */
function normalizeSegment(raw: unknown): "employeur" | "partenaire" {
  return raw === "employeur" ? "employeur" : "partenaire";
}

/**
 * partnerType n'a de sens que pour un segment "partenaire" et doit appartenir
 * à PARTNER_TYPES. Sinon → null.
 */
function normalizePartnerType(
  raw: unknown,
  segment: "employeur" | "partenaire",
): string | null {
  if (segment !== "partenaire") return null;
  if (typeof raw !== "string") return null;
  return (PARTNER_TYPES as readonly string[]).includes(raw) ? raw : null;
}

export async function GET() {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  try {
    const items = await listPartnerDomains();
    return NextResponse.json({ items }, { headers: jsonHeaders });
  } catch (error) {
    console.error("Error listing partner domains:", error);
    return NextResponse.json(
      { error: "Failed to list partner domains" },
      { status: 500, headers: jsonHeaders },
    );
  }
}

export async function POST(req: NextRequest) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: jsonHeaders },
    );
  }

  const input = body as {
    kind?: string;
    domain?: string;
    domains?: string[];
    email?: string | null;
    segment?: string;
    partnerType?: string | null;
    organizationName?: string;
    notes?: string | null;
    isTest?: boolean;
  };

  const organizationName = input.organizationName?.trim() ?? "";
  if (!organizationName) {
    return NextResponse.json(
      { error: "Le nom de l'organisation est requis" },
      { status: 400, headers: jsonHeaders },
    );
  }

  const kind = input.kind === "email" ? "email" : "domain";
  const segment = normalizeSegment(input.segment);
  const partnerType = normalizePartnerType(input.partnerType, segment);

  /* ----------------------------------------------------------------- */
  /*  kind = "email" → une seule entrée email (domaine optionnel)        */
  /* ----------------------------------------------------------------- */
  if (kind === "email") {
    const email = (input.email ?? "").trim().toLowerCase();
    if (!email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: "Adresse email invalide (ex: prenom.nom@gmail.com)" },
        { status: 400, headers: jsonHeaders },
      );
    }

    // Le domaine reste optionnel pour une entrée email ; s'il est fourni on le
    // valide quand même (cohérence avec les entrées kind="domain").
    let domain: string | undefined;
    const rawDomain = normalizeDomain(input.domain ?? "");
    if (rawDomain) {
      if (!DOMAIN_REGEX.test(rawDomain)) {
        return NextResponse.json(
          { error: "Domaine invalide (ex: cpas.brussels)" },
          { status: 400, headers: jsonHeaders },
        );
      }
      domain = rawDomain;
    }

    try {
      const item = await createPartnerDomain({
        kind: "email",
        email,
        domain,
        segment,
        partnerType,
        organizationName,
        notes: input.notes ?? null,
        isTest: input.isTest ?? false,
        createdBy: authCheck.user.id,
      });
      return NextResponse.json(
        { items: [item], item },
        { headers: jsonHeaders },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return NextResponse.json(
          { error: `${email} : déjà enregistré` },
          { status: 409, headers: jsonHeaders },
        );
      }
      console.error("Error creating partner email:", error);
      return NextResponse.json(
        { error: "Erreur serveur" },
        { status: 500, headers: jsonHeaders },
      );
    }
  }

  /* ----------------------------------------------------------------- */
  /*  kind = "domain" → une ou plusieurs entrées domaine (comportement   */
  /*  batch existant conservé)                                           */
  /* ----------------------------------------------------------------- */
  const rawList = (
    input.domains?.length ? input.domains : [input.domain ?? ""]
  )
    .map((d) => normalizeDomain(d))
    .filter((d) => d.length > 0);

  const uniqueList = Array.from(new Set(rawList));
  if (uniqueList.length === 0) {
    return NextResponse.json(
      { error: "Aucun domaine fourni" },
      { status: 400, headers: jsonHeaders },
    );
  }

  const invalid = uniqueList.filter((d) => !DOMAIN_REGEX.test(d));
  if (invalid.length > 0) {
    return NextResponse.json(
      {
        error: `Domaine(s) invalide(s) : ${invalid.join(", ")} (ex: cpas.brussels)`,
      },
      { status: 400, headers: jsonHeaders },
    );
  }

  const created: unknown[] = [];
  const errors: { domain: string; error: string }[] = [];

  for (const domain of uniqueList) {
    try {
      const item = await createPartnerDomain({
        kind: "domain",
        domain,
        segment,
        partnerType,
        organizationName,
        notes: input.notes ?? null,
        isTest: input.isTest ?? false,
        createdBy: authCheck.user.id,
      });
      created.push(item);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        errors.push({ domain, error: "Déjà enregistré" });
        continue;
      }
      console.error("Error creating partner domain:", error);
      errors.push({ domain, error: "Erreur serveur" });
    }
  }

  if (created.length === 0) {
    return NextResponse.json(
      {
        error:
          errors.length === 1
            ? `${errors[0].domain} : ${errors[0].error}`
            : "Aucun domaine n'a pu être créé",
        errors,
      },
      { status: 409, headers: jsonHeaders },
    );
  }

  return NextResponse.json(
    {
      items: created,
      // Compat avec l'ancien client qui s'attend à `item` (single)
      item: created[0],
      errors: errors.length > 0 ? errors : undefined,
    },
    { headers: jsonHeaders },
  );
}
