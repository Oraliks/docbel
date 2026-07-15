import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireAdminAuth } from "@/lib/auth-check";
import { scheduleAutoTranslate } from "@/lib/i18n/auto-translate";
import { findTreesReferencingBundle } from "@/lib/decision-builder/references";
import { getDossier } from "@/lib/dossiers/registry";
import {
  normalizeAdminCondition,
  updateBundleSchema,
  validateBundleItemReferences,
} from "@/lib/bundles/admin-schema";
import { apiError, apiOk } from "@/lib/api/response";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const bundle = await prisma.documentBundle.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: { order: "asc" },
        include: {
          pdfForm: { select: { id: true, slug: true, title: true, issuer: true } },
        },
      },
    },
  });
  if (!bundle) return apiError(404, "Introuvable", { code: "not_found" });
  return apiOk(bundle);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;
  const { id } = await params;

  const parsed = updateBundleSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) {
    return apiError(400, "Données invalides", {
      code: "validation_error",
      details: parsed.error.flatten(),
    });
  }
  const body = parsed.data;

  const currentBundle = await prisma.documentBundle.findUnique({
    where: { id },
    select: { slug: true },
  });
  if (!currentBundle) {
    return apiError(404, "Introuvable", { code: "not_found" });
  }

  // Garde-fou d'intégrité : désactiver via ce PUT (active:false) casserait un
  // arbre PUBLIÉ pointant vers ce dossier. Refuser sauf ?force=true (même règle
  // que le DELETE). Une simple édition (sans toucher `active`) n'est pas gênée.
  if (body.active === false) {
    const force = new URL(req.url).searchParams.get("force") === "true";
    if (!force) {
      const refs = (
        await findTreesReferencingBundle(currentBundle.slug)
      ).filter((r) => r.inPublished);
      if (refs.length > 0) {
        return apiError(
          409,
          `Ce dossier est référencé par ${refs.length} arbre(s) d'orientation publié(s). Le désactiver casserait ces parcours.`,
          {
            code: "referenced_by_published_tree",
            details: {
              trees: refs.map((r) => ({ id: r.treeId, title: r.treeTitle })),
            },
          },
        );
      }
    }
  }

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.description !== undefined) data.description = body.description;
  if (body.icon !== undefined) data.icon = body.icon;
  if (body.color !== undefined) data.color = body.color;
  if (body.order !== undefined) data.order = body.order;
  if (body.active !== undefined) data.active = !!body.active;

  // Champs onboarding (migration 12)
  if (body.lifeEventCategory !== undefined) {
    data.lifeEventCategory = body.lifeEventCategory;
  }
  if (body.showOnOnboarding !== undefined) {
    data.showOnOnboarding = !!body.showOnOnboarding;
  }
  if (body.vocabularyTags !== undefined) {
    data.vocabularyTags =
      body.vocabularyTags as unknown as Prisma.InputJsonValue;
  }
  if (body.eligibilityQuestions !== undefined) {
    if (getDossier(currentBundle.slug)) {
      return apiError(409, "Questionnaire piloté par le code", {
        code: "code_driven_eligibility",
      });
    }
    data.eligibilityQuestions =
      body.eligibilityQuestions as unknown as Prisma.InputJsonValue;
  }
  if (body.warnings !== undefined) {
    data.warnings = body.warnings as unknown as Prisma.InputJsonValue;
  }

  if (body.items !== undefined) {
    const refs = validateBundleItemReferences(body.items);
    if (!refs.ok) {
      return apiError(400, "Condition de document invalide", {
        code: "invalid_condition_reference",
        details: refs,
      });
    }
    const pdfFormIds = body.items.map((item) => item.pdfFormId);
    const publishedCount = await prisma.pdfForm.count({
      where: { id: { in: pdfFormIds }, status: "published" },
    });
    if (publishedCount !== pdfFormIds.length) {
      return apiError(400, "Un formulaire PDF est introuvable ou non publié", {
        code: "invalid_pdf_form",
      });
    }
  }

  // Le remplacement des items et la mise à jour des métadonnées forment
  // une seule unité : aucune erreur intermédiaire ne peut laisser le dossier vide.
  const updated = await prisma.$transaction(async (tx) => {
    if (body.items !== undefined) {
      await tx.documentBundleItem.deleteMany({ where: { bundleId: id } });
      if (body.items.length > 0) {
        await tx.documentBundleItem.createMany({
          data: body.items.map((item) => ({
            bundleId: id,
            pdfFormId: item.pdfFormId,
            order: item.order,
            required: item.required,
            condition: (item.condition === null
              ? Prisma.JsonNull
              : normalizeAdminCondition(item.condition)) as unknown as Prisma.InputJsonValue,
          })),
        });
      }
    }

    return tx.documentBundle.update({
      where: { id },
      data,
      include: {
        items: {
          orderBy: { order: "asc" },
          include: {
            pdfForm: {
              select: { id: true, slug: true, title: true, issuer: true },
            },
          },
        },
      },
    });
  });

  // Auto-traduction NL/EN si name/description a changé (statut "ia", à relire).
  if (body.name !== undefined || body.description !== undefined) {
    scheduleAutoTranslate("DocumentBundle", updated.id);
  }

  return apiOk(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;
  const { id } = await params;

  // Soft-delete par défaut (préserve l'historique). Hard-delete si ?hard=true.
  const url = new URL(req.url);
  const hard = url.searchParams.get("hard") === "true";
  const force = url.searchParams.get("force") === "true";

  // Garde-fou d'intégrité : refuser (sauf ?force=true) si un arbre d'orientation
  // PUBLIÉ pointe vers ce dossier — le désactiver casserait ce parcours en prod.
  if (!force) {
    const bundle = await prisma.documentBundle.findUnique({
      where: { id },
      select: { slug: true },
    });
    if (bundle) {
      const refs = (await findTreesReferencingBundle(bundle.slug)).filter(
        (r) => r.inPublished,
      );
      if (refs.length > 0) {
        return apiError(
          409,
          `Ce dossier est référencé par ${refs.length} arbre(s) d'orientation publié(s). Le désactiver casserait ces parcours.`,
          {
            code: "referenced_by_published_tree",
            details: {
              trees: refs.map((r) => ({ id: r.treeId, title: r.treeTitle })),
            },
          },
        );
      }
    }
  }

  if (hard) {
    await prisma.documentBundle.delete({ where: { id } });
    return apiOk({ ok: true, hardDeleted: true });
  }

  // Vérifier s'il y a des runs en cours (auquel cas on force le soft-delete)
  const runCount = await prisma.bundleRun.count({ where: { bundleId: id } });
  await prisma.documentBundle.update({
    where: { id },
    data: { active: false },
  });
  return apiOk({
    ok: true,
    softDeleted: true,
    runCount,
    message: runCount > 0
      ? `Bundle désactivé (${runCount} run(s) historique préservé(s)).`
      : "Bundle désactivé.",
  });
}
