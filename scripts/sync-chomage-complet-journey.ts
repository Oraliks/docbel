/**
 * Synchronise sans suppression le parcours chômage complet :
 *   - applique le schéma guidé C1 au PdfForm `c1-fr` ;
 *   - enrichit les métadonnées de découverte du bundle ;
 *   - ajoute les tags canoniques sûrs à l'arbre ONEM publié et à son draft.
 *
 * Usage :
 *   pnpm exec tsx scripts/sync-chomage-complet-journey.ts        # dry-run
 *   pnpm exec tsx scripts/sync-chomage-complet-journey.ts --yes  # applique
 */

import { Prisma } from "@prisma/client";
import { isDeepStrictEqual } from "node:util";
import { prisma } from "@/lib/prisma";
import { chomageComplet } from "@/lib/dossiers/chomage-complet";
import { deriveDossierDiscoveryMetadata } from "@/lib/dossiers/discovery";
import {
  applyOnem2026CanonicalTags,
  ONEM_2026_CANONICAL_TAGS,
} from "@/lib/decision-builder/onem-canonical";
import { parseTreeContent } from "@/lib/decision-builder/schema";
import { getRulesForSlug } from "@/lib/pdf-forms/bindings/registry";
import { checkPublishable } from "@/lib/pdf-forms/publish-checks";
import { C1_IMPROVEMENT_TARGETS } from "@/lib/pdf-forms/seed/apply-c1-improvements-core";
import type {
  AcroFieldRaw,
  Locale,
  PdfFormField,
} from "@/lib/pdf-forms/types";

const APPLY = process.argv.includes("--yes");
const BUNDLE_SLUG = "chomage-complet";
const FORM_SLUG = "c1-fr";
const TREE_SLUG = "chomage-orientation";

function sameJson(left: unknown, right: unknown): boolean {
  // Prisma réordonne les clés des objets JSON et retire les propriétés
  // `undefined`. Comparer leur forme JSON normalisée évite une écriture
  // fantôme à chaque relance du script.
  const normalize = (value: unknown): unknown =>
    value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  return isDeepStrictEqual(normalize(left), normalize(right));
}

