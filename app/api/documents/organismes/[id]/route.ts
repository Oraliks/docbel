import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { OrganismeType } from "@prisma/client";
import { memoCacheInvalidate } from "@/lib/memo-cache";
import { scheduleAutoTranslate } from "@/lib/i18n/auto-translate";

const ORGANISMES_CACHE_KEY = "documents:organismes:all";

const VALID_TYPES: OrganismeType[] = [
  "federal",
  "regional",
  "local",
  "social",
  "professional",
  "other",
];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;
  const { id } = await params;

  const organisme = await prisma.organisme.findUnique({
    where: { id },
    include: { _count: { select: { pdfForms: true } } },
  });
  if (!organisme) {
    return NextResponse.json({ error: "Organisme introuvable" }, { status: 404 });
  }
  return NextResponse.json(organisme);
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

  const existing = await prisma.organisme.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Organisme introuvable" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};

  if (body.name !== undefined) {
    if (!body.name) return NextResponse.json({ error: "name vide" }, { status: 400 });
    data.name = body.name;
  }
  if (body.shortName !== undefined) data.shortName = body.shortName || null;
  if (body.type !== undefined) {
    if (!VALID_TYPES.includes(body.type)) {
      return NextResponse.json({ error: "type invalide" }, { status: 400 });
    }
    data.type = body.type;
  }
  if (body.color !== undefined) data.color = body.color || "#7C3AED";
  if (body.logoUrl !== undefined) data.logoUrl = body.logoUrl || null;
  if (body.website !== undefined) data.website = body.website || null;
  if (body.description !== undefined) data.description = body.description || null;
  if (body.order !== undefined) data.order = typeof body.order === "number" ? body.order : 0;
  if (body.active !== undefined) data.active = !!body.active;

  const updated = await prisma.organisme.update({ where: { id }, data });
  memoCacheInvalidate(ORGANISMES_CACHE_KEY);
  // Auto-traduction NL/EN si name/description a changé (statut "ia", à relire).
  if (body.name !== undefined || body.description !== undefined) {
    scheduleAutoTranslate("Organisme", updated.id);
  }
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;
  const { id } = await params;

  const existing = await prisma.organisme.findUnique({
    where: { id },
    include: { _count: { select: { pdfForms: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Organisme introuvable" }, { status: 404 });
  }

  if (existing._count.pdfForms > 0) {
    // Soft delete : on désactive seulement, pour préserver les références
    const deactivated = await prisma.organisme.update({
      where: { id },
      data: { active: false },
    });
    memoCacheInvalidate(ORGANISMES_CACHE_KEY);
    return NextResponse.json({
      ...deactivated,
      softDelete: true,
      message: `Désactivé (utilisé par ${existing._count.pdfForms} formulaire(s) PDF)`,
    });
  }

  await prisma.organisme.delete({ where: { id } });
  memoCacheInvalidate(ORGANISMES_CACHE_KEY);
  return NextResponse.json({ ok: true });
}
