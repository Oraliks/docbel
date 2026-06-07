import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { ensureWriteAllowed } from "@/lib/admin/readonly-guard";

const json = { "Content-Type": "application/json; charset=utf-8" };
const DRAFT_TTL_DAYS = 7;

async function ctx(slug: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return { error: NextResponse.json({ error: "Non connecté" }, { status: 401, headers: json }) };
  const form = await prisma.pdfForm.findUnique({ where: { slug }, select: { id: true } });
  if (!form) return { error: NextResponse.json({ error: "Introuvable" }, { status: 404, headers: json }) };
  return { userId: session.user.id, formId: form.id };
}

/// GET — charge le brouillon de l'utilisateur connecté (ou null).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await ctx(slug);
  if ("error" in c) return c.error;
  const draft = await prisma.pdfFormDraft.findUnique({
    where: { formId_userId: { formId: c.formId, userId: c.userId } },
  });
  return NextResponse.json({ draft: draft?.payload ?? null }, { headers: json });
}

/// PUT — enregistre/met à jour le brouillon (TTL 7 jours, purge cron RGPD).
export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await ctx(slug);
  if ("error" in c) return c.error;

  const writeBlock = await ensureWriteAllowed();
  if (writeBlock) return writeBlock;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: json });
  }
  if (!body?.payload || typeof body.payload !== "object") {
    return NextResponse.json({ error: "payload requis" }, { status: 400, headers: json });
  }

  const expiresAt = new Date(Date.now() + DRAFT_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.pdfFormDraft.upsert({
    where: { formId_userId: { formId: c.formId, userId: c.userId } },
    create: { formId: c.formId, userId: c.userId, payload: body.payload as object, expiresAt },
    update: { payload: body.payload as object, expiresAt },
  });
  return NextResponse.json({ ok: true }, { headers: json });
}

/// DELETE — supprime le brouillon.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await ctx(slug);
  if ("error" in c) return c.error;

  const writeBlock = await ensureWriteAllowed();
  if (writeBlock) return writeBlock;

  await prisma.pdfFormDraft
    .delete({ where: { formId_userId: { formId: c.formId, userId: c.userId } } })
    .catch(() => {});
  return NextResponse.json({ ok: true }, { headers: json });
}
