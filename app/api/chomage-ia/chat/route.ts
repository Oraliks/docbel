/**
 * POST /api/chomage-ia/chat
 *
 * Point d'entrée du chat IA chômage. Supporte deux modes :
 *   - JSON classique (réponse complète à la fin)  → comportement legacy
 *   - SSE streaming token-par-token              → si header `Accept: text/event-stream`
 *                                                  ou query `?stream=1`
 *
 * Flux commun (les deux modes) :
 *   1. Auth admin + rate-limit (10/min/IP).
 *   2. Crée ou récupère la ChatSession.
 *   3. Persiste le ChatMessage utilisateur.
 *   4. Construit le contexte sources (cf. lib/chomage-ia/context.ts).
 *   5. Récupère les 10 derniers messages de la session pour l'historique
 *      conversationnel (limite à 10 pour éviter de bourrer le contexte).
 *   6. Appelle Claude Sonnet 4.5 avec system prompt + contexte sources cachés.
 *   7. Parse les citations [SRC:id] dans la réponse + détecte missing sources.
 *   8. Persiste le ChatMessage assistant + IDs cités + métriques tokens.
 *   9. Lance l'auto-titrage Haiku en background pour les nouvelles sessions.
 *
 * Mode streaming :
 *   - Renvoie un `text/event-stream` :
 *       data: {"type":"text_delta","text":"…"}\n\n
 *       data: {"type":"meta","sessionId":"…","messageId":"…","citedSources":[…],"missingSources":[…],"usage":{…},"kbStats":{…}}\n\n
 *       data: {"type":"done"}\n\n
 *   - Sur erreur en cours de stream :
 *       data: {"type":"error","message":"…"}\n\n
 *
 * Gestion ANTHROPIC_API_KEY manquante : renvoie un message neutre côté client
 * sans crasher la route (même comportement dans les 2 modes).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { checkRateLimit, getClientIp } from "@/lib/documents/rate-limit";
import { ChatRequestSchema, DEFAULT_DOMAIN } from "@/lib/chomage-ia/types";
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
    parsed = ChatRequestSchema.parse(body);
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

  const domain = parsed.domain ?? DEFAULT_DOMAIN;
  const streamMode = wantsStreaming(req);

  // Fail-soft : si pas de clé Anthropic, on renvoie un message neutre.
  // Même payload dans les 2 modes (le client SSE peut aussi recevoir du JSON
  // si la 1re ligne est valide — mais ici on garde le shape JSON simple).
  if (!hasAnthropicKey()) {
    const payload = {
      sessionId: parsed.sessionId ?? null,
      message: {
        role: "assistant" as const,
        content:
          "⚠️ L'API Claude n'est pas configurée (ANTHROPIC_API_KEY manquante). Configure la variable d'environnement pour activer le chat.",
        citedSourceIds: [],
      },
      citedSources: [],
      aiDisabled: true,
    };
    return NextResponse.json(payload, { status: 200 });
  }

  // 1. Session : récupère ou crée.
  let sessionId = parsed.sessionId;
  let session = sessionId
    ? await prisma.chatSession.findUnique({ where: { id: sessionId } })
    : null;
  // Flag pour savoir si on doit lancer l'auto-titrage Haiku en background.
  const isNewSession = !session;

  if (!session) {
    const fallbackTitle =
      parsed.message.length > 60
        ? parsed.message.slice(0, 57) + "..."
        : parsed.message;
    session = await prisma.chatSession.create({
      data: {
        title: fallbackTitle,
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
    take: HISTORY_MAX + 1,
  });
  const recentMessages = recentMessagesRaw.slice(1).reverse();

  // 4. Contexte sources — migration 21, lit le scope de la session si défini.
  //    Migration 22 : si enableWebSearch=true côté body, le pipeline déclenche
  //    une recherche Brave + injecte les résultats comme sources temporaires.
  const ctx = await prepareChatContext({
    domain,
    query: parsed.message,
    scopeFolderIds: session.scopeFolderIds ?? [],
    enableWebSearch: parsed.enableWebSearch ?? false,
  });

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

  // Résolution du modèle effectif : si la session a un `preferredModel` set
  // par l'admin (UI sélecteur de modèle), on l'utilise — sinon défaut Sonnet.
  const resolved = resolveSessionModel(session.preferredModel);
  logResolvedModel("chat", resolved);

  // ============================================================
  // MODE STREAMING SSE
  // ============================================================
  if (streamMode) {
    return streamChatResponse({
      sessionId: session.id,
      domain,
      apiMessages,
      cachedContext: ctx.cachedContext,
      includedSourceIds: ctx.includedSourceIds,
      totalSourcesAvailable: ctx.totalSourcesAvailable,
      truncated: ctx.truncated,
      isNewSession,
      userMessage: parsed.message,
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
      console.error("Chat Anthropic error:", err.status, err.details);
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
    return NextResponse.json({ error: "Échec du chat IA" }, { status: 500 });
  }

  // Persiste le message assistant AVANT le post-process pour avoir un messageId.
  const assistantMsg = await prisma.chatMessage.create({
    data: {
      sessionId: session.id,
      role: "assistant",
      content: assistantText,
      citedSourceIds: [],
      model: modelUsed,
      tokensIn: usage.inputTokens,
      tokensOut: usage.outputTokens,
    },
  });

  // Parse citations + missing sources via le pipeline partagé.
  // Le `userQuery` permet la détection automatique des gaps de connaissance
  // (Feature 6) — fire-and-forget en interne du pipeline.
  const { validCitedIds, citedSources, missingSources } =
    await postProcessChatAnswer({
      domain,
      assistantText,
      includedSourceIds: ctx.includedSourceIds,
      userQuery: parsed.message,
      sessionId: session.id,
      messageId: assistantMsg.id,
    });

  // Update les citedSourceIds maintenant qu'on les a (post-process).
  if (validCitedIds.length > 0) {
    await prisma.chatMessage.update({
      where: { id: assistantMsg.id },
      data: { citedSourceIds: validCitedIds },
    });
  }

  await prisma.chatSession.update({
    where: { id: session.id },
    data: { updatedAt: new Date() },
  });

  if (isNewSession) {
    void generateAutoTitle({
      sessionId: session.id,
      userMessage: parsed.message,
      assistantMessage: assistantText,
    });
  }

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
/*  Mode STREAMING : ReadableStream + SSE                              */
/* ------------------------------------------------------------------ */

