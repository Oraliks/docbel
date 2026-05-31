import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdminAuth } from "@/lib/auth-check";
import { PARTNER_TYPES } from "@/lib/entitlements";
import {
  deletePartnerDomain,
  updatePartnerDomain,
} from "@/lib/partner-domains";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

const DOMAIN_REGEX = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  const { id } = await context.params;

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
    email?: string | null;
    segment?: string;
    partnerType?: string | null;
    organizationName?: string;
    notes?: string | null;
    isTest?: boolean;
    isActive?: boolean;
  };

  // On ne transmet à la couche data que les champs effectivement présents dans
  // le payload (PATCH partiel — `undefined` = ne pas toucher).
  const patch: {
    kind?: string;
    domain?: string | null;
    email?: string | null;
    segment?: string;
    partnerType?: string | null;
    organizationName?: string;
    notes?: string | null;
    isTest?: boolean;
    isActive?: boolean;
  } = {};

  // kind : restreint à "domain" | "email" si fourni.
  if (input.kind !== undefined) {
    patch.kind = input.kind === "email" ? "email" : "domain";
  }

  // Le kind qui pilote la validation : celui du payload sinon déduit des champs.
  const effectiveKind =
    patch.kind ?? (input.email !== undefined ? "email" : undefined);

  // domain : optionnel pour une entrée email, sinon validé via regex.
  if (input.domain !== undefined) {
    const normalized = input.domain.trim().toLowerCase().replace(/^@/, "");
    if (!normalized) {
      // Domaine vide accepté uniquement quand l'entrée est (ou devient) email.
      if (effectiveKind === "email") {
        patch.domain = null;
      } else {
        return NextResponse.json(
          { error: "Domaine invalide (ex: cpas.brussels)" },
          { status: 400, headers: jsonHeaders },
        );
      }
    } else if (!DOMAIN_REGEX.test(normalized)) {
      return NextResponse.json(
        { error: "Domaine invalide (ex: cpas.brussels)" },
        { status: 400, headers: jsonHeaders },
      );
    } else {
      patch.domain = normalized;
    }
  }

  // email : requis et valide si fourni non vide ; vidé sinon.
  if (input.email !== undefined) {
    const normalizedEmail = (input.email ?? "").trim().toLowerCase();
    if (!normalizedEmail) {
      patch.email = null;
    } else if (!EMAIL_REGEX.test(normalizedEmail)) {
      return NextResponse.json(
        { error: "Adresse email invalide (ex: prenom.nom@gmail.com)" },
        { status: 400, headers: jsonHeaders },
      );
    } else {
      patch.email = normalizedEmail;
    }
  }

  // segment : "employeur" | "partenaire".
  if (input.segment !== undefined) {
    patch.segment = input.segment === "employeur" ? "employeur" : "partenaire";
  }

  // partnerType : sous-type valide seulement pour un segment "partenaire".
  // Si le payload bascule le segment vers "employeur", on force null.
  if (input.partnerType !== undefined || input.segment !== undefined) {
    const segmentForType = patch.segment;
    if (segmentForType === "employeur") {
      patch.partnerType = null;
    } else if (input.partnerType !== undefined) {
      const pt = input.partnerType;
      patch.partnerType =
        typeof pt === "string" &&
        (PARTNER_TYPES as readonly string[]).includes(pt)
          ? pt
          : null;
    }
  }

  if (input.organizationName !== undefined) {
    patch.organizationName = input.organizationName;
  }
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.isTest !== undefined) patch.isTest = input.isTest;
  if (input.isActive !== undefined) patch.isActive = input.isActive;

  try {
    const updated = await updatePartnerDomain(id, patch);
    return NextResponse.json({ item: updated }, { headers: jsonHeaders });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Ce domaine est déjà enregistré" },
        { status: 409, headers: jsonHeaders },
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { error: "Domaine introuvable" },
        { status: 404, headers: jsonHeaders },
      );
    }
    console.error("Error updating partner domain:", error);
    return NextResponse.json(
      { error: "Failed to update partner domain" },
      { status: 500, headers: jsonHeaders },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  const { id } = await context.params;

  try {
    await deletePartnerDomain(id);
    return NextResponse.json({ ok: true }, { headers: jsonHeaders });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { error: "Domaine introuvable" },
        { status: 404, headers: jsonHeaders },
      );
    }
    console.error("Error deleting partner domain:", error);
    return NextResponse.json(
      { error: "Failed to delete partner domain" },
      { status: 500, headers: jsonHeaders },
    );
  }
}
