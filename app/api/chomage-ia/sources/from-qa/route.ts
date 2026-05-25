/**
 * POST /api/chomage-ia/sources/from-qa
 *
 * Convertit un ChatMessage assistant (avec sa question user en amont) en une
 * KnowledgeSource permanente (Feature 2). Permet de capitaliser les bonnes
 * réponses du chat IA comme sources de référence.
 *
 * Body :
 *   { chatMessageId, title, tags?, folderId?, notes? }
 *
 * Pipeline :
 *   1. Récupère le ChatMessage assistant + son user message précédent dans la session.
 *   2. Compose un content formaté Q / R / Notes.
 *   3. Crée une KnowledgeSource avec kind="qa", sourceUrl pointant vers le
 *      permalink interne, summary = première phrase de la réponse.
 *   4. Indexing RAG + auto-tag fire-and-forget (réutilise les pipelines existants).
 *   5. Retourne l'ID de la source créée.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { SourceFromQaSchema, DEFAULT_DOMAIN } from "@/lib/chomage-ia/types";
import { runAutoTagInBackground } from "@/lib/chomage-ia/auto-tag";
import { runIndexInBackground } from "@/lib/chomage-ia/indexer";

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = SourceFromQaSchema.parse(body);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof z.ZodError
            ? err.issues[0]?.message || "Validation error"
            : "Validation error",
      },
      { status: 400 },
    );
  }

  // 1. Récupère le message assistant + sa session.
  const assistantMsg = await prisma.chatMessage.findUnique({
    where: { id: parsed.chatMessageId },
    include: {
      session: { select: { id: true, domain: true } },
    },
  });
  if (!assistantMsg || assistantMsg.role !== "assistant") {
    return NextResponse.json(
      { error: "Message assistant introuvable" },
      { status: 404 },
    );
  }

  // 2. Cherche le user message précédent dans la même session.
  const userMsg = await prisma.chatMessage.findFirst({
    where: {
      sessionId: assistantMsg.sessionId,
      role: "user",
      createdAt: { lt: assistantMsg.createdAt },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!userMsg) {
    return NextResponse.json(
      { error: "Question utilisateur d'origine introuvable" },
      { status: 404 },
    );
  }

  // 3. Validation folderId (si fourni).
  if (parsed.folderId) {
    const folder = await prisma.knowledgeFolder.findUnique({
      where: { id: parsed.folderId },
      select: { id: true },
    });
    if (!folder) {
      return NextResponse.json(
        { error: "Dossier cible introuvable" },
        { status: 400 },
      );
    }
  }

  // 4. Compose le content formaté.
  const notesBlock = parsed.notes
    ? `\n\n## Notes admin\n\n${parsed.notes.trim()}`
    : "";
  const content = `## Question

${userMsg.content.trim()}

## Réponse validée

${assistantMsg.content.trim()}${notesBlock}`;

  // Summary = première phrase de la réponse, max 350 chars.
  const firstSentence =
    assistantMsg.content
      .replace(/\s+/g, " ")
      .split(/(?<=[.!?])\s+/)[0]
      ?.trim() ?? "";
  const summary = firstSentence.slice(0, 350) || null;

  const permalink = `/admin/chomage/ia/chat?session=${assistantMsg.sessionId}&msg=${assistantMsg.id}`;
  const domain = assistantMsg.session?.domain ?? DEFAULT_DOMAIN;

  const created = await prisma.knowledgeSource.create({
    data: {
      title: parsed.title.trim(),
      kind: "qa",
      content,
      summary,
      sourceUrl: permalink,
      tags: parsed.tags ?? [],
      enabled: true,
      domain,
      folderId: parsed.folderId ?? null,
      createdById: auth.user.id,
      // Une Q&A validée admin est par essence "fraîche" — on saute le scan
      // auto en posant `lastValidatedAt = now`.
      lastValidatedAt: new Date(),
      validityStatus: "fresh",
    },
  });

  // Auto-tag + indexing en background (pareil que pour upload classique).
  void runAutoTagInBackground(
    created.id,
    content,
    parsed.title,
    parsed.tags ?? [],
  );
  runIndexInBackground(created.id);

  return NextResponse.json(
    {
      id: created.id,
      title: created.title,
      kind: created.kind,
      sourceUrl: created.sourceUrl,
      createdAt: created.createdAt.toISOString(),
    },
    { status: 201 },
  );
}

/**
 * GET /api/chomage-ia/sources/from-qa?messageId=…
 *
 * Vérifie si un ChatMessage donné a déjà été converti en source. Renvoie
 * l'ID de la source si oui, null sinon. Utilisé par le ContextMenu front
 * pour afficher le badge "📌 Validée comme source" sans full re-fetch.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const url = new URL(req.url);
  const messageId = url.searchParams.get("messageId");
  if (!messageId) {
    return NextResponse.json(
      { error: "messageId requis" },
      { status: 400 },
    );
  }

  const source = await prisma.knowledgeSource.findFirst({
    where: {
      kind: "qa",
      sourceUrl: { contains: `msg=${messageId}` },
    },
    select: { id: true, title: true, createdAt: true },
  });

  return NextResponse.json({
    converted: source !== null,
    source: source
      ? {
          id: source.id,
          title: source.title,
          createdAt: source.createdAt.toISOString(),
        }
      : null,
  });
}
