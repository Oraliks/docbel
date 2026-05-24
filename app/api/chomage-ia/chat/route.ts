/**
 * POST /api/chomage-ia/chat
 *
 * Point d'entrée du chat IA chômage.
 *
 * Body : { sessionId?, message, domain? }
 *
 * Flux :
 *   1. Auth admin + rate-limit (10/min/IP).
 *   2. Crée ou récupère la ChatSession.
 *   3. Persiste le ChatMessage utilisateur.
 *   4. Construit le contexte sources (cf. lib/chomage-ia/context.ts).
 *   5. Récupère les 10 derniers messages de la session pour l'historique
 *      conversationnel (limite à 10 pour éviter de bourrer le contexte).
 *   6. Appelle Claude Sonnet 4.5 avec system prompt + contexte sources cachés.
 *   7. Parse les citations [SRC:id] dans la réponse.
 *   8. Persiste le ChatMessage assistant + IDs cités + métriques tokens.
 *   9. Renvoie { sessionId, message, citedSources, usage }.
 *
 * Gestion ANTHROPIC_API_KEY manquante : renvoie un message neutre côté client
 * sans crasher la route.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { checkRateLimit, getClientIp } from "@/lib/documents/rate-limit";
import { ChatRequestSchema, DEFAULT_DOMAIN } from "@/lib/chomage-ia/types";
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

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

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
    parsed = ChatRequestSchema.parse(body);
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

  const domain = parsed.domain ?? DEFAULT_DOMAIN;

  // Fail-soft : si pas de clé Anthropic, on renvoie un message neutre sans
  // persister le tour de chat — l'admin sait que c'est un environnement
  // sans IA configurée (dev local sans clé, par exemple).
  if (!hasAnthropicKey()) {
    return NextResponse.json(
      {
        sessionId: parsed.sessionId ?? null,
        message: {
          role: "assistant",
          content:
            "⚠️ L'API Claude n'est pas configurée (ANTHROPIC_API_KEY manquante). Configure la variable d'environnement pour activer le chat.",
          citedSourceIds: [],
        },
        citedSources: [],
        aiDisabled: true,
      },
      { status: 200 }
    );
  }

  // 1. Session : récupère ou crée.
  let sessionId = parsed.sessionId;
  let session = sessionId
    ? await prisma.chatSession.findUnique({ where: { id: sessionId } })
    : null;

  if (!session) {
    // Première phrase de l'user → titre auto (60 chars max).
    const autoTitle =
      parsed.message.length > 60
        ? parsed.message.slice(0, 57) + "..."
        : parsed.message;
    session = await prisma.chatSession.create({
      data: {
        title: autoTitle,
        domain,
        createdById: auth.user.id,
      },
    });
    sessionId = session.id;
  }

  // 2. Persiste le message utilisateur.
  await prisma.chatMessage.create({
    data: {
      sessionId: session.id,
      role: "user",
      content: parsed.message,
    },
  });

  // 3. Historique conversationnel : N derniers messages (sans celui qu'on vient
  //    d'ajouter, qui sera passé en dernier user message à part).
  const recentMessagesRaw = await prisma.chatMessage.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: "desc" },
    take: HISTORY_MAX + 1, // +1 pour skip le user qu'on vient d'ajouter
  });
  const recentMessages = recentMessagesRaw
    .slice(1) // skip le dernier (current user message)
    .reverse(); // ordre chronologique

  // 4. Contexte sources.
  const { contextText, includedSourceIds, totalSourcesAvailable, truncated } =
    await buildKnowledgeContext({
      domain,
      query: parsed.message,
    });

  const cachedContext = contextText
    ? `Voici les sources de la knowledge base que tu dois utiliser pour répondre. Chaque source est encadrée par <SOURCE id="..."> ... </SOURCE>. Cite ces IDs avec [SRC:id] dans ta réponse pour chaque affirmation factuelle.\n\n${contextText}`
    : `(La knowledge base est vide pour le domaine "${domain}". Préviens l'utilisateur que tu n'as pas de source et donne une réponse générique à vérifier.)`;

  // 5. Construit les messages pour Claude (alternance user/assistant).
  const apiMessages: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const m of recentMessages) {
    if (m.role === "user" || m.role === "assistant") {
      apiMessages.push({
        role: m.role as "user" | "assistant",
        content: m.content,
      });
    }
  }
  apiMessages.push({ role: "user", content: parsed.message });

  // 6. Appel Claude.
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
      console.error("Chat Anthropic error:", err.status, err.details);
      // On persiste un message d'erreur côté assistant pour garder l'historique cohérent.
      const errMsg =
        err.status === 429
          ? "⚠️ L'API Claude est saturée (quota). Réessaie dans quelques secondes."
          : `⚠️ Erreur Anthropic (HTTP ${err.status}). Réessaie ou vérifie les logs.`;
      await prisma.chatMessage.create({
        data: {
          sessionId: session.id,
          role: "assistant",
          content: errMsg,
          citedSourceIds: [],
        },
      });
      return NextResponse.json({
        sessionId: session.id,
        message: { role: "assistant", content: errMsg, citedSourceIds: [] },
        citedSources: [],
        error: errMsg,
      });
    }
    console.error("Chat unknown error:", err);
    return NextResponse.json(
      { error: "Échec du chat IA" },
      { status: 500 }
    );
  }

  // 7. Parse citations + cross-check avec les IDs réellement inclus.
  const allCitedIds = extractCitedSourceIds(assistantText);
  const validCitedIds = allCitedIds.filter((id) =>
    includedSourceIds.includes(id)
  );

  // Récupère les titres / kind pour le panneau "sources citées" du front.
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

  // 8. Persiste le message assistant.
  const assistantMsg = await prisma.chatMessage.create({
    data: {
      sessionId: session.id,
      role: "assistant",
      content: assistantText,
      citedSourceIds: validCitedIds,
      model: modelUsed,
      tokensIn: usage.inputTokens,
      tokensOut: usage.outputTokens,
    },
  });

  // Bump updatedAt de la session pour les tri "récent".
  await prisma.chatSession.update({
    where: { id: session.id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({
    sessionId: session.id,
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
