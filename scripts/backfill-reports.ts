import { prisma } from "@/lib/prisma";
import { mapLegacyStatus } from "@/lib/reports/engine";

/// Copie non destructive des 4 anciennes tables vers Report. Les anciennes
/// tables ne sont ni vidées ni supprimées. Idempotent : ré-exécutable sans
/// dupliquer (vérifie l'absence d'un Report déjà backfillé via un marqueur
/// dans payload._legacyId avant insertion).
async function alreadyBackfilled(legacyId: string): Promise<boolean> {
  const existing = await prisma.report.findFirst({
    where: { payload: { path: ["_legacyId"], equals: legacyId } },
    select: { id: true },
  });
  return !!existing;
}

async function backfillBureauReports() {
  const rows = await prisma.bureauReport.findMany();
  let created = 0;
  for (const r of rows) {
    if (await alreadyBackfilled(r.id)) continue;
    await prisma.report.create({
      data: {
        type: "bureau",
        status: mapLegacyStatus(r.status as never),
        message: r.message,
        targetId: r.bureauId,
        payload: { category: r.category, _legacyId: r.id },
        reporterEmail: r.reporterEmail,
        ipHash: r.ipHash,
        userAgent: r.userAgent,
        adminNote: r.adminNotes,
        resolvedById: r.resolvedBy,
        resolvedAt: r.resolvedAt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      },
    });
    created++;
  }
  console.log(`BureauReport → Report : ${created}/${rows.length} créés`);
}

async function backfillFormValidationReports() {
  const rows = await prisma.formValidationReport.findMany();
  let created = 0;
  for (const r of rows) {
    if (await alreadyBackfilled(r.id)) continue;
    await prisma.report.create({
      data: {
        type: "form_validation",
        status: mapLegacyStatus(r.status as never),
        message: r.userMessage,
        targetId: r.formId,
        payload: {
          fieldId: r.fieldId, fieldType: r.fieldType, rejectedValue: r.rejectedValue,
          errorMessage: r.errorMessage, formSlug: r.formSlug, locale: r.locale, _legacyId: r.id,
        },
        reporterEmail: r.reporterEmail,
        ipHash: r.ipHash,
        userAgent: r.userAgent,
        adminNote: r.adminNotes,
        resolvedById: r.resolvedBy,
        resolvedAt: r.resolvedAt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      },
    });
    created++;
  }
  console.log(`FormValidationReport → Report : ${created}/${rows.length} créés`);
}

async function backfillTrainingReports() {
  const rows = await prisma.trainingReport.findMany();
  let created = 0;
  for (const r of rows) {
    if (await alreadyBackfilled(r.id)) continue;
    await prisma.report.create({
      data: {
        type: "training",
        status: mapLegacyStatus(r.status as never),
        message: r.message,
        targetId: r.trainingId,
        payload: { reason: r.reason, _legacyId: r.id },
        reporterEmail: r.reporterEmail,
        reporterId: r.reporterId,
        adminNote: r.adminNote,
        actionTaken: r.actionTaken,
        resolvedById: r.resolvedById,
        resolvedAt: r.resolvedAt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      },
    });
    created++;
  }
  console.log(`TrainingReport → Report : ${created}/${rows.length} créés`);
}

async function backfillTranslationSuggestions() {
  const rows = await prisma.translationSuggestion.findMany();
  let created = 0;
  for (const r of rows) {
    if (await alreadyBackfilled(r.id)) continue;
    await prisma.report.create({
      data: {
        type: "translation",
        status: mapLegacyStatus(r.status as never),
        message: r.comment,
        targetId: r.uiKey ?? r.recordId,
        payload: {
          locale: r.locale, model: r.model, recordId: r.recordId, field: r.field,
          uiKey: r.uiKey, sourceText: r.sourceText, currentText: r.currentText,
          suggestedText: r.suggestedText, _legacyId: r.id,
        },
        reporterEmail: r.submittedBy,
        resolvedById: r.reviewedBy,
        resolvedAt: r.reviewedAt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      },
    });
    created++;
  }
  console.log(`TranslationSuggestion → Report : ${created}/${rows.length} créés`);
}

async function main() {
  await backfillBureauReports();
  await backfillFormValidationReports();
  await backfillTrainingReports();
  await backfillTranslationSuggestions();
  console.log("Backfill terminé.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
