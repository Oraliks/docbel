// Calcule si un dossier (BundleRun) est complet — tous les documents requis,
// de base ET déclenchés par les réponses données, sont-ils complétés ?
//
// Réutilisé par : la route generate (verrou download/doccle), la route
// download-all (zip), la route email — jamais dupliqué, un seul calcul.

import { prisma } from "@/lib/prisma";
import {
  computeItemStatuses,
  type BundleItem,
} from "@/components/docbel/bundle-runner/compute";
import {
  collectAllTriggeredSlugs,
  type BundleItemForTriggers,
} from "@/lib/pdf-forms/triggers";
import type { BundleCondition } from "@/lib/bundles/conditions";
import { parseEligibilityAnswers, parseEligibilityQuestions } from "@/lib/bundles/eligibility";
import { getDossier } from "@/lib/dossiers/registry";
import { selectDocuments, dossierQuestionsToEligibility, type DossierAnswers } from "@/lib/dossiers/types";
import { isBundleRunEditable } from "@/lib/bundles/run-lifecycle";

export interface MissingDoc {
  slug: string;
  title: string;
}

/// Calcul PUR : donné l'état déjà chargé d'un dossier, quels documents
/// requis (visibles, non exclus par condition/dossier) manquent encore ?
/// `allRequiredDone` vrai ⇔ `missing` vide.
///
/// `missing` est ORDONNÉ par `item.order` croissant : `missing[0]` est donc
/// toujours le VRAI prochain document à remplir (document de base avant
/// compagnon déclenché), indépendamment de l'ordre du tableau `items` reçu.
/// L'écran de continuation (§11.3) s'appuie sur cette garantie pour son CTA
/// « Continuer avec … ».
export function deriveMissingDocs(
  items: BundleItem[],
  completedTemplateIds: string[],
  payloads: Record<string, Record<string, unknown>>,
  applicableSlugs: string[] | null,
): { allRequiredDone: boolean; missing: MissingDoc[] } {
  const { requiredVisible, allRequiredDone } = computeItemStatuses(
    items,
    completedTemplateIds,
    payloads,
    applicableSlugs,
  );
  const missing: MissingDoc[] = requiredVisible
    .filter((s) => !s.completed)
    .sort((a, b) => a.item.order - b.item.order)
    .map((s) => ({
      slug: s.item.pdfForm?.slug ?? s.item.id,
      title: s.item.pdfForm?.title ?? "Document",
    }));
  return { allRequiredDone, missing };
}

export interface DossierState {
  run: { id: string; bundleSlug: string; bundleName: string };
  /// Pré-qualification (rail de démarche — étape « Ma situation »).
  hasEligibilityQuestions: boolean;
  eligibilityCompleted: boolean;
  allRequiredDone: boolean;
  missing: MissingDoc[];
  items: BundleItem[];
  completedTemplateIds: string[];
  payloads: Record<string, Record<string, unknown>>;
  /// Slugs des documents applicables au dossier codé (branche + déclenchés),
  /// ou `null` si le dossier n'est pas piloté par un module de code. Exposé
  /// pour que les consommateurs (ex. régénération zip/mail) puissent
  /// re-filtrer par éligibilité — un document complété PUIS rendu inapplicable
  /// par un changement de réponse ne doit pas être re-inclus.
  applicableSlugs: string[] | null;
}

