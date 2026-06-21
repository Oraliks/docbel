/// Analytics internes du Decision Builder (admin) — best-effort, JAMAIS
/// bloquant. Réutilise la table `BundleAnalyticsEvent` (source = "admin").
/// Calque `lib/bundles/analytics.ts`.
///
/// Pas de `import "server-only"` (comme lib/decision-builder/server.ts) pour
/// rester importable par les scripts tsx ; l'import de Prisma le rend
/// server-only en pratique.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type DecisionTreeEventType =
  | "decision_tree_published"
  | "decision_tree_restored"
  | "decision_tree_validation_failed"
  | "decision_tree_simulated";

export interface DecisionTreeTrackCtx {
  treeId?: string | null;
  userId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function trackDecisionTreeEvent(
  eventType: DecisionTreeEventType,
  ctx: DecisionTreeTrackCtx = {},
): Promise<void> {
  try {
    await prisma.bundleAnalyticsEvent.create({
      data: {
        eventType,
        userId: ctx.userId ?? null,
        source: "admin",
        metadataJson: {
          ...(ctx.treeId ? { treeId: ctx.treeId } : {}),
          ...(ctx.metadata ?? {}),
        } as Prisma.InputJsonValue,
      },
    });
  } catch (e) {
    console.error("[decision-builder/analytics] track failed:", e);
  }
}
