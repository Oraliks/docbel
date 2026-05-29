/**
 * POST /api/chomage-ia/quick-chat
 *
 * Endpoint stateless pour le FAB chat flottant (admin layout global).
 *
 * Différences avec /api/chomage-ia/chat :
 *   - Pas de ChatSession DB (in-memory côté client uniquement)
 *   - Pas de ChatMessage persisté
 *   - Pas d'auto-titrage Haiku
 *   - Pas de modèle picker (défaut Sonnet 4.5)
 *   - L'historique conversationnel est passé dans le body par le client
 *
 * Reste identique :
 *   - Auth admin + rate-limit (20/min/IP — plus permissif car usage ponctuel)
 *   - RAG KB chômage via prepareChatContext (mêmes sources, mêmes memory)
 *   - Streaming SSE token-par-token
 *   - Citations [SRC:id] post-processed
 *   - Fail-soft si ANTHROPIC_API_KEY manquante
 *
 * Volontairement plus simple côté state : on garde l'UX rapide d'un mini-chat
 * jetable, idéal pour les "questions express" sans alourdir la KB de sessions.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/auth-check";
import { checkRateLimit, getClientIp } from "@/lib/documents/rate-limit";
import { DEFAULT_DOMAIN } from "@/lib/chomage-ia/types";
import {
  callClaudeStream,
  type StreamUsage,
} from "@/lib/chomage-ia/anthropic-stream";
import { AnthropicError, hasAnthropicKey } from "@/lib/chomage-ia/anthropic";
import { CLAUDE_MODELS } from "@/lib/chomage-ia/models";
import { CHAT_SYSTEM_PROMPT } from "@/lib/chomage-ia/prompts";
import {
  prepareChatContext,
  postProcessChatAnswer,
  sseFormat,
} from "@/lib/chomage-ia/chat-pipeline";

const QuickChatSchema = z.object({
  message: z.string().min(1, "Message vide").max(2000),
  /**
   * Historique conversationnel (max 6 derniers messages : ~3 tours).
   * Client passe ses messages in-memory à chaque appel — pas de persistence.
   */
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(8000),
      }),
    )
    .max(6)
    .optional()
    .default([]),
  domain: z.string().min(2).max(50).optional().default(DEFAULT_DOMAIN),
});

const HISTORY_MAX = 6;

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const ip = getClientIp(req);
  const rl = checkRateLimit(`chomage-ia:quick-chat:${ip}`, {
    windowMs: 60_000,
    max: 20,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes — réessayez dans une minute" },
      { status: 429 },
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
    parsed = QuickChatSchema.parse(body);
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

  const domain = parsed.domain;

  // Fail-soft sans clé API.
  if (!hasAnthropicKey()) {
    return NextResponse.json({
      message: {
        role: "assistant" as const,
        content:
          "⚠️ L'API Claude n'est pas configurée (ANTHROPIC_API_KEY manquante).",
        citedSourceIds: [],
      },
      citedSources: [],
      aiDisabled: true,
    });
  }

  // Contexte sources via la même pipeline que /chat (RAG + memory).
  // Pas de scopeFolderIds pour le FAB : toujours toute la KB.
  const ctx = await prepareChatContext({
    domain,
    query: parsed.message,
  });

  // Construit les messages : history + nouveau message user.
  const apiMessages: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const m of parsed.history.slice(-HISTORY_MAX)) {
    apiMessages.push({ role: m.role, content: m.content });
  }
  apiMessages.push({ role: "user", content: parsed.message });

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let assistantText = "";
      let usageFinal: StreamUsage | null = null;
      let streamErrored = false;

      function send(payload: unknown) {
        try {
          controller.enqueue(encoder.encode(sseFormat(payload)));
        } catch {
          /* client a fermé */
        }
      }

      try {
        for await (const ev of callClaudeStream({
          model: CLAUDE_MODELS.sonnet,
          systemPrompt: CHAT_SYSTEM_PROMPT,
          cachedContext: ctx.cachedContext,
          messages: apiMessages,
          maxTokens: 1500,
          timeoutMs: 90_000,
        })) {
          if (ev.type === "text_delta") {
            assistantText += ev.text;
            send({ type: "text_delta", text: ev.text });
          } else if (ev.type === "done") {
            usageFinal = ev.usage;
          } else if (ev.type === "error") {
            streamErrored = true;
            send({ type: "error", message: ev.message });
          }
        }
      } catch (err) {
        streamErrored = true;
        const errMsg =
          err instanceof AnthropicError
            ? err.status === 429
              ? "⚠️ L'API Claude est saturée. Réessaie dans quelques secondes."
              : `⚠️ Erreur Anthropic (HTTP ${err.status}).`
            : err instanceof Error
              ? err.message
              : "Erreur inconnue";
        console.error("[quick-chat] stream error:", err);
        send({ type: "error", message: errMsg });
      }

      // Post-process citations sur la réponse finale.
      if (!streamErrored && assistantText.length > 0) {
        try {
          const { citedSources } = await postProcessChatAnswer({
            domain,
            assistantText,
            includedSourceIds: ctx.includedSourceIds,
          });
          send({
            type: "meta",
            citedSources,
            usage: usageFinal,
          });
        } catch (err) {
          console.warn("[quick-chat] post-process failed:", err);
        }
      }

      send({ type: "done" });
      try {
        controller.close();
      } catch {
        /* stream déjà fermé */
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
