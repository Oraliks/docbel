/**
 * Détection d'obsolescence des KnowledgeSource (Feature 3 — migration 22).
 *
 * Stratégie simple, basée sur l'âge :
 *   - Référence d'âge : `lastValidatedAt || createdAt` (la plus récente).
 *   - < 12 mois              → "fresh"
 *   - 12 mois ≤ âge < 24 mois → "stale"
 *   - ≥ 24 mois              → "obsolete"
 *
 * Boost d'obsolescence : si le contenu mentionne 2024 ou 2023 sans mention
 * de 2025/2026, on force "stale" minimum (même si l'âge < 12 mois).
 *
 * `kind in ("pdf","docx","url")` uniquement — les sources de type "text"
 * ou "qa" (validées admin) restent "unknown" : leur fraîcheur dépend de
 * l'admin qui les a écrites, pas d'un automatisme.
 */

import { prisma } from "@/lib/prisma";
import type { KnowledgeSource } from "@prisma/client";
import type { SourceValidityStatus } from "./types";

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const STALE_THRESHOLD_MS = 12 * MONTH_MS;
const OBSOLETE_THRESHOLD_MS = 24 * MONTH_MS;

/** Kinds éligibles à la détection automatique. Les "text" / "qa" : skip. */
const ELIGIBLE_KINDS = new Set(["pdf", "docx", "url", "xlsx", "pptx"]);

/**
 * Calcule le statut de fraîcheur attendu pour une source.
 * Pure function — ne lit pas la DB, juste les champs source + now.
 */
export function computeValidityStatus(
  source: Pick<KnowledgeSource, "kind" | "content" | "lastValidatedAt" | "createdAt">,
  now: Date = new Date(),
): SourceValidityStatus {
  if (!ELIGIBLE_KINDS.has(source.kind)) return "unknown";

  const refDate = source.lastValidatedAt ?? source.createdAt;
  if (!refDate) return "unknown";
  const ageMs = now.getTime() - refDate.getTime();
  if (ageMs < 0) return "fresh"; // anomalie date future → considère fraîche

  // Boost contenu : mention d'années anciennes sans année récente.
  const content = (source.content ?? "").slice(0, 8000);
  const mentionsRecent = /\b(2025|2026|2027)\b/.test(content);
  const mentionsOld = /\b(2023|2024)\b/.test(content);
  const contentBoost = mentionsOld && !mentionsRecent;

  let status: SourceValidityStatus;
  if (ageMs >= OBSOLETE_THRESHOLD_MS) status = "obsolete";
  else if (ageMs >= STALE_THRESHOLD_MS) status = "stale";
  else status = "fresh";

  // Boost : "fresh" + content ancien → downgrade en "stale".
  if (status === "fresh" && contentBoost) status = "stale";

  return status;
}

interface CronResult {
  scanned: number;
  fresh: number;
  stale: number;
  obsolete: number;
  unknown: number;
  updated: number;
}

/**
 * Exécute le cron mensuel d'obsolescence : pour chaque source `enabled`,
 * recalcule le statut et l'écrit si différent.
 *
 * Idempotent. Best-effort : si une source pose problème (erreur DB), on log
 * et on continue avec les suivantes.
 *
 * Appelé par `/api/chomage-ia/sources/cron-obsolescence` (route protégée par
 * `CRON_SECRET`) — manuellement ou via Vercel Cron mensuel.
 */
export async function runObsolescenceScan({
  domain,
  batchSize = 200,
}: {
  domain?: string;
  batchSize?: number;
} = {}): Promise<CronResult> {
  const where = domain ? { domain, enabled: true } : { enabled: true };
  const sources = await prisma.knowledgeSource.findMany({
    where,
    select: {
      id: true,
      kind: true,
      content: true,
      lastValidatedAt: true,
      createdAt: true,
      validityStatus: true,
    },
    take: batchSize * 50, // safety upper bound
  });

  const now = new Date();
  const result: CronResult = {
    scanned: sources.length,
    fresh: 0,
    stale: 0,
    obsolete: 0,
    unknown: 0,
    updated: 0,
  };

  // On batche les updates pour ne pas pummel la DB.
  const updates: Array<{ id: string; status: SourceValidityStatus }> = [];
  for (const s of sources) {
    const next = computeValidityStatus(s, now);
    result[next]++;
    if (next !== s.validityStatus) {
      updates.push({ id: s.id, status: next });
    }
  }

  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);
    await Promise.all(
      batch.map((u) =>
        prisma.knowledgeSource
          .update({
            where: { id: u.id },
            data: { validityStatus: u.status },
          })
          .catch((err) => {
            console.warn(
              `[obsolescence] update failed for ks=${u.id}:`,
              err instanceof Error ? err.message : String(err),
            );
          }),
      ),
    );
    result.updated += batch.length;
  }

  return result;
}
