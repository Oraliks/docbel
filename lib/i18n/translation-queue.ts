import "server-only";
import { prisma, withDbRetry } from "@/lib/prisma";
import { hasAnthropicKey } from "@/lib/chomage-ia/anthropic";
import { translateTexts, isTranslatableLocale } from "./translate";
import {
  getSourceTexts,
  sourceKey,
  normalizeModel,
  hashSource,
  SOURCE_FIELDS,
  type SourceItem,
} from "./content-source";

/**
 * File d'attente DURABLE de traduction du contenu DB (remplace l'auto-trad
 * fire-and-forget). À chaque save FR on ENQUEUE un job par champ/locale ; le
 * traitement (déclenché par `after()`) écrit les ContentTranslation, mais les
 * jobs survivent en base → reprise en cas d'échec via l'endpoint admin.
 */

/** Langues publiques cibles de l'auto-traduction. */
const AUTO_LOCALES = ["nl", "en"] as const;
/** Statuts protégés : ne jamais réécraser une trad validée à la main. */
const PROTECTED = new Set(["reviewed", "published"]);

const ct = (model: string, recordId: string, field: string, locale: string) => ({
  model_recordId_field_locale: { model, recordId, field, locale },
});

/**
 * Crée/réveille les jobs pour un record qui vient d'être sauvé en FR.
 * - 1 job par (model, recordId, field, locale) avec le hash de la source FR.
 * - Unicité sur (…, sourceHash) → re-save identique = pas de doublon ; FR
 *   modifié = nouveau job (l'ancien hash devient obsolète).
 * - Ne crée pas de job pour une cible déjà validée (reviewed/published).
 * - Un job "failed" existant pour le même hash est remis "pending" (retry auto
 *   au prochain save).
 */
export async function enqueueTranslationJobs(
  model: string,
  recordId: string
): Promise<number> {
  const camel = normalizeModel(model);
  const fields = SOURCE_FIELDS[camel];
  if (!fields || fields.length === 0) return 0;

  const items: SourceItem[] = fields.map((f) => ({ model, recordId, field: f }));
  const sources = await getSourceTexts(items);

  const existingTr = await withDbRetry(() =>
    prisma.contentTranslation.findMany({ where: { model, recordId } })
  );
  const trMap = new Map(existingTr.map((r) => [`${r.field}:${r.locale}`, r]));

  const existingJobs = await withDbRetry(() =>
    prisma.translationJob.findMany({ where: { model, recordId } })
  );
  const jobMap = new Map(
    existingJobs.map((j) => [`${j.field}:${j.locale}:${j.sourceHash}`, j])
  );

  const toCreate: Array<{
    model: string;
    recordId: string;
    field: string;
    locale: string;
    sourceHash: string;
  }> = [];
  const toRepend: string[] = [];

  for (const locale of AUTO_LOCALES) {
    if (!isTranslatableLocale(locale)) continue;
    for (const field of fields) {
      const fr = sources.get(sourceKey(model, recordId, field)) ?? "";
      if (!fr.trim()) continue;
      const ex = trMap.get(`${field}:${locale}`);
      if (ex && PROTECTED.has(ex.status)) continue; // validé → on n'enqueue pas
      const sourceHash = hashSource(fr);
      const job = jobMap.get(`${field}:${locale}:${sourceHash}`);
      if (!job) toCreate.push({ model, recordId, field, locale, sourceHash });
      else if (job.status === "failed") toRepend.push(job.id);
      // sinon (pending/processing/done même hash) → rien à faire
    }
  }

  if (toCreate.length > 0) {
    await withDbRetry(() =>
      prisma.translationJob.createMany({ data: toCreate, skipDuplicates: true })
    );
  }
  if (toRepend.length > 0) {
    await withDbRetry(() =>
      prisma.translationJob.updateMany({
        where: { id: { in: toRepend } },
        data: { status: "pending", lastError: null },
      })
    );
  }
  return toCreate.length + toRepend.length;
}

/**
 * Traite un lot de jobs "pending" : traduit par locale, écrit les
 * ContentTranslation (statut ia, protège reviewed/published), marque les jobs
 * done/failed. Best-effort, idempotent. Renvoie un petit bilan.
 */