/// Charge un BundleRun + vérifie sa propriété (userId de session, sinon
/// cookie de session anonyme) + calcule sa complétion. Retourne `null` si le
/// run n'existe pas, n'est plus `in_progress`, OU n'appartient pas à
/// l'appelant — un seul cas `null` pour ne jamais distinguer "inexistant" de
/// "pas à toi" côté réponse HTTP (évite toute fuite d'existence).
export async function loadDossierState(
  bundleRunId: string,
  ownership: { userId: string | null; sessionId: string | null },
): Promise<DossierState | null> {
  const run = await prisma.bundleRun.findUnique({
    where: { id: bundleRunId },
    include: {
      bundle: {
        include: {
          items: {
            orderBy: { order: "asc" },
            include: {
              pdfForm: {
                select: {
                  id: true,
                  slug: true,
                  title: true,
                  description: true,
                  issuer: true,
                  triggers: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!run || !isBundleRunEditable(run)) return null;
  const owns = ownership.userId
    ? run.userId === ownership.userId
    : ownership.sessionId
      ? run.sessionId === ownership.sessionId
      : false;
  if (!owns) return null;

  const payloads = (run.payloads as Record<string, Record<string, unknown>>) || {};
  const completedTemplateIds = (run.completedTemplateIds as string[]) || [];

  const triggeredSlugsList = collectAllTriggeredSlugs(
    run.bundle.items.map(
      (it): BundleItemForTriggers => ({
        pdfFormId: it.pdfFormId,
        pdfFormSlug: it.pdfForm?.slug ?? null,
        rawTriggers: it.pdfForm?.triggers,
      }),
    ),
    payloads,
  );
  const triggeredSlugs = new Set(triggeredSlugsList);

  const triggeredForms =
    triggeredSlugs.size > 0
      ? await prisma.pdfForm.findMany({
          where: { slug: { in: [...triggeredSlugs] }, status: "published", active: true },
          select: { id: true, slug: true, title: true, description: true, issuer: true },
        })
      : [];

  const items: BundleItem[] = [
    ...run.bundle.items.map((it) => ({
      id: it.id,
      templateId: null,
      pdfFormId: it.pdfFormId,
      order: it.order,
      required: it.required,
      condition: (it.condition as unknown as BundleCondition) ?? null,
      template: null,
      triggered: false as const,
      pdfForm: it.pdfForm
        ? {
            id: it.pdfForm.id,
            slug: it.pdfForm.slug,
            title: it.pdfForm.title,
            description: it.pdfForm.description,
            issuer: it.pdfForm.issuer,
          }
        : null,
    })),
    ...triggeredForms.map((f, idx) => ({
      id: `triggered-${f.id}`,
      templateId: null,
      pdfFormId: f.id,
      order: run.bundle.items.length + idx,
      required: true,
      condition: null,
      template: null,
      triggered: true as const,
      pdfForm: { id: f.id, slug: f.slug, title: f.title, description: f.description, issuer: f.issuer },
    })),
  ];

  const dossier = getDossier(run.bundle.slug);
  const eligibilityAnswers = parseEligibilityAnswers(run.eligibilityAnswers);
  // Questions de pré-qualification : le module de code prime sur la DB
  // (même logique que app/d/[slug]/page.tsx, eligibilityQuestionsSerialized).
  const eligibilityQuestions = parseEligibilityQuestions(
    dossier ? dossierQuestionsToEligibility(dossier.questions) : run.bundle.eligibilityQuestions,
  );
  const hasEligibilityQuestions = eligibilityQuestions.length > 0;
  const eligibilityCompleted =
    !hasEligibilityQuestions ||
    eligibilityQuestions.every(
      (q) => eligibilityAnswers[q.id] !== undefined && eligibilityAnswers[q.id] !== "",
    );
  const selectedDocs = dossier
    ? selectDocuments(dossier, eligibilityAnswers as unknown as DossierAnswers)
    : null;
  const applicableSlugs = selectedDocs
    ? [...selectedDocs.map((d) => d.slug), ...triggeredSlugs]
    : null;

  const { allRequiredDone, missing } = deriveMissingDocs(
    items,
    completedTemplateIds,
    payloads,
    applicableSlugs,
  );

  return {
    run: { id: run.id, bundleSlug: run.bundle.slug, bundleName: run.bundle.name },
    hasEligibilityQuestions,
    eligibilityCompleted,
    allRequiredDone,
    missing,
    items,
    completedTemplateIds,
    payloads,
    applicableSlugs,
  };
}
