/**
 * POST /api/chomage-ia/sessions/[id]/regenerate-from
 *
 * Édite un message utilisateur existant et relance Claude pour régénérer la
 * suite de la conversation. Supporte le même mode SSE streaming que /chat
 * (header `Accept: text/event-stream` ou query `?stream=1`).
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
 * En mode streaming : émet `text_delta` → `meta` → `done`, persiste le
 * message assistant à la fin (avant l'event `meta`).
 *
 * Réutilise les helpers du pipeline partagé `lib/chomage-ia/chat-pipeline.ts`.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { checkRateLimit, getClientIp } from "@/lib/documents/rate-limit";
import { DEFAULT_DOMAIN } from "@/lib/chomage-ia/types";
import {
  callClaude,
  AnthropicError,
  hasAnthropicKey,
} from "@/lib/chomage-ia/anthropic";
import { callClaudeStream } from "@/lib/chomage-ia/anthropic-stream";
import { CLAUDE_MODELS } from "@/lib/chomage-ia/models";
import {
  resolveSessionModel,
  logResolvedModel,
} from "@/lib/chomage-ia/model-resolver";
import { CHAT_SYSTEM_PROMPT } from "@/lib/chomage-ia/prompts";
import {
  prepareChatContext,
  postProcessChatAnswer,
  wantsStreaming,
  sseFormat,
} from "@/lib/chomage-ia/chat-pipeline";

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
    parsed = RegenerateSchema.parse(body);
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

  if (!hasAnthropicKey()) {
    return NextResponse.json(
      {
        error:
          "ANTHROPIC_API_KEY non configurée — impossible de régénérer la réponse.",
      },
      { status: 503 },
    );
  }

  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId },
  });
  if (!session) {
    return NextResponse.json(
      { error: "Session introuvable" },
      { status: 404 },
    );
  }

  const domain = session.domain || DEFAULT_DOMAIN;
  const streamMode = wantsStreaming(req);

  // 1. Récupère tous les messages triés (asc) pour pouvoir slicer.
  const allMessages = await prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
  });

  if (parsed.messageIndex >= allMessages.length) {
    return NextResponse.json(
      { error: "messageIndex hors plage" },
      { status: 400 },
    );
  }

  const targetMessage = allMessages[parsed.messageIndex];
  if (targetMessage.role !== "user") {
    return NextResponse.json(
      { error: "Le message à régénérer doit être un message utilisateur" },
      { status: 400 },
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
  const recentMessages = previousMessages.slice(-HISTORY_MAX);

  // 5. Contexte sources fondé sur la NOUVELLE question.
  const ctx = await prepareChatContext({
    domain,
    query: parsed.newContent,
  });

  // 6. Construit les messages pour Claude (alternance user/assistant).
  const apiMessages: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const m of recentMessages) {
    apiMessages.push({
      role: m.role as "user" | "assistant",
      content: m.content,
    });
  }
  apiMessages.push({ role: "user", content: parsed.newContent });

  // Résolution du modèle effectif depuis le `preferredModel` de la session.
  const resolved = resolveSessionModel(session.preferredModel);
  logResolvedModel("regenerate-from", resolved);

  // ============================================================
  // MODE STREAMING SSE
  // ============================================================
  if (streamMode) {
    return streamRegenerateResponse({
      sessionId,
      domain,
      apiMessages,
      cachedContext: ctx.cachedContext,
      includedSourceIds: ctx.includedSourceIds,
      totalSourcesAvailable: ctx.totalSourcesAvailable,
      truncated: ctx.truncated,
      model: resolved.model,
    });
  }

  // ============================================================
  // MODE NON-STREAMING (legacy)
  // ============================================================
  let assistantText: string;
  let usage;
  let modelUsed: string = resolved.model;
  try {
    const claudeRes = await callClaude({
      model: resolved.model,
      systemPrompt: CHAT_SYSTEM_PROMPT,
      cachedContext: ctx.cachedContext,
      messages: apiMessages,
      maxTokens: 2000,
      timeoutMs: 90_000,
    });
    assistantText = claudeRes.text;
    usage = claudeRes.usage;
    modelUsed = claudeRes.model;
  } catch (err) {
    if (err instanceof AnthropicError) {
      console.error("Regenerate Anthropic error:", err.status, err.details);
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
      { status: 500 },
    );
  }

  // 7. Post-process via pipeline.
  const { validCitedIds, citedSources, missingSources } =
    await postProcessChatAnswer({
      domain,
      assistantText,
      includedSourceIds: ctx.includedSourceIds,
    });

  // 8. Persiste le message assistant.
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
    missingSources,
    usage,
    kbStats: {
      totalSourcesAvailable: ctx.totalSourcesAvailable,
      includedInContext: ctx.includedSourceIds.length,
      truncated: ctx.truncated,
    },
  });
}

/* ------------------------------------------------------------------ */
/*  Mode STREAMING SSE pour /regenerate-from                            */
/* ------------------------------------------------------------------ */

