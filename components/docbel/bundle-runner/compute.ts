/// Logique PURE du parcours de dossier (BundleRunner), extraite pour être
/// testable sans React. Calcule, à partir des items d'un bundle + des payloads
/// collectés + des réponses d'orientation, quels documents sont visibles,
/// complétés, cachés, et si tous les obligatoires sont faits.

import {
  evaluateCondition,
  type BundleCondition,
  type CollectedPayloads,
} from "@/lib/bundles/conditions";

export interface BundleItem {
  id: string;
  templateId: string | null;
  pdfFormId: string | null;
  order: number;
  required: boolean;
  condition: BundleCondition;
  template: null;
  /// True si cet item a été matérialisé dynamiquement par un trigger d'un
  /// autre formulaire (cf. lib/pdf-forms/triggers.ts).
  triggered?: boolean;
  pdfForm: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    issuer: string | null;
  } | null;
}

export function itemSourceId(item: BundleItem): string {
  return item.pdfFormId ?? item.id;
}
export function itemTitle(item: BundleItem): string {
  return item.pdfForm?.title ?? "Document";
}
export function itemDescription(item: BundleItem): string | null {
  return item.pdfForm?.description ?? null;
}
export function itemOrganismeLabel(
  item: BundleItem,
): { label: string; color: string } | null {
  if (item.pdfForm?.issuer) return { label: item.pdfForm.issuer, color: "#666" };
  return null;
}

export interface ItemStatus {
  item: BundleItem;
  completed: boolean;
  /// `false` = hors dossier / condition non remplie ; `true` = applicable ;
  /// `"pending"` = condition en attente d'autres réponses.
  eligibility: boolean | "pending";
  /// `true` si cet item est marqué `gatedByRestOfDossier` (cf.
  /// lib/dossiers/types.ts) ET qu'il manque au moins un autre document
  /// obligatoire+applicable, ou que les questions d'aiguillage n'ont pas
  /// encore de réponse. Toujours `false` pour un item non gated.
  locked: boolean;
}

export interface ComputedRunner {
  itemStatuses: ItemStatus[];
  visibleItems: ItemStatus[];
  hiddenItems: ItemStatus[];
  completedCount: number;
  requiredVisible: ItemStatus[];
  allRequiredDone: boolean;
}

export interface ComputeItemStatusesOptions {
  /// Toutes les questions de `dossier.questions` ont-elles une réponse ? Cf.
  /// `eligibilityCompleted` déjà calculé dans BundleRunner. Absent = true
  /// (aucun impact pour les dossiers qui n'utilisent pas `gatedSlugs`).
  eligibilityAnswersComplete?: boolean;
  /// Slugs des items marqués `gatedByRestOfDossier` dans ce dossier (0 ou 1
  /// en pratique aujourd'hui — jamais plus d'un, cf. commentaire du type).
  gatedSlugs?: string[];
}

/// Calcule les statuts des items. `applicableSlugs` (dossier codé) écrase la
/// visibilité : un item dont le slug n'est pas applicable est caché, peu
/// importe sa condition JSON.
export function computeItemStatuses(
  items: BundleItem[],
  completedTemplateIds: string[],
  payloads: CollectedPayloads,
  applicableSlugs: string[] | null | undefined,
  opts: ComputeItemStatusesOptions = {},
): ComputedRunner {
  const applicableSet = applicableSlugs ? new Set(applicableSlugs) : null;
  const gatedSlugs = new Set(opts.gatedSlugs ?? []);
  const eligibilityAnswersComplete = opts.eligibilityAnswersComplete ?? true;

  const baseStatuses = items.map((item) => {
    const completed = completedTemplateIds.includes(itemSourceId(item));
    const slug = item.pdfForm?.slug ?? null;
    const inDossier =
      applicableSet === null || (slug !== null && applicableSet.has(slug));
    const conditionRes = evaluateCondition(item.condition, payloads);
    const eligibility = inDossier ? conditionRes : false;
    return { item, completed, eligibility };
  });

  // Ensemble des slugs "obligatoire + actuellement applicable" — sert au
  // calcul du verrou. Un item gated s'exclut lui-même de cette liste (il ne
  // peut pas dépendre de sa propre complétion).
  const requiredApplicableSlugs = new Set(
    baseStatuses
      .filter((s) => s.item.required && s.eligibility === true && s.item.pdfForm?.slug)
      .map((s) => s.item.pdfForm!.slug),
  );

  const itemStatuses: ItemStatus[] = baseStatuses.map((s) => {
    const slug = s.item.pdfForm?.slug ?? null;
    let locked = false;
    if (slug && gatedSlugs.has(slug)) {
      if (!eligibilityAnswersComplete) {
        locked = true;
      } else {
        const othersRequired = [...requiredApplicableSlugs].filter((other) => other !== slug);
        const othersMissing = othersRequired.some((other) => {
          const otherItem = baseStatuses.find((o) => o.item.pdfForm?.slug === other);
          return !otherItem?.completed;
        });
        locked = othersMissing;
      }
    }
    return { ...s, locked };
  });

  const visibleItems = itemStatuses.filter(
    ({ eligibility }) => eligibility !== false,
  );
  const hiddenItems = itemStatuses.filter(
    ({ eligibility }) => eligibility === false,
  );
  const completedCount = visibleItems.filter((s) => s.completed).length;
  const requiredVisible = visibleItems.filter(
    (s) => s.item.required && s.eligibility === true,
  );
  const allRequiredDone = requiredVisible.every((s) => s.completed);

  return {
    itemStatuses,
    visibleItems,
    hiddenItems,
    completedCount,
    requiredVisible,
    allRequiredDone,
  };
}
