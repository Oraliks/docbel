/**
 * Wrapper minimal autour de l'API Anthropic Messages v1 pour le module IA chômage.
 *
 * Centralise :
 *   - les en-têtes obligatoires (x-api-key, anthropic-version)
 *   - le timeout par défaut
 *   - le prompt caching sur le system prompt (cache_control ephemeral)
 *   - l'extraction du texte de la réponse
 *
 * Volontairement pas de retry ici : les routes API gèrent les erreurs et
 * renvoient un fallback gracieux au client (toast).
 */

import {
  ANTHROPIC_API_URL,
  ANTHROPIC_API_VERSION,
  type ClaudeModel,
} from "./models";

export interface CallClaudeOptions {
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
  /** Timeout en millisecondes (défaut 90s). */
  timeoutMs?: number;
  /**
   * Bloc de contexte additionnel à mettre en cache (typiquement la KB).
   * Si présent, on ajoute un second bloc `cache_control` sur le system.
   */
  cachedContext?: string;
}

export interface ClaudeResponse {
  text: string;
  usage: {
    inputTokens: number | null;
    outputTokens: number | null;
    cacheReadTokens: number | null;
    cacheWriteTokens: number | null;
  };
  model: string;
  stopReason: string | null;
}

export class AnthropicError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown
  ) {
    super(message);
    this.name = "AnthropicError";
  }
}

/**
 * Appel synchrone à Claude. Renvoie le texte + usage tokens.
 *
 * Lève {@link AnthropicError} en cas d'échec HTTP, et une `Error` standard
 * en cas de timeout ou de réponse vide.
 */
export async function callClaude({
  model,
  systemPrompt,
  messages,
  maxTokens = 1500,
  timeoutMs = 90_000,
  cachedContext,
}: CallClaudeOptions): Promise<ClaudeResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AnthropicError("ANTHROPIC_API_KEY is not configured", 500);
  }

  // Le system est un tableau de blocs ; le dernier porte cache_control si
  // un contexte additionnel est fourni, sinon le system prompt lui-même.
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
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemBlocks,
      messages,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new AnthropicError(
      `Anthropic API error ${res.status}`,
      res.status,
      errText
    );
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
    model?: string;
    stop_reason?: string;
  };

  const text = (data.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("")
    .trim();

  if (!text) {
    throw new AnthropicError("Empty response from Claude", 502, data);
  }

  return {
    text,
    usage: {
      inputTokens: data.usage?.input_tokens ?? null,
      outputTokens: data.usage?.output_tokens ?? null,
      cacheReadTokens: data.usage?.cache_read_input_tokens ?? null,
      cacheWriteTokens: data.usage?.cache_creation_input_tokens ?? null,
    },
    model: data.model ?? model,
    stopReason: data.stop_reason ?? null,
  };
}

/** Vérifie rapidement si l'IA est configurée (clé + setting). */
export function hasAnthropicKey(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}
