import { NextRequest, NextResponse } from "next/server";
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

  const { anonymizeBefore, deleteBefore } = retentionCutoffs(new Date());

  // 1. Suppression définitive (runs les plus anciens) — évite de les
  //    anonymiser inutilement juste avant suppression.
  const deleted = await prisma.bundleRun.deleteMany({
    where: { updatedAt: { lt: deleteBefore } },
  });

  // 2. Anonymisation des runs inactifs non encore anonymisés : on vide tout ce
  //    qui pourrait identifier ou réidentifier le dossier.
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
      anonymizedAt: new Date(),
    },
  });

  return NextResponse.json(
    { ok: true, deleted: deleted.count, anonymized: anonymized.count },
    { headers: json },
  );
}

export async function POST(req: NextRequest) {
  return run(req);
}
export async function GET(req: NextRequest) {
  return run(req);
}
