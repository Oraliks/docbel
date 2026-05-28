import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { SEMANTIC_FIELD_TYPES } from "@/lib/pdf-forms/types";

const json = { "Content-Type": "application/json; charset=utf-8" };

/// GET — liste des presets de champs (builtin + custom).
export async function GET() {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const presets = await prisma.pdfFieldPreset.findMany({
    orderBy: [{ builtin: "desc" }, { label: "asc" }],
  });
  return NextResponse.json(presets, { headers: json });
}

/// POST — crée un preset custom.
export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: json });
  }

  const key = typeof body.key === "string" ? body.key.trim() : "";
  const label = typeof body.label === "string" ? body.label.trim() : "";
  const fieldType = typeof body.fieldType === "string" ? body.fieldType : "";
  if (!key || !label || !SEMANTIC_FIELD_TYPES.includes(fieldType as never)) {
    return NextResponse.json({ error: "key, label et fieldType valides requis" }, { status: 400, headers: json });
  }

  const exists = await prisma.pdfFieldPreset.findUnique({ where: { key } });
  if (exists) return NextResponse.json({ error: `La clé "${key}" existe déjà` }, { status: 409, headers: json });

  const created = await prisma.pdfFieldPreset.create({
    data: {
      key,
      label,
      fieldType,
      regex: typeof body.regex === "string" ? body.regex : null,
      errorMsg: (body.errorMsg as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      helpText: (body.helpText as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      maxLength: typeof body.maxLength === "number" ? body.maxLength : null,
      builtin: false,
      createdBy: auth.user.id,
    },
  });
  return NextResponse.json(created, { status: 201, headers: json });
}
