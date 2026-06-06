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
