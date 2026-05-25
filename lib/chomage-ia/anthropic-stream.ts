/**
 * Wrapper streaming pour l'API Anthropic Messages v1 (module IA chômage).
 *
 * Pendant que {@link ./anthropic.ts | callClaude} fait un appel bloquant qui
 * renvoie la réponse complète, ce helper-ci yield les tokens au fur et à
 * mesure qu'ils arrivent — pour une UX "ChatGPT" côté chat.
 *
 * Parse les Server-Sent Events Anthropic :
 *   - `message_start` : on capture le modèle + l'input usage
 *   - `content_block_start` : début d'un bloc texte (ignoré, on attend les deltas)
 *   - `content_block_delta` : un token (ou plusieurs) → yield `text_delta`
 *   - `content_block_stop` : fin d'un bloc (ignoré)
 *   - `message_delta` : stop_reason + output_tokens cumulés
 *   - `message_stop` : fin du stream → yield `done` avec les compteurs finaux
 *   - `ping` : keepalive (ignoré)
 *   - `error` : émis par Anthropic au milieu du stream → yield `error`
 *
 * Le helper ne fait PAS de retry : les routes API gèrent les erreurs et
 * peuvent renvoyer un fallback gracieux au client.
 */

import {
  ANTHROPIC_API_URL,
  ANTHROPIC_API_VERSION,
  type ClaudeModel,
} from "./models";
import { AnthropicError } from "./anthropic";

export interface CallClaudeStreamOptions {
  /** Modèle Claude à appeler. */
  model: ClaudeModel;
  /** System prompt — mis en cache via cache_control ephemeral. */
  systemPrompt: string;
  /**
   * Messages user/assistant à envoyer.
   * Format Anthropic standard : `[{role: "user", content: "…"}]`.
   */
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  /** Tokens max de la réponse. */
  maxTokens?: number;
  /** Timeout en millisecondes (défaut 180s — streaming peut être long). */
  timeoutMs?: number;
  /**
   * Bloc de contexte additionnel à mettre en cache (typiquement la KB).
   * Si présent, on ajoute un second bloc `cache_control` sur le system.
   */
  cachedContext?: string;
  /**
   * Signal d'abort externe — typiquement câblé à un AbortController côté
   * route pour permettre au client de Stop() un stream long.
   */
  signal?: AbortSignal;
}

/**
 * Usage final du stream (renvoyé dans l'event `done`). Les compteurs
 * suivent la même convention que `ClaudeResponse.usage` mais peuvent
 * arriver partiellement nuls si Anthropic ne les renvoie pas (rare).
 */
export interface StreamUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  cacheWriteTokens: number | null;
  model: string;
  stopReason: string | null;
}

/**
 * Events yieldés par {@link callClaudeStream}. Le consumer (route API SSE)
 * les remappe en events `data: {...}\n\n` côté wire.
 */
export type StreamEvent =
  | { type: "text_delta"; text: string }
  | { type: "done"; usage: StreamUsage }
  | { type: "error"; message: string };

/**
 * Appel streaming à Claude. Yield des events typés au fur et à mesure
 * que les SSE Anthropic arrivent.
 *
 * Lève {@link AnthropicError} sur erreur HTTP initiale (4xx/5xx avant le
 * stream). Les erreurs survenant au milieu du stream sont yieldées comme
 * `{ type: "error" }` puis l'iterator se termine proprement.
 *
 * Exemple d'usage :
 * ```ts
 * for await (const ev of callClaudeStream({...})) {
 *   if (ev.type === "text_delta") writer.write(ev.text);
 *   else if (ev.type === "done") console.log(ev.usage);
 * }
 * ```
 */
