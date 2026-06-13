import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureWriteAllowed } from "@/lib/admin/readonly-guard";
import {
  isValidNISS,
  isValidBelgianIBAN,
  isValidBelgianPostalCode,
  isValidBelgianPhone,
  isValidBelgianBCE,
} from "@/lib/pdf-forms/validators";

async function getUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.id || null;
}

/// Composition de ménage : liens de parenté autorisés (cf. profile-page.tsx).
const HOUSEHOLD_RELATIONSHIPS = [
  "conjoint",
  "enfant",
  "parent",
  "cohabitant",
  "autre",
] as const;
const MAX_HOUSEHOLD_MEMBERS = 12;

/// Valide et normalise le tableau `householdMembers`. Renvoie soit la liste
/// nettoyée (membres vides ignorés), soit une erreur lisible. On reste tolérant
/// sur les champs optionnels mais strict sur la borne et le lien de parenté.
function parseHouseholdMembers(
  raw: unknown
): { ok: true; value: Array<Record<string, unknown>> } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: "Composition de ménage invalide" };
  if (raw.length > MAX_HOUSEHOLD_MEMBERS)
    return { ok: false, error: `Ménage : ${MAX_HOUSEHOLD_MEMBERS} membres maximum` };

  const out: Array<Record<string, unknown>> = [];
  for (const m of raw) {
    if (typeof m !== "object" || m === null || Array.isArray(m))
      return { ok: false, error: "Membre de ménage invalide" };
    const member = m as Record<string, unknown>;
    const relationship = member.relationship;
    if (
      typeof relationship !== "string" ||
      !HOUSEHOLD_RELATIONSHIPS.includes(relationship as (typeof HOUSEHOLD_RELATIONSHIPS)[number])
    ) {
      return { ok: false, error: "Lien de parenté invalide" };
    }
    const firstName = typeof member.firstName === "string" ? member.firstName.trim() : "";
    const lastName = typeof member.lastName === "string" ? member.lastName.trim() : "";
    const birthDate = typeof member.birthDate === "string" ? member.birthDate.trim() : "";
    // Ligne entièrement vide (juste un lien par défaut) → on l'ignore.
    if (!firstName && !lastName && !birthDate && member.hasRevenu !== true) continue;
    out.push({
      firstName: firstName || null,
      lastName: lastName || null,
      relationship,
      birthDate: birthDate || null,
      hasRevenu: member.hasRevenu === true,
    });
  }
  return { ok: true, value: out };
}

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  return NextResponse.json(profile || { userId });
}

export async function PUT(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Garde lecture seule (Phase C #8 + #17) : refuse les mutations si l'admin
  // est en mode "lecture seule" sous impersonation, ou si le user actif est
  // un compte demo+xxx@docbel.local.
  const writeBlock = await ensureWriteAllowed();
  if (writeBlock) return writeBlock;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const errors: string[] = [];
  if (body.niss && !isValidNISS(body.niss)) errors.push("NISS invalide");
  if (body.iban && !isValidBelgianIBAN(body.iban)) errors.push("IBAN invalide");
  if (body.postalCode && !isValidBelgianPostalCode(body.postalCode))
    errors.push("Code postal invalide");
  if (body.phone && !isValidBelgianPhone(body.phone)) errors.push("Téléphone invalide");
  if (body.mobilePhone && !isValidBelgianPhone(body.mobilePhone))
    errors.push("Téléphone mobile invalide");
  if (body.employerBce && !isValidBelgianBCE(body.employerBce))
    errors.push("BCE employeur invalide");

  // Composition de ménage : valide à part (tableau JSON borné).
  let householdMembers: Array<Record<string, unknown>> | undefined;
  if (body.householdMembers !== undefined && body.householdMembers !== null) {
    const parsed = parseHouseholdMembers(body.householdMembers);
    if (!parsed.ok) errors.push(parsed.error);
    else householdMembers = parsed.value;
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(" ; ") }, { status: 422 });
  }

  // Champs autorisés (whitelist explicite)
  const allowed = [
    "firstName",
    "lastName",
    "niss",
    "birthDate",
    "birthPlace",
    "nationality",
    "gender",
    "street",
    "streetNum",
    "postalCode",
    "city",
    "country",
    "phone",
    "mobilePhone",
    "iban",
    "bic",
    "maritalStatus",
    "employer",
    "employerBce",
    "jobTitle",
    "contractType",
    "contractStart",
    // Préférences administratives (résolveur bureaux)
    "organismePaiement",
    "commissionParitaireCode",
    "mutuelleCode",
  ];

  const data: Record<string, unknown> = {};
  for (const k of allowed) {
    if (body[k] === "" || body[k] === null) {
      data[k] = null;
    } else if (body[k] !== undefined) {
      // Convertir les dates ISO string en Date
      if ((k === "birthDate" || k === "contractStart") && typeof body[k] === "string") {
        data[k] = new Date(body[k]);
      } else {
        data[k] = body[k];
      }
    }
  }

  // householdMembers : champ JSON (hors whitelist scalaire). null si absent
  // explicitement vidé, sinon le tableau normalisé.
  if (body.householdMembers === null) {
    data.householdMembers = null;
  } else if (householdMembers !== undefined) {
    data.householdMembers = householdMembers;
  }

  const profile = await prisma.userProfile.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });

  return NextResponse.json(profile);
}

export async function DELETE() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.userProfile.deleteMany({ where: { userId } });
  return NextResponse.json({ ok: true });
}
