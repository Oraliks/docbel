/** Analytics du module Formations — events best-effort, gated par le flag `analytics`. */
import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isFlagEnabled } from "@/lib/formations/module";

export type AnalyticsEventType =
  | "VIEW"
  | "SAVE"
  | "UNSAVE"
  | "ENROLLMENT_STARTED"
  | "ENROLLMENT_SUBMITTED"
  | "ORIENTATION_RECOMMENDED"
  | "EXTERNAL_PAYMENT_CLICKED"
  | "CERTIFICATE_DOWNLOADED";

export interface TrackCtx {
  trainingId?: string | null;
  sessionId?: string | null;
  organizationId?: string | null;
  userId?: string | null;
  source?: string | null;
  metadata?: Record<string, unknown>;
}

/** Enregistre un événement analytics (jamais bloquant). */
export async function trackEvent(eventType: AnalyticsEventType, ctx: TrackCtx = {}): Promise<void> {
  try {
    if (!(await isFlagEnabled("analytics"))) return;
    await prisma.trainingAnalyticsEvent.create({
      data: {
        eventType,
        trainingId: ctx.trainingId ?? null,
        sessionId: ctx.sessionId ?? null,
        organizationId: ctx.organizationId ?? null,
        userId: ctx.userId ?? null,
        source: ctx.source ?? null,
        metadataJson: (ctx.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  } catch (e) {
    console.error("[formations/analytics] track failed:", e);
  }
}
