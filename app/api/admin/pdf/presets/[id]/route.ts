import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";

const json = { "Content-Type": "application/json; charset=utf-8" };

/// PATCH — édite un preset. Les presets builtin ne sont pas modifiables.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;
  const preset = await prisma.pdfFieldPreset.findUnique({ where: { id } });
  if (!preset) return NextResponse.json({ error: "Introuvable" }, { status: 404, headers: json });
  if (preset.builtin) return NextResponse.json({ error: "Preset intégré non modifiable" }, { status: 403, headers: json });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: json });
  }

  const data: Prisma.PdfFieldPresetUpdateInput = {};
  if (typeof body.label === "string") data.label = body.label.trim();
  if (typeof body.fieldType === "string") data.fieldType = body.fieldType;
  if (typeof body.regex === "string" || body.regex === null) data.regex = (body.regex as string) ?? null;
  if (body.errorMsg !== undefined) data.errorMsg = (body.errorMsg as Prisma.InputJsonValue) ?? Prisma.JsonNull;
  if (body.helpText !== undefined) data.helpText = (body.helpText as Prisma.InputJsonValue) ?? Prisma.JsonNull;
  if (typeof body.maxLength === "number" || body.maxLength === null) data.maxLength = (body.maxLength as number) ?? null;

  const updated = await prisma.pdfFieldPreset.update({ where: { id }, data });
  return NextResponse.json(updated, { headers: json });
}

/// DELETE — supprime un preset custom (les builtin sont protégés).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;
  const preset = await prisma.pdfFieldPreset.findUnique({ where: { id } });
  if (!preset) return NextResponse.json({ error: "Introuvable" }, { status: 404, headers: json });
  if (preset.builtin) return NextResponse.json({ error: "Preset intégré non supprimable" }, { status: 403, headers: json });

  await prisma.pdfFieldPreset.delete({ where: { id } });
  return NextResponse.json({ ok: true }, { headers: json });
}
