import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireAdminAuth } from "@/lib/auth-check";

const VALID_CATEGORIES = ["identity", "contact", "financial", "date", "belgian", "address", "custom"];
const VALID_BELGIAN_TYPES = ["niss", "iban", "tva", "bce", "postal", "phone"];

export async function GET(req: NextRequest) {
  // Lecture publique pour permettre aux APIs de génération d'utiliser les presets
  // (mais les listes complètes ne révèlent pas de données sensibles)
  const { searchParams } = new URL(req.url);
  const fieldType = searchParams.get("fieldType");
  const category = searchParams.get("category");

  const where: Record<string, unknown> = {};
  if (fieldType) where.fieldType = fieldType;
  if (category) where.category = category;

  const presets = await prisma.fieldValidationPreset.findMany({
    where,
    orderBy: [{ builtin: "desc" }, { category: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(presets);
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, description, category, fieldType, errorMsg } = body || {};
  if (!name) return NextResponse.json({ error: "name requis" }, { status: 400 });
  if (!errorMsg) return NextResponse.json({ error: "errorMsg requis" }, { status: 400 });
  if (!fieldType) return NextResponse.json({ error: "fieldType requis" }, { status: 400 });
  if (category && !VALID_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "category invalide" }, { status: 400 });
  }
  if (body.belgianType && !VALID_BELGIAN_TYPES.includes(body.belgianType)) {
    return NextResponse.json({ error: "belgianType invalide" }, { status: 400 });
  }

  const dup = await prisma.fieldValidationPreset.findUnique({ where: { name } });
  if (dup) {
    return NextResponse.json({ error: `name "${name}" déjà utilisé` }, { status: 409 });
  }

  // Test que la regex compile
  if (body.regex) {
    try {
      new RegExp(body.regex, body.regexFlags || undefined);
    } catch {
      return NextResponse.json({ error: "regex invalide" }, { status: 400 });
    }
  }

  const created = await prisma.fieldValidationPreset.create({
    data: {
      name,
      description: description || null,
      category: category || "custom",
      fieldType,
      regex: body.regex || null,
      regexFlags: body.regexFlags || null,
      minLength: typeof body.minLength === "number" ? body.minLength : null,
      maxLength: typeof body.maxLength === "number" ? body.maxLength : null,
      minValue: typeof body.minValue === "number" ? body.minValue : null,
      maxValue: typeof body.maxValue === "number" ? body.maxValue : null,
      minDate: body.minDate || null,
      maxDate: body.maxDate || null,
      belgianType: body.belgianType || null,
      crossFieldRule: (body.crossFieldRule ?? Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
      errorMsg,
      errorMsgNl: body.errorMsgNl || null,
      helpText: body.helpText || null,
      helpTextNl: body.helpTextNl || null,
      placeholder: body.placeholder || null,
      placeholderNl: body.placeholderNl || null,
      icon: body.icon || null,
      color: body.color || null,
      builtin: false,
      createdBy: auth.user.id,
    },
  });

  return NextResponse.json(created, { status: 201 });
}