export async function processTranslationJobs(
  { limit = 60 }: { limit?: number } = {}
): Promise<{ processed: number; done: number; failed: number }> {
  if (!hasAnthropicKey()) return { processed: 0, done: 0, failed: 0 };

  const jobs = await withDbRetry(() =>
    prisma.translationJob.findMany({
      where: { status: "pending" },
      take: limit,
      orderBy: { createdAt: "asc" },
    })
  );
  if (jobs.length === 0) return { processed: 0, done: 0, failed: 0 };

  const ids = jobs.map((j) => j.id);
  await withDbRetry(() =>
    prisma.translationJob.updateMany({
      where: { id: { in: ids } },
      data: { status: "processing" },
    })
  );

  const items: SourceItem[] = jobs.map((j) => ({
    model: j.model,
    recordId: j.recordId,
    field: j.field,
  }));
  const sources = await getSourceTexts(items);

  let done = 0;
  let failed = 0;

  // Groupe par locale → 1 appel IA par lot de locale.
  const byLocale = new Map<string, typeof jobs>();
  for (const j of jobs) {
    if (!byLocale.has(j.locale)) byLocale.set(j.locale, []);
    byLocale.get(j.locale)!.push(j);
  }

  for (const [locale, localeJobs] of byLocale) {
    // Valide = source FR non vide ET hash inchangé depuis la création du job
    // (sinon le job est obsolète : un nouveau job couvre la nouvelle source).
    const valid: Array<{ job: (typeof jobs)[number]; fr: string }> = [];
    const obsolete: string[] = [];
    for (const job of localeJobs) {
      const fr = sources.get(sourceKey(job.model, job.recordId, job.field)) ?? "";
      if (fr.trim() && hashSource(fr) === job.sourceHash) valid.push({ job, fr });
      else obsolete.push(job.id);
    }
    if (obsolete.length > 0) {
      await withDbRetry(() =>
        prisma.translationJob.updateMany({
          where: { id: { in: obsolete } },
          data: { status: "done" },
        })
      );
      done += obsolete.length;
    }
    if (valid.length === 0) continue;

    let translations: string[];
    try {
      translations = await translateTexts(valid.map((v) => v.fr), locale);
    } catch (e) {
      await withDbRetry(() =>
        prisma.translationJob.updateMany({
          where: { id: { in: valid.map((v) => v.job.id) } },
          data: {
            status: "failed",
            attempts: { increment: 1 },
            lastError: String(e).slice(0, 500),
          },
        })
      );
      failed += valid.length;
      continue;
    }

    for (let i = 0; i < valid.length; i++) {
      const { job } = valid[i];
      const value = translations[i];
      try {
        if (value && value.trim()) {
          const ex = await withDbRetry(() =>
            prisma.contentTranslation.findUnique({
              where: ct(job.model, job.recordId, job.field, locale),
            })
          );
          if (!ex || !PROTECTED.has(ex.status)) {
            if (!ex || ex.value !== value) {
              const now = new Date();
              await withDbRetry(() =>
                prisma.contentTranslation.upsert({
                  where: ct(job.model, job.recordId, job.field, locale),
                  create: {
                    model: job.model,
                    recordId: job.recordId,
                    field: job.field,
                    locale,
                    value,
                    status: "ia",
                    origin: "ia",
                    updatedBy: "ai:auto",
                    sourceHash: job.sourceHash,
                    sourceUpdatedAt: now,
                  },
                  update: {
                    value,
                    status: "ia",
                    origin: "ia",
                    updatedBy: "ai:auto",
                    sourceHash: job.sourceHash,
                    sourceUpdatedAt: now,
                  },
                })
              );
            }
          }
        }
        await withDbRetry(() =>
          prisma.translationJob.update({
            where: { id: job.id },
            data: { status: "done", attempts: { increment: 1 } },
          })
        );
        done++;
      } catch (e) {
        await withDbRetry(() =>
          prisma.translationJob.update({
            where: { id: job.id },
            data: {
              status: "failed",
              attempts: { increment: 1 },
              lastError: String(e).slice(0, 500),
            },
          })
        );
        failed++;
      }
    }
  }

  return { processed: jobs.length, done, failed };
}

/** Remet "pending" les jobs failed (et les "processing" bloqués) → relance. */
export async function requeueFailedJobs(): Promise<number> {
  const res = await withDbRetry(() =>
    prisma.translationJob.updateMany({
      where: { status: { in: ["failed", "processing"] } },
      data: { status: "pending", lastError: null },
    })
  );
  return res.count;
}
