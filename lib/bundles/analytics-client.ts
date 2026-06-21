/// Émission d'événements analytics depuis le client (best-effort).
/// Poste vers `/api/bundles/events` ; toute erreur est silencieuse.
import { isClientBundleEvent, type BundleEventType } from "./analytics-events";

export function trackBundleEventClient(
  eventType: BundleEventType,
  payload: { bundleId?: string; metadata?: Record<string, unknown> } = {},
): void {
  if (typeof window === "undefined") return;
  if (!isClientBundleEvent(eventType)) return;
  try {
    fetch("/api/bundles/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType,
        bundleId: payload.bundleId,
        metadata: payload.metadata,
      }),
      keepalive: true, // survit à une navigation (ex. bundle_opened)
    }).catch(() => {});
  } catch {
    // ignore
  }
}
