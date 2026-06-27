import "server-only";
import { after } from "next/server";
import { enqueueTranslationJobs, processTranslationJobs } from "./translation-queue";

/**
 * Auto-traduction du contenu DB après une sauvegarde FR (Phase 2).
 *
 * Délègue désormais à la QUEUE DURABLE (`lib/i18n/translation-queue.ts`) au lieu
 * du fire-and-forget : on crée des jobs persistants par champ/locale, puis on
 * déclenche leur traitement en arrière-plan via `after()`. Si le traitement
 * échoue (IA down, crédit épuisé…), les jobs restent en base avec `status:failed`
 * et sont relançables via l'endpoint admin `/api/admin/translation-jobs`.
 *
 * Hors contexte requête (seed, script tsx) → `after()` lève → no-op silencieux
 * (jamais d'appel IA en masse sur un seed).
 */
export function scheduleAutoTranslate(model: string, recordId: string): void {
  try {
    after(async () => {
      try {
        await enqueueTranslationJobs(model, recordId);
        await processTranslationJobs();
      } catch (e) {
        console.error("scheduleAutoTranslate", e);
      }
    });
  } catch {
    // `after()` hors d'un cycle requête → on ignore (pas de traitement en masse).
  }
}