async function main() {
  const [bundle, form, tree] = await Promise.all([
    prisma.documentBundle.findUnique({
      where: { slug: BUNDLE_SLUG },
      select: {
        id: true,
        organism: true,
        vocabularyTags: true,
        requiredDocuments: true,
        warningLevel: true,
        items: {
          orderBy: { order: "asc" },
          select: {
            required: true,
            pdfForm: {
              select: {
                slug: true,
                title: true,
                issuer: true,
                status: true,
                active: true,
              },
            },
          },
        },
      },
    }),
    prisma.pdfForm.findUnique({
      where: { slug: FORM_SLUG },
      select: {
        id: true,
        fields: true,
        triggers: true,
        technicalSchema: true,
        locales: true,
      },
    }),
    prisma.decisionTree.findUnique({
      where: { slug: TREE_SLUG },
      select: {
        id: true,
        draftContent: true,
        publishedContent: true,
        createdBy: true,
        updatedBy: true,
      },
    }),
  ]);

  if (!bundle) throw new Error(`Bundle introuvable : ${BUNDLE_SLUG}`);
  if (!form) throw new Error(`PdfForm introuvable : ${FORM_SLUG}`);
  if (!tree?.publishedContent) {
    throw new Error(`Arbre publié introuvable : ${TREE_SLUG}`);
  }
  if (!bundle.items.some((item) => item.pdfForm?.slug === FORM_SLUG)) {
    throw new Error(`Le bundle ${BUNDLE_SLUG} ne référence pas ${FORM_SLUG}`);
  }

  const target = C1_IMPROVEMENT_TARGETS.find(
    (candidate) => candidate.slug === FORM_SLUG,
  );
  if (!target) throw new Error(`Cible C1 absente : ${FORM_SLUG}`);

  const currentFields = (form.fields as unknown as PdfFormField[]) ?? [];
  const technicalSchema =
    (form.technicalSchema as unknown as AcroFieldRaw[]) ?? [];
  const improvedFields = target.improve(currentFields, { technicalSchema });
  const publishErrors = checkPublishable(
    improvedFields,
    technicalSchema,
    (form.locales as unknown as Locale[]) ?? ["fr"],
    { bindingRules: getRulesForSlug(FORM_SLUG) },
  ).filter((issue) => issue.level === "error");
  if (publishErrors.length > 0) {
    throw new Error(
      `Schéma ${FORM_SLUG} non publiable : ${publishErrors
        .map((issue) => issue.message)
        .join(" | ")}`,
    );
  }
  const formChanged =
    !sameJson(currentFields, improvedFields) ||
    !sameJson(form.triggers, target.triggers);

  const discovery = deriveDossierDiscoveryMetadata(bundle, chomageComplet);
  const nextBundle = {
    organism: bundle.organism ?? discovery.organism,
    vocabularyTags: discovery.vocabularyTags,
    requiredDocuments: discovery.requiredDocuments,
    warningLevel: bundle.warningLevel ?? "warning",
  };
  const bundleChanged =
    bundle.organism !== nextBundle.organism ||
    bundle.warningLevel !== nextBundle.warningLevel ||
    !sameJson(bundle.vocabularyTags, nextBundle.vocabularyTags) ||
    !sameJson(bundle.requiredDocuments, nextBundle.requiredDocuments);

  const currentPublished = parseTreeContent(tree.publishedContent);
  const currentDraft = parseTreeContent(tree.draftContent);
  const nextPublished = applyOnem2026CanonicalTags(currentPublished);
  const nextDraft = applyOnem2026CanonicalTags(currentDraft);
  const treeChanged =
    !sameJson(currentPublished, nextPublished) ||
    !sameJson(currentDraft, nextDraft);

  console.log(`Mode : ${APPLY ? "APPLY" : "DRY RUN"}`);
  console.log(
    `C1 ${FORM_SLUG} : ${currentFields.length} → ${improvedFields.length} champs, ` +
      `${Array.isArray(form.triggers) ? form.triggers.length : 0} → ${target.triggers.length} triggers` +
      `${formChanged ? " (à mettre à jour)" : " (déjà aligné)"}`,
  );
  console.log(
    `Dossier ${BUNDLE_SLUG} : ${discovery.requiredDocuments.length} documents de découverte, ` +
      `${discovery.vocabularyTags.length} tags${bundleChanged ? " (à mettre à jour)" : " (déjà aligné)"}`,
  );
  console.log(
    `Arbre ${TREE_SLUG} : ${Object.keys(ONEM_2026_CANONICAL_TAGS).length} options canoniques` +
      `${treeChanged ? " (à mettre à jour)" : " (déjà aligné)"}`,
  );

  if (!APPLY) {
    console.log("Dry-run terminé. Relancer avec --yes pour appliquer.");
    return;
  }
  if (!formChanged && !bundleChanged && !treeChanged) {
    console.log("Aucune modification nécessaire.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (formChanged) {
      await tx.pdfForm.update({
        where: { id: form.id },
        data: {
          fields: improvedFields as unknown as Prisma.InputJsonValue,
          triggers: target.triggers as unknown as Prisma.InputJsonValue,
        },
      });
    }

    if (bundleChanged) {
      await tx.documentBundle.update({
        where: { id: bundle.id },
        data: {
          organism: nextBundle.organism,
          vocabularyTags:
            nextBundle.vocabularyTags as unknown as Prisma.InputJsonValue,
          requiredDocuments:
            nextBundle.requiredDocuments as unknown as Prisma.InputJsonValue,
          warningLevel: nextBundle.warningLevel,
        },
      });
    }

    if (treeChanged) {
      const latestRevision = await tx.decisionTreeRevision.findFirst({
        where: { treeId: tree.id },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      const revision = await tx.decisionTreeRevision.create({
        data: {
          treeId: tree.id,
          version: (latestRevision?.version ?? 0) + 1,
          content: nextPublished as unknown as Prisma.InputJsonValue,
          changeType: "minor",
          changeNotes:
            "Raccordement du parcours guidé C1 : préremplissages canoniques modifiables.",
          diffSummary: {
            added: [],
            removed: [],
            modified: Object.keys(ONEM_2026_CANONICAL_TAGS),
          },
          publishedBy: tree.updatedBy ?? tree.createdBy,
        },
      });
      await tx.decisionTree.update({
        where: { id: tree.id },
        data: {
          draftContent: nextDraft as unknown as Prisma.InputJsonValue,
          publishedContent: nextPublished as unknown as Prisma.InputJsonValue,
          publishedAt: new Date(),
          publishedRevisionId: revision.id,
          status: "published",
        },
      });
    }
  });

  console.log("Synchronisation appliquée sans suppression.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
