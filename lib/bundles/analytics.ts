/// Analytics internes /mon-dossier — events best-effort, JAMAIS bloquants.
/// Calque de `lib/formations/analytics.ts`. Aucune donnée nominative :
/// sessionId/userId sont des pseudonymes, metadata borné en amont.
import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { BundleEventType } from "./analytics-events";

export interface BundleTrackCtx {
  bundleId?: string | null;
  sessionId?: string | null;
  userId?: string | null;
  source?: string | null;
  metadata?: Record<string, unknown>;
}

/// Enregistre un événement analytics (best-effort : toute erreur est avalée,
/// l'analytics ne doit jamais casser un flux utilisateur ni une route).
export async function trackBundleEvent(
  eventType: BundleEventType,
  ctx: BundleTrackCtx = {},
): Promise<void> {
  try {
    await prisma.bundleAnalyticsEvent.create({
      data: {
        eventType,
        bundleId: ctx.bundleId ?? null,
        sessionId: ctx.sessionId ?? null,
        userId: ctx.userId ?? null,
        source: ctx.source ?? null,
        metadataJson: (ctx.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  } catch (e) {
    console.error("[bundles/analytics] track failed:", e);
  }
}
