"use client";

/**
 * Helper côté client pour consommer un flux Server-Sent Events depuis un
 * endpoint `text/event-stream`.
 *
 * Pourquoi pas le natif `EventSource` du navigateur ?
 *   - `EventSource` ne supporte que les requêtes GET (pas de body POST).
 *   - Nos routes `/chat` et `/regenerate-from` sont POST avec un body JSON.
 *   - On veut aussi pouvoir abort le stream via AbortController (côté Stop).
 *
 * Yield des événements parsés ligne-par-ligne. Le caller (chat-full-shell)
 * fait le pattern match sur `event.type` et update son state.
 */

import type { ChatStreamEvent } from "./types";

export interface OpenChatStreamOptions {
  /** URL absolue ou relative — typiquement `/api/chomage-ia/chat`. */
  url: string;
  /** Body JSON à POSTer. */
  body: unknown;
  /** Signal d'abort externe (typiquement câblé au bouton Stop). */
  signal?: AbortSignal;
}

/**
 * Ouvre un stream SSE et yield les events parsés au fur et à mesure.
 *
 * Lève si :
 *   - Erreur réseau initiale (DNS, connection refused…)
 *   - Réponse HTTP non-OK et non-SSE (ex: 401, 429, 500 retournant du JSON)
 *
 * Si le serveur retourne une réponse JSON classique (ex: fail-soft sur
 * ANTHROPIC_API_KEY manquante), on yield un event "json_fallback" avec
 * le payload — le caller peut alors traiter comme une réponse non-streaming.
 *
 * Le stream se termine proprement après l'event `done` ou `error`.
 */
export async function* openChatStream({
  url,
  body,
  signal,
}: OpenChatStreamOptions): AsyncGenerator<
  ChatStreamEvent | { type: "json_fallback"; payload: unknown },
  void,
  undefined
> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(body),
    signal,
  });

  // Erreur HTTP avant le stream → tente de parser le body comme JSON pour
  // remonter un message d'erreur lisible au caller.
  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const errData = await res.json();
      if (errData && typeof errData === "object" && "error" in errData) {
        errMsg = String((errData as { error: unknown }).error);
      }
    } catch {
      // pas du JSON, on garde le HTTP code
    }
    throw new Error(errMsg);
  }

  // Fallback : si le serveur a renvoyé du JSON (et pas du SSE) — ex:
  // fail-soft "ANTHROPIC_API_KEY manquante" qui répond en JSON même sans
  // body streaming. On le passe au caller via "json_fallback".
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream")) {
    const payload = await res.json().catch(() => null);
    yield { type: "json_fallback", payload };
    return;
  }

  if (!res.body) {
    throw new Error("Stream body absent (Response.body est null)");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Parse SSE par double-newline.
      let sepIdx: number;
      while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
        const rawEvent = buffer.slice(0, sepIdx);
        buffer = buffer.slice(sepIdx + 2);

        // Extrait toutes les lignes `data: …` (un event SSE peut en avoir plusieurs).
        const dataLines: string[] = [];
        for (const line of rawEvent.split("\n")) {
          if (line.startsWith("data: ")) {
            dataLines.push(line.slice(6));
          }
        }
        if (dataLines.length === 0) continue;
        const dataStr = dataLines.join("\n");

        let payload: unknown;
        try {
          payload = JSON.parse(dataStr);
        } catch {
          // Event SSE non-JSON (ex: keepalive) — silencieux.
          continue;
        }

        // Validation minimale du shape.
        if (
          payload &&
          typeof payload === "object" &&
          "type" in payload &&
          typeof (payload as { type: unknown }).type === "string"
        ) {
          yield payload as ChatStreamEvent;
          if ((payload as ChatStreamEvent).type === "done") {
            return;
          }
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* reader déjà relâché */
    }
  }
}
