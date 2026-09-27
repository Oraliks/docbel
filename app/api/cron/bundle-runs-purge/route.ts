import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { cronAuthError } from "@/lib/booking/notify";
import { retentionCutoffs } from "@/lib/bundles/retention";
import { apiError, apiOk } from "@/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/// Rétention RGPD des BundleRun. Quotidien (nuit).
///   - suppression définitive des runs inactifs depuis > HARD_DELETE_DAYS,
///   - anonymisation des runs inactifs depuis > ANONYMIZE_DAYS (payloads + PII
///     vidés, code de reprise neutralisé).
/// Auth via CRON_SECRET (cronAuthError), comme les autres crons.
async function run(req: NextRequest) {
  const authErr = cronAuthError(req);
  if (authErr) {
    return apiError(authErr.status, authErr.message);
  }

  const now = new Date();
  const { anonymizeBefore, deleteBefore, draftBefore } = retentionCutoffs(now);

  // 1. Suppression définitive (runs les plus anciens) — évite de les
  //    anonymiser inutilement juste avant suppression.
  const deleted = await prisma.bundleRun.deleteMany({
    where: { updatedAt: { lt: deleteBefore } },
  });

  // 2. Anonymisation des runs inactifs non encore anonymisés : on vide tout ce
  //    qui pourrait identifier ou réidentifier le dossier — y compris le
  //    brouillon en cours (draftPayloads) et les repères de reprise (Lot 3).
  // SQL explicite pour préserver updatedAt. Prisma @updatedAt ferait passer
  // l'entretien pour une activité utilisateur et repousserait les échéances.
  // Garder ces champs alignés avec ANONYMIZATION_RESET_FIELDS.
  const anonymized = await prisma.$executeRaw`
    UPDATE "BundleRun" SET
      "payloads" = '{}'::jsonb, "eligibilityAnswers" = '{}'::jsonb,
      "orientationAnswers" = NULL, "completedTemplateIds" = '[]'::jsonb,
      "resumeEmail" = NULL, "userId" = NULL, "sessionId" = NULL,
      "resumeCode" = NULL, "resumeCodeHash" = NULL, "draftPayloads" = NULL,
      "lastFormId" = NULL, "lastStepId" = NULL, "lastActiveField" = NULL,
      "anonymizedAt" = ${now}
    WHERE "updatedAt" < ${anonymizeBefore} AND "anonymizedAt" IS NULL
  `;

  // 3. Purge des brouillons EN COURS non validés (Lot 3, TTL 7 jours) : on vide
  //    `draftPayloads` + les repères de reprise SANS supprimer le run — les
  //    `payloads` déjà validés et le code de reprise survivent. Ne cible que les
  //    runs porteurs d'un brouillon (draftPayloads non null) inactifs depuis > 7j.
  const draftPurged = await prisma.$executeRaw`
    UPDATE "BundleRun" SET "draftPayloads" = NULL, "lastFormId" = NULL,
      "lastStepId" = NULL, "lastActiveField" = NULL
    WHERE "updatedAt" < ${draftBefore} AND "draftPayloads" IS NOT NULL
  `;

  return apiOk({ ok: true, deleted: deleted.count, anonymized, draftPurged });
}

export async function POST(req: NextRequest) {
  return run(req);
}
export async function GET(req: NextRequest) {
  return run(req);
}
