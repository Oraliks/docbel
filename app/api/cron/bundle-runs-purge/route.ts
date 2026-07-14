import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { cronAuthError } from "@/lib/booking/notify";
import { retentionCutoffs } from "@/lib/bundles/retention";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = { "Content-Type": "application/json; charset=utf-8" };

/// Rétention RGPD des BundleRun. Quotidien (nuit).
///   - suppression définitive des runs inactifs depuis > HARD_DELETE_DAYS,
///   - anonymisation des runs inactifs depuis > ANONYMIZE_DAYS (payloads + PII
///     vidés, code de reprise neutralisé).
/// Auth via CRON_SECRET (cronAuthError), comme les autres crons.
async function run(req: NextRequest) {
  const authErr = cronAuthError(req);
  if (authErr) {
    return NextResponse.json(
      { error: authErr.message },
      { status: authErr.status, headers: json },
    );
  }

  const { anonymizeBefore, deleteBefore, draftBefore } = retentionCutoffs(new Date());

  // 1. Suppression définitive (runs les plus anciens) — évite de les
  //    anonymiser inutilement juste avant suppression.
  const deleted = await prisma.bundleRun.deleteMany({
    where: { updatedAt: { lt: deleteBefore } },
  });

  // 2. Anonymisation des runs inactifs non encore anonymisés : on vide tout ce
  //    qui pourrait identifier ou réidentifier le dossier — y compris le
  //    brouillon en cours (draftPayloads) et les repères de reprise (Lot 3).
  const anonymized = await prisma.bundleRun.updateMany({
    where: { updatedAt: { lt: anonymizeBefore }, anonymizedAt: null },
    data: {
      payloads: {},
      eligibilityAnswers: {},
      completedTemplateIds: [],
      resumeEmail: null,
      sessionId: null,
      resumeCode: null,
      resumeCodeHash: null,
      draftPayloads: Prisma.DbNull,
      lastFormId: null,
      lastStepId: null,
      lastActiveField: null,
      anonymizedAt: new Date(),
    },
  });

  // 3. Purge des brouillons EN COURS non validés (Lot 3, TTL 7 jours) : on vide
  //    `draftPayloads` + les repères de reprise SANS supprimer le run — les
  //    `payloads` déjà validés et le code de reprise survivent. Ne cible que les
  //    runs porteurs d'un brouillon (draftPayloads non null) inactifs depuis > 7j.
  const draftPurged = await prisma.bundleRun.updateMany({
    where: { updatedAt: { lt: draftBefore }, draftPayloads: { not: Prisma.DbNull } },
    data: {
      draftPayloads: Prisma.DbNull,
      lastFormId: null,
      lastStepId: null,
      lastActiveField: null,
    },
  });

  return NextResponse.json(
    { ok: true, deleted: deleted.count, anonymized: anonymized.count, draftPurged: draftPurged.count },
    { headers: json },
  );
}

export async function POST(req: NextRequest) {
  return run(req);
}
export async function GET(req: NextRequest) {
  return run(req);
}
