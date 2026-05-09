import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const preset = await prisma.fieldValidationPreset.findUnique({ where: { id } });
  if (!preset) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  return NextResponse.json(preset);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;
  const { id } = await params;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const existing = await prisma.fieldValidationPreset.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  // Builtin: on autorise les modifs (ex: corriger un message d'erreur), on bloque seulement la suppression
  if (body.regex) {
    try {
      new RegExp(body.regex, body.regexFlags || undefined);
    } catch {
      return NextResponse.json({ error: "regex invalide" }, { status: 400 });
    }
  }

  const data: Record<string, unknown> = {};
  const allowed = [
    "name",
    "description",
    "category",
    "fieldType",
    "regex",
    "regexFlags",
    "minLength",
    "maxLength",
    "minValue",
    "maxValue",
    "minDate",
    "maxDate",
    "belgianType",
    "crossFieldRule",
    "errorMsg",
    "errorMsgNl",
    "helpText",
    "helpTextNl",
    "placeholder",
    "placeholderNl",
    "icon",
    "color",
  ];
  for (const k of allowed) {
    if (body[k] !== undefined) {
      data[k] = body[k] === "" ? null : body[k];
    }
  }

  const updated = await prisma.fieldValidationPreset.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;
  const { id } = await params;

  const existing = await prisma.fieldValidationPreset.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (existing.builtin) {
    return NextResponse.json(
      { error: "Les presets builtin ne peuvent pas être supprimés." },
      { status: 403 }
    );
  }

  await prisma.fieldValidationPreset.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