interface StreamChatArgs {
  sessionId: string;
  domain: string;
  apiMessages: Array<{ role: "user" | "assistant"; content: string }>;
  cachedContext: string;
  includedSourceIds: string[];
  totalSourcesAvailable: number;
  truncated: boolean;
  isNewSession: boolean;
  userMessage: string;
  /** Modèle Claude effectif résolu via `resolveSessionModel`. */
  model: typeof CLAUDE_MODELS.sonnet | typeof CLAUDE_MODELS.haiku;
}

/**
 * Construit la `Response` SSE qui :
 *   1. Stream les `text_delta` de Claude au fur et à mesure
 *   2. Persiste le message assistant complet en DB à la fin
 *   3. Émet un event `meta` avec sessionId / messageId / citedSources / etc.
 *   4. Émet un event `done` final
 *   5. Lance l'auto-titre Haiku en background si nouvelle session
 */
function streamChatResponse(args: StreamChatArgs): Response {
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
          // Client a fermé la connexion — silencieux.
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
            // On persiste quand même un message d'erreur côté assistant pour
            // garder l'historique cohérent (cf. branche AnthropicError non-stream).
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
        console.error("[chomage-ia chat stream] error:", err);
        send({ type: "error", message: errMsg });
        // Persiste un message d'erreur pour cohérence historique.
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
            "[chomage-ia chat stream] failed to persist error message:",
            dbErr,
          );
        }
      }

      // Si on a un texte assistant cohérent → post-process + persist + meta.
      if (!streamErrored && assistantText.length > 0) {
        try {
          const assistantMsg = await prisma.chatMessage.create({
            data: {
              sessionId: args.sessionId,
              role: "assistant",
              content: assistantText,
              citedSourceIds: [],
              model: usageFinal?.model ?? args.model,
              tokensIn: usageFinal?.inputTokens ?? null,
              tokensOut: usageFinal?.outputTokens ?? null,
            },
          });

          const { validCitedIds, citedSources, missingSources } =
            await postProcessChatAnswer({
              domain: args.domain,
              assistantText,
              includedSourceIds: args.includedSourceIds,
              userQuery: args.userMessage,
              sessionId: args.sessionId,
              messageId: assistantMsg.id,
            });

          if (validCitedIds.length > 0) {
            await prisma.chatMessage.update({
              where: { id: assistantMsg.id },
              data: { citedSourceIds: validCitedIds },
            });
          }

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

          // Auto-titre Haiku en background (fire-and-forget) pour les nouvelles sessions.
          if (args.isNewSession) {
            void generateAutoTitle({
              sessionId: args.sessionId,
              userMessage: args.userMessage,
              assistantMessage: assistantText,
            });
          }
        } catch (err) {
          console.error("[chomage-ia chat stream] post-process failed:", err);
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
        // Stream déjà fermé.
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

/**
 * Auto-titre généré par Claude Haiku à partir du premier échange.
 *
 * Fire-and-forget : appelé en background pour ne pas bloquer la réponse de
 * l'API /chat. Si l'appel échoue (rate limit, timeout, etc.), on log et on
 * laisse silencieusement le titre fallback (premiers 60 chars du message).
 */
async function generateAutoTitle({
  sessionId,
  userMessage,
  assistantMessage,
}: {
  sessionId: string;
  userMessage: string;
  assistantMessage: string;
}): Promise<void> {
  try {
    const combined = (userMessage + "\n\n" + assistantMessage).slice(0, 800);
    const claudeRes = await callClaude({
      model: CLAUDE_MODELS.haiku,
      systemPrompt:
        "Tu génères un titre court (4-6 mots, en français) résumant une conversation à partir de son premier échange. Pas de ponctuation finale, pas de guillemets. Réponds UNIQUEMENT par le titre, rien d'autre.",
      messages: [
        {
          role: "user",
          content: `Génère un titre court (4-6 mots, en français) résumant cette conversation. Pas de ponctuation finale, pas de guillemets.\n\nÉchange :\n${combined}`,
        },
      ],
      maxTokens: 40,
      timeoutMs: 15_000,
    });
    const rawTitle = claudeRes.text.trim();
    const cleaned = rawTitle
      .replace(/^["«»'']+|["«»'']+$/g, "")
      .replace(/[.!?]+$/, "")
      .trim()
      .slice(0, 120);
    if (cleaned.length === 0) return;
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: { title: cleaned },
    });
  } catch (err) {
    console.error("Auto-title generation failed:", err);
  }
}
