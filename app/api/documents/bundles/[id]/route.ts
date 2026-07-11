import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireAdminAuth } from "@/lib/auth-check";
import { parseEligibilityQuestions } from "@/lib/bundles/eligibility";
import { parseVocabularyTags } from "@/lib/bundles/vocabulary";
import { parseBundleWarnings } from "@/lib/bundles/types";
import { scheduleAutoTranslate } from "@/lib/i18n/auto-translate";
import { findTreesReferencingBundle } from "@/lib/decision-builder/references";

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
  if (!bundle) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  return NextResponse.json(bundle);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;
  const { id } = await params;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Garde-fou d'intégrité : désactiver via ce PUT (active:false) casserait un
  // arbre PUBLIÉ pointant vers ce dossier. Refuser sauf ?force=true (même règle
  // que le DELETE). Une simple édition (sans toucher `active`) n'est pas gênée.
  if (body.active === false) {
    const force = new URL(req.url).searchParams.get("force") === "true";
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
          return NextResponse.json(
            {
              error: "referenced_by_published_tree",
              message: `Ce dossier est référencé par ${refs.length} arbre(s) d'orientation publié(s). Le désactiver casserait ces parcours.`,
              trees: refs.map((r) => ({ id: r.treeId, title: r.treeTitle })),
            },
            { status: 409 },
          );
        }
      }
    }
  }

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.description !== undefined) data.description = body.description || null;
  if (body.icon !== undefined) data.icon = body.icon || null;
  if (body.color !== undefined) data.color = body.color || "#7C3AED";
  if (body.order !== undefined) data.order = body.order;
  if (body.active !== undefined) data.active = !!body.active;

  // Champs onboarding (migration 12)
  if (body.lifeEventCategory !== undefined) {
    data.lifeEventCategory = body.lifeEventCategory || null;
  }
  if (body.showOnOnboarding !== undefined) {
    data.showOnOnboarding = !!body.showOnOnboarding;
  }
  if (body.vocabularyTags !== undefined) {
    data.vocabularyTags = parseVocabularyTags(body.vocabularyTags) as unknown as Prisma.InputJsonValue;
  }
  if (body.eligibilityQuestions !== undefined) {
    data.eligibilityQuestions = parseEligibilityQuestions(body.eligibilityQuestions) as unknown as Prisma.InputJsonValue;
  }
  if (body.warnings !== undefined) {
    data.warnings = parseBundleWarnings(body.warnings) as unknown as Prisma.InputJsonValue;
  }

  // Mise à jour des items (remplacement complet de la liste).
  if (Array.isArray(body.items)) {
    await prisma.documentBundleItem.deleteMany({ where: { bundleId: id } });
    type IncomingItem = {
      pdfFormId?: string | null;
      order?: number;
      required?: boolean;
      condition?: unknown;
    };
    const items = (body.items as IncomingItem[]).filter((it) => !!it.pdfFormId);
    if (items.length > 0) {
      await prisma.documentBundleItem.createMany({
        data: items.map((it, idx) => ({
          bundleId: id,
          pdfFormId: it.pdfFormId!,
          order: typeof it.order === "number" ? it.order : idx,
          required: it.required !== false,
          condition: (it.condition ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        })),
      });
    }
  }

  const updated = await prisma.documentBundle.update({
    where: { id },
    data,
    include: {
      items: {
        orderBy: { order: "asc" },
        include: { pdfForm: { select: { id: true, slug: true, title: true, issuer: true } } },
      },
    },
  });

  // Auto-traduction NL/EN si name/description a changé (statut "ia", à relire).
  if (body.name !== undefined || body.description !== undefined) {
    scheduleAutoTranslate("DocumentBundle", updated.id);
  }

  return NextResponse.json(updated);
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
        return NextResponse.json(
          {
            error: "referenced_by_published_tree",
            message: `Ce dossier est référencé par ${refs.length} arbre(s) d'orientation publié(s). Le désactiver casserait ces parcours.`,
            trees: refs.map((r) => ({ id: r.treeId, title: r.treeTitle })),
          },
          { status: 409 },
        );
      }
    }
  }

  if (hard) {
    await prisma.documentBundle.delete({ where: { id } });
    return NextResponse.json({ ok: true, hardDeleted: true });
  }

  // Vérifier s'il y a des runs en cours (auquel cas on force le soft-delete)
  const runCount = await prisma.bundleRun.count({ where: { bundleId: id } });
  await prisma.documentBundle.update({
    where: { id },
    data: { active: false },
  });
  return NextResponse.json({
    ok: true,
    softDeleted: true,
    runCount,
    message: runCount > 0
      ? `Bundle désactivé (${runCount} run(s) historique préservé(s)).`
      : "Bundle désactivé.",
  });
}