interface StreamRegenerateArgs {
  sessionId: string;
  domain: string;
  apiMessages: Array<{ role: "user" | "assistant"; content: string }>;
  cachedContext: string;
  includedSourceIds: string[];
  totalSourcesAvailable: number;
  truncated: boolean;
  /** Modèle Claude effectif résolu via `resolveSessionModel`. */
  model: typeof CLAUDE_MODELS.sonnet | typeof CLAUDE_MODELS.haiku;
}

function streamRegenerateResponse(args: StreamRegenerateArgs): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let assistantText = "";
      let usageFinal: {
        inputTokens: number | null;
        outputTokens: number | null;
        cacheReadTokens: number | null;
        cacheWriteTokens: number | null;
        model: string;
        stopReason: string | null;
      } | null = null;
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
          model: args.model,
          systemPrompt: CHAT_SYSTEM_PROMPT,
          cachedContext: args.cachedContext,
          messages: args.apiMessages,
          maxTokens: 2000,
          timeoutMs: 180_000,
        })) {
          if (ev.type === "text_delta") {
            assistantText += ev.text;
            send({ type: "text_delta", text: ev.text });
          } else if (ev.type === "done") {
            usageFinal = ev.usage;
          } else if (ev.type === "error") {
            streamErrored = true;
            send({ type: "error", message: ev.message });
            await prisma.chatMessage.create({
              data: {
                sessionId: args.sessionId,
                role: "assistant",
                content: `⚠️ ${ev.message}`,
                citedSourceIds: [],
              },
            });
          }
        }
      } catch (err) {
        streamErrored = true;
        const errMsg =
          err instanceof AnthropicError
            ? err.status === 429
              ? "⚠️ L'API Claude est saturée (quota). Réessaie dans quelques secondes."
              : `⚠️ Erreur Anthropic (HTTP ${err.status}).`
            : err instanceof Error
              ? err.message
              : "Erreur inconnue";
        console.error("[chomage-ia regenerate stream] error:", err);
        send({ type: "error", message: errMsg });
        try {
          await prisma.chatMessage.create({
            data: {
              sessionId: args.sessionId,
              role: "assistant",
              content: errMsg,
              citedSourceIds: [],
            },
          });
        } catch (dbErr) {
          console.error(
            "[chomage-ia regenerate stream] failed to persist error message:",
            dbErr,
          );
        }
      }

      if (!streamErrored && assistantText.length > 0) {
        try {
          const { validCitedIds, citedSources, missingSources } =
            await postProcessChatAnswer({
              domain: args.domain,
              assistantText,
              includedSourceIds: args.includedSourceIds,
            });

          const assistantMsg = await prisma.chatMessage.create({
            data: {
              sessionId: args.sessionId,
              role: "assistant",
              content: assistantText,
              citedSourceIds: validCitedIds,
              model: usageFinal?.model ?? args.model,
              tokensIn: usageFinal?.inputTokens ?? null,
              tokensOut: usageFinal?.outputTokens ?? null,
            },
          });

          await prisma.chatSession.update({
            where: { id: args.sessionId },
            data: { updatedAt: new Date() },
          });

          send({
            type: "meta",
            sessionId: args.sessionId,
            messageId: assistantMsg.id,
            createdAt: assistantMsg.createdAt.toISOString(),
            citedSourceIds: validCitedIds,
            citedSources,
            missingSources,
            usage: usageFinal
              ? {
                  inputTokens: usageFinal.inputTokens,
                  outputTokens: usageFinal.outputTokens,
                  cacheReadTokens: usageFinal.cacheReadTokens,
                  cacheWriteTokens: usageFinal.cacheWriteTokens,
                  model: usageFinal.model,
                  stopReason: usageFinal.stopReason,
                }
              : null,
            kbStats: {
              totalSourcesAvailable: args.totalSourcesAvailable,
              includedInContext: args.includedSourceIds.length,
              truncated: args.truncated,
            },
          });
        } catch (err) {
          console.error(
            "[chomage-ia regenerate stream] post-process failed:",
            err,
          );
          send({
            type: "error",
            message:
              "Échec de la persistence du message assistant (la réponse a bien été générée).",
          });
        }
      }

      send({ type: "done" });
      try {
        controller.close();
      } catch {
        /* déjà fermé */
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