export async function* callClaudeStream({
  model,
  systemPrompt,
  messages,
  maxTokens = 2000,
  timeoutMs = 180_000,
  cachedContext,
  signal,
}: CallClaudeStreamOptions): AsyncGenerator<StreamEvent, void, undefined> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AnthropicError("ANTHROPIC_API_KEY is not configured", 500);
  }

  // Compose un signal qui combine timeout + abort externe.
  // AbortSignal.any est dispo depuis Node 20.3 / Next 16 → OK.
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const combinedSignal =
    signal != null
      ? AbortSignal.any([timeoutSignal, signal])
      : timeoutSignal;

  const systemBlocks: Array<{
    type: "text";
    text: string;
    cache_control?: { type: "ephemeral" };
  }> = [
    {
      type: "text",
      text: systemPrompt,
      cache_control: { type: "ephemeral" },
    },
  ];

  if (cachedContext && cachedContext.length > 0) {
    systemBlocks.push({
      type: "text",
      text: cachedContext,
      cache_control: { type: "ephemeral" },
    });
  }

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_API_VERSION,
      "content-type": "application/json",
      accept: "text/event-stream",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemBlocks,
      messages,
      stream: true,
    }),
    signal: combinedSignal,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new AnthropicError(
      `Anthropic API error ${res.status}`,
      res.status,
      errText,
    );
  }

  if (!res.body) {
    throw new AnthropicError("Anthropic stream body is null", 502);
  }

  // ----- État accumulé pendant le stream pour l'event final `done` -----
  let modelOut: string = model;
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;
  let cacheReadTokens: number | null = null;
  let cacheWriteTokens: number | null = null;
  let stopReason: string | null = null;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Parse SSE par double-newline ("\n\n" sépare les events).
      let sepIdx: number;
      while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
        const rawEvent = buffer.slice(0, sepIdx);
        buffer = buffer.slice(sepIdx + 2);
        const dataLines: string[] = [];
        for (const line of rawEvent.split("\n")) {
          if (line.startsWith("data: ")) {
            dataLines.push(line.slice(6));
          }
        }
        if (dataLines.length === 0) continue;
        const dataStr = dataLines.join("\n");
        if (dataStr === "[DONE]") {
          // Anthropic n'envoie pas [DONE] mais ne fait jamais de mal de gérer.
          continue;
        }

        let payload: unknown;
        try {
          payload = JSON.parse(dataStr);
        } catch {
          // SSE malformé — on ignore l'event silencieusement (Anthropic envoie
          // parfois des `event: ping` sans data JSON).
          continue;
        }

        const event = payload as {
          type?: string;
          message?: {
            model?: string;
            usage?: {
              input_tokens?: number;
              output_tokens?: number;
              cache_read_input_tokens?: number;
              cache_creation_input_tokens?: number;
            };
          };
          delta?: {
            type?: string;
            text?: string;
            stop_reason?: string;
          };
          usage?: {
            input_tokens?: number;
            output_tokens?: number;
            cache_read_input_tokens?: number;
            cache_creation_input_tokens?: number;
          };
          error?: { message?: string; type?: string };
        };

        switch (event.type) {
          case "message_start": {
            if (event.message?.model) modelOut = event.message.model;
            if (event.message?.usage) {
              inputTokens = event.message.usage.input_tokens ?? null;
              outputTokens = event.message.usage.output_tokens ?? null;
              cacheReadTokens =
                event.message.usage.cache_read_input_tokens ?? null;
              cacheWriteTokens =
                event.message.usage.cache_creation_input_tokens ?? null;
            }
            break;
          }
          case "content_block_delta": {
            if (
              event.delta?.type === "text_delta" &&
              typeof event.delta.text === "string" &&
              event.delta.text.length > 0
            ) {
              yield { type: "text_delta", text: event.delta.text };
            }
            break;
          }
          case "message_delta": {
            if (event.delta?.stop_reason) {
              stopReason = event.delta.stop_reason;
            }
            // Le `usage` du message_delta contient l'output_tokens cumulé final.
            if (event.usage?.output_tokens != null) {
              outputTokens = event.usage.output_tokens;
            }
            break;
          }
          case "message_stop": {
            // L'event final — on yield `done` ici pour garantir qu'on capture
            // bien le stopReason / les tokens finaux.
            yield {
              type: "done",
              usage: {
                inputTokens,
                outputTokens,
                cacheReadTokens,
                cacheWriteTokens,
                model: modelOut,
                stopReason,
              },
            };
            return;
          }
          case "error": {
            yield {
              type: "error",
              message:
                event.error?.message ??
                `Anthropic stream error (${event.error?.type ?? "unknown"})`,
            };
            return;
          }
          // `content_block_start`, `content_block_stop`, `ping` : ignorés.
          default:
            break;
        }
      }
    }

    // Stream terminé sans `message_stop` — yield un `done` de secours.
    yield {
      type: "done",
      usage: {
        inputTokens,
        outputTokens,
        cacheReadTokens,
        cacheWriteTokens,
        model: modelOut,
        stopReason,
      },
    };
  } catch (err) {
    // AbortError (timeout ou client abort) — relève proprement comme `error`.
    if (err instanceof Error && err.name === "AbortError") {
      yield {
        type: "error",
        message: "Stream interrompu (timeout ou annulation client)",
      };
      return;
    }
    // Autre erreur réseau / parse — on yield un error event.
    yield {
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Reader déjà relâché (cas du return après message_stop) — pas grave.
    }
  }
}
