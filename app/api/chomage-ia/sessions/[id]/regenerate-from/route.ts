/**
 * POST /api/chomage-ia/sessions/[id]/regenerate-from
 *
 * Édite un message utilisateur existant et relance Claude pour régénérer la
 * suite de la conversation.
 *
 * Body : { messageIndex, newContent }
 *
 * Flux :
 *   1. Auth admin + rate-limit (10/min/IP — même budget que /chat).
 *   2. Vérifie l'existence de la session.
 *   3. Récupère tous les messages triés par createdAt asc.
 *   4. Supprime tous les messages d'index ≥ messageIndex (DELETE en cascade).
 *   5. Persiste le nouveau message user (avec le contenu édité).
 *   6. Reconstruit le contexte sources + l'historique + appelle Claude.
 *   7. Persiste le message assistant et renvoie le résultat (même shape que /chat).
 *
 * Réutilise les helpers de /chat/route.ts pour rester DRY.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { checkRateLimit, getClientIp } from "@/lib/documents/rate-limit";
import { DEFAULT_DOMAIN } from "@/lib/chomage-ia/types";
import {
  buildKnowledgeContext,
  extractCitedSourceIds,
} from "@/lib/chomage-ia/context";
import {
  callClaude,
  AnthropicError,
  hasAnthropicKey,
} from "@/lib/chomage-ia/anthropic";
import { CLAUDE_MODELS } from "@/lib/chomage-ia/models";
import { CHAT_SYSTEM_PROMPT } from "@/lib/chomage-ia/prompts";

const HISTORY_MAX = 10;

const RegenerateSchema = z.object({
  messageIndex: z.number().int().min(0).max(1000),
  newContent: z.string().min(1, "Message vide").max(4000),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id: sessionId } = await params;

  const ip = getClientIp(req);
  const rl = checkRateLimit(`chomage-ia:chat:${ip}`, {
    windowMs: 60_000,
    max: 10,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes — réessayez dans une minute" },
      { status: 429 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = RegenerateSchema.parse(body);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof z.ZodError
            ? err.issues[0]?.message || "Validation error"
            : "Validation error",
      },
      { status: 400 }
    );
  }

  if (!hasAnthropicKey()) {
    return NextResponse.json(
      {
        error:
          "ANTHROPIC_API_KEY non configurée — impossible de régénérer la réponse.",
      },
      { status: 503 }
    );
  }

  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId },
  });
  if (!session) {
    return NextResponse.json(
      { error: "Session introuvable" },
      { status: 404 }
    );
  }

  const domain = session.domain || DEFAULT_DOMAIN;

  // 1. Récupère tous les messages triés (asc) pour pouvoir slicer.
  const allMessages = await prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
  });

  if (parsed.messageIndex >= allMessages.length) {
    return NextResponse.json(
      { error: "messageIndex hors plage" },
      { status: 400 }
    );
  }

  const targetMessage = allMessages[parsed.messageIndex];
  if (targetMessage.role !== "user") {
    return NextResponse.json(
      { error: "Le message à régénérer doit être un message utilisateur" },
      { status: 400 }
    );
  }

  // 2. Supprime tous les messages d'index >= messageIndex (cible incluse,
  //    elle sera recréée avec le nouveau contenu).
  const idsToDelete = allMessages.slice(parsed.messageIndex).map((m) => m.id);
  if (idsToDelete.length > 0) {
    await prisma.chatMessage.deleteMany({
      where: { id: { in: idsToDelete } },
    });
  }

  // 3. Persiste le nouveau message user.
  await prisma.chatMessage.create({
    data: {
      sessionId,
      role: "user",
      content: parsed.newContent,
    },
  });

  // 4. Historique conversationnel = messages avant l'index édité.
  const previousMessages = allMessages
    .slice(0, parsed.messageIndex)
    .filter((m) => m.role === "user" || m.role === "assistant");

  // On garde les HISTORY_MAX derniers messages avant l'édit pour le contexte.
  const recentMessages = previousMessages.slice(-HISTORY_MAX);

  // 5. Contexte sources fondé sur la NOUVELLE question.
  const { contextText, includedSourceIds, totalSourcesAvailable, truncated } =
    await buildKnowledgeContext({
      domain,
      query: parsed.newContent,
    });

  const cachedContext = contextText
    ? `Voici les sources de la knowledge base que tu dois utiliser pour répondre. Chaque source est encadrée par <SOURCE id="..."> ... </SOURCE>. Cite ces IDs avec [SRC:id] dans ta réponse pour chaque affirmation factuelle.\n\n${contextText}`
    : `(La knowledge base est vide pour le domaine "${domain}". Préviens l'utilisateur que tu n'as pas de source et donne une réponse générique à vérifier.)`;

  // 6. Construit les messages pour Claude (alternance user/assistant).
  const apiMessages: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const m of recentMessages) {
    apiMessages.push({
      role: m.role as "user" | "assistant",
      content: m.content,
    });
  }
  apiMessages.push({ role: "user", content: parsed.newContent });

  // 7. Appel Claude.
  let assistantText: string;
  let usage;
  let modelUsed: string = CLAUDE_MODELS.sonnet;
  try {
    const claudeRes = await callClaude({
      model: CLAUDE_MODELS.sonnet,
      systemPrompt: CHAT_SYSTEM_PROMPT,
      cachedContext,
      messages: apiMessages,
      maxTokens: 2000,
      timeoutMs: 90_000,
    });
    assistantText = claudeRes.text;
    usage = claudeRes.usage;
    modelUsed = claudeRes.model;
  } catch (err) {
    if (err instanceof AnthropicError) {
      console.error(
        "Regenerate Anthropic error:",
        err.status,
        err.details
      );
      const errMsg =
        err.status === 429
          ? "⚠️ L'API Claude est saturée (quota). Réessaie dans quelques secondes."
          : `⚠️ Erreur Anthropic (HTTP ${err.status}). Réessaie ou vérifie les logs.`;
      await prisma.chatMessage.create({
        data: {
          sessionId,
          role: "assistant",
          content: errMsg,
          citedSourceIds: [],
        },
      });
      return NextResponse.json({
        sessionId,
        message: { role: "assistant", content: errMsg, citedSourceIds: [] },
        citedSources: [],
        error: errMsg,
      });
    }
    console.error("Regenerate unknown error:", err);
    return NextResponse.json(
      { error: "Échec de la régénération" },
      { status: 500 }
    );
  }

  // 8. Parse citations + cross-check avec les IDs réellement inclus.
  const allCitedIds = extractCitedSourceIds(assistantText);
  const validCitedIds = allCitedIds.filter((id) =>
    includedSourceIds.includes(id)
  );

  const citedSources =
    validCitedIds.length > 0
      ? await prisma.knowledgeSource.findMany({
          where: { id: { in: validCitedIds } },
          select: {
            id: true,
            title: true,
            kind: true,
            sourceUrl: true,
            summary: true,
          },
        })
      : [];

  // 9. Persiste le message assistant.
  const assistantMsg = await prisma.chatMessage.create({
    data: {
      sessionId,
      role: "assistant",
      content: assistantText,
      citedSourceIds: validCitedIds,
      model: modelUsed,
      tokensIn: usage.inputTokens,
      tokensOut: usage.outputTokens,
    },
  });

  await prisma.chatSession.update({
    where: { id: sessionId },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({
    sessionId,
    message: {
      id: assistantMsg.id,
      role: "assistant",
      content: assistantText,
      citedSourceIds: validCitedIds,
      createdAt: assistantMsg.createdAt.toISOString(),
    },
    citedSources,
    usage,
    kbStats: {
      totalSourcesAvailable,
      includedInContext: includedSourceIds.length,
      truncated,
    },
  });
}
