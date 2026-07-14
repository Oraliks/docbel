import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
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

/// Propriété d'un run pour l'écriture d'un brouillon serveur (Lot 3) : userId de
/// session si connecté, sinon cookie de session anonyme `beldoc-bundle-session`
/// (server-readable). Résout le run + son formId ; `null` si introuvable, pas à
/// l'appelant, ou clôturé — indistinct pour ne jamais fuiter l'existence ni
/// écrire dans le dossier d'un autre citoyen (cross-tenant).
async function resolveOwnedRun(req: NextRequest, slug: string, bundleRunId: string) {
  const form = await prisma.pdfForm.findUnique({ where: { slug }, select: { id: true } });
  if (!form) return null;
  const session = await auth.api.getSession({ headers: await headers() });
  const ownerUserId = session?.user?.id || null;
  const ownerSessionId = req.cookies.get("beldoc-bundle-session")?.value || null;
  const run = await prisma.bundleRun.findUnique({
    where: { id: bundleRunId },
    select: { id: true, userId: true, sessionId: true, status: true, draftPayloads: true },
  });
  if (!run || run.status !== "in_progress") return null;
  const owns = ownerUserId
    ? run.userId === ownerUserId
    : ownerSessionId
      ? run.sessionId === ownerSessionId
      : false;
  if (!owns) return null;
  return { formId: form.id, run };
}

/// GET — charge le brouillon de l'utilisateur connecté (ou null). Le brouillon
/// de dossier (draftPayloads) est restauré côté serveur (page /document), pas ici.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await ctx(slug);
  if ("error" in c) return c.error;
  const draft = await prisma.pdfFormDraft.findUnique({
    where: { formId_userId: { formId: c.formId, userId: c.userId } },
  });
  return NextResponse.json({ draft: draft?.payload ?? null }, { headers: json });
}

/// PUT — enregistre/met à jour le brouillon.
///   - `bundleRunId` fourni → brouillon de DOSSIER (anonyme via cookie OU
///     connecté) : fusionne `payload` dans `draftPayloads[formId]` du run et
///     mémorise l'étape/champ actifs. Propriété vérifiée (jamais cross-tenant).
///   - sinon → brouillon autonome `PdfFormDraft` (connecté, TTL 7j, purge cron).
export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const writeBlock = await ensureWriteAllowed();
  if (writeBlock) return writeBlock;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: json });
  }
  if (!body?.payload || typeof body.payload !== "object") {
    return NextResponse.json({ error: "payload requis" }, { status: 400, headers: json });
  }

  const bundleRunId = typeof body.bundleRunId === "string" ? body.bundleRunId : null;

  // Brouillon de dossier (anonyme possible : le cookie est lisible côté serveur
  // mais pas par le client — d'où l'écriture serveur ici).
  if (bundleRunId) {
    const owned = await resolveOwnedRun(req, slug, bundleRunId);
    if (!owned) return NextResponse.json({ error: "Introuvable" }, { status: 404, headers: json });
    const drafts = { ...((owned.run.draftPayloads as Record<string, unknown>) ?? {}) };
    drafts[owned.formId] = body.payload;
    await prisma.bundleRun.update({
      where: { id: bundleRunId },
      data: {
        draftPayloads: drafts as Prisma.InputJsonValue,
        lastFormId: owned.formId,
        lastStepId: typeof body.stepId === "string" ? body.stepId : null,
        lastActiveField: typeof body.field === "string" ? body.field : null,
      },
    });
    return NextResponse.json({ ok: true }, { headers: json });
  }

  // Brouillon autonome (connecté) — inchangé.
  const c = await ctx(slug);
  if ("error" in c) return c.error;
  const expiresAt = new Date(Date.now() + DRAFT_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.pdfFormDraft.upsert({
    where: { formId_userId: { formId: c.formId, userId: c.userId } },
    create: { formId: c.formId, userId: c.userId, payload: body.payload as object, expiresAt },
    update: { payload: body.payload as object, expiresAt },
  });
  return NextResponse.json({ ok: true }, { headers: json });
}

/// DELETE — supprime le brouillon.
///   - `bundleRunId` fourni → vide `draftPayloads[formId]` du run + oublie
///     l'étape/champ (reset du formulaire dans un dossier). Propriété vérifiée.
///   - sinon → supprime le `PdfFormDraft` autonome (connecté).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const writeBlock = await ensureWriteAllowed();
  if (writeBlock) return writeBlock;

  // Corps optionnel : les appels autonomes (download/doccle) n'en envoient pas.
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const bundleRunId = typeof body?.bundleRunId === "string" ? body.bundleRunId : null;

  if (bundleRunId) {
    const owned = await resolveOwnedRun(req, slug, bundleRunId);
    // Idempotent + sans fuite : rien à faire si le run n'est pas à l'appelant.
    if (!owned) return NextResponse.json({ ok: true }, { headers: json });
    const drafts = { ...((owned.run.draftPayloads as Record<string, unknown>) ?? {}) };
    delete drafts[owned.formId];
    await prisma.bundleRun.update({
      where: { id: bundleRunId },
      data: {
        draftPayloads: Object.keys(drafts).length > 0 ? (drafts as Prisma.InputJsonValue) : Prisma.DbNull,
        lastStepId: null,
        lastActiveField: null,
      },
    });
    return NextResponse.json({ ok: true }, { headers: json });
  }

  const c = await ctx(slug);
  if ("error" in c) return c.error;
  await prisma.pdfFormDraft
    .delete({ where: { formId_userId: { formId: c.formId, userId: c.userId } } })
    .catch(() => {});
  return NextResponse.json({ ok: true }, { headers: json });
}
