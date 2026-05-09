/// Helper côté client pour envoyer des événements analytics au serveur.
/// "Best-effort" — une erreur d'envoi ne doit jamais casser l'expérience utilisateur.

const SESSION_KEY = "beldoc-analytics-session";

function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export type AnalyticsEvent =
  | "started"
  | "section_completed"
  | "field_error"
  | "preview"
  | "abandoned"
  | "submitted"
  | "signature_started";

export function trackFormEvent(
  templateId: string,
  eventType: AnalyticsEvent,
  options?: { contextKey?: string; metadata?: Record<string, unknown> }
): void {
  if (typeof window === "undefined") return;
  const sessionId = getSessionId();
  const body = JSON.stringify({
    templateId,
    sessionId,
    eventType,
    contextKey: options?.contextKey,
    metadata: options?.metadata,
  });

  // sendBeacon pour survivre à un beforeunload (ex: abandoned)
  try {
    if (eventType === "abandoned" && navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/documents/analytics", blob);
      return;
    }
  } catch {
    // Fallback fetch
  }

  fetch("/api/documents/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Silencieux : l'analytics ne doit jamais casser l'app
  });
}
