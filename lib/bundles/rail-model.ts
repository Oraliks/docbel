/// Modèle PUR du rail de démarche (refonte parcours citoyen, Lot 2).
/// Dérive, depuis les mêmes données que le BundleRunner, les 3 grandes étapes
/// du rail (Ma situation / Les documents / Récupérer & envoyer) et la
/// sous-liste des documents avec leur état. Aucune dépendance React/DB.
///
/// IMPORTANT : `allRequiredDone` vient de `computeItemStatuses`, le MÊME calcul
/// que le verrou serveur 409 `dossier_incomplete` (cf. lib/bundles/completion.ts)
/// — le rail annonce donc exactement le verrou que l'API applique.

import {
  computeItemStatuses,
  type BundleItem,
} from "@/components/docbel/bundle-runner/compute";
import type { CollectedPayloads } from "@/lib/bundles/conditions";

export type RailDocState = "done" | "todo" | "pending";

export interface RailDoc {
  /// Clé stable d'affichage (item.id ; les compagnons déclenchés sont `triggered-<pdfFormId>`).
  key: string;
  slug: string;
  pdfFormId: string;
  title: string;
  state: RailDocState;
  required: boolean;
  triggered: boolean;
}

export type RailStepState = "done" | "current" | "upcoming" | "locked";

export interface DemarcheRailModel {
  /// Étape 1 — « Ma situation » (pré-qualification).
  situation: { state: RailStepState; hasQuestions: boolean };
  /// Étape 2 — « Les documents » : sous-liste + compteur (items VISIBLES
  /// remplissables par le citoyen, pdfForm non nul — même périmètre que le
  /// compteur du runner, PAS bundle.items.length comme DemandeList).
  documents: {
    state: RailStepState;
    docs: RailDoc[];
    completedCount: number;
    totalCount: number;
  };
  /// Étape 3 — « Récupérer & envoyer » : verrouillée tant que tout le requis
  /// (compagnons déclenchés inclus) n'est pas complété.
  retrieve: {
    state: RailStepState;
    /// N de l'annonce « vos PDF se déverrouillent quand les N documents… ».
    requiredCount: number;
    remainingCount: number;
  };
  allRequiredDone: boolean;
}

export interface DemarcheRailInput {
  items: BundleItem[];
  completedTemplateIds: string[];
  payloads: CollectedPayloads;
  applicableSlugs: string[] | null | undefined;
  hasEligibilityQuestions: boolean;
  eligibilityCompleted: boolean;
}

export function buildDemarcheRailModel(input: DemarcheRailInput): DemarcheRailModel {
  const { visibleItems, requiredVisible, allRequiredDone } = computeItemStatuses(
    input.items,
    input.completedTemplateIds,
    input.payloads,
    input.applicableSlugs,
  );

  const docs: RailDoc[] = visibleItems.flatMap((s) =>
    s.item.pdfForm
      ? [
          {
            key: s.item.id,
            slug: s.item.pdfForm.slug,
            pdfFormId: s.item.pdfForm.id,
            title: s.item.pdfForm.title,
            state: (s.completed
              ? "done"
              : s.eligibility === "pending"
                ? "pending"
                : "todo") as RailDocState,
            required: s.item.required,
            triggered: s.item.triggered === true,
          },
        ]
      : [],
  );

  const completedCount = docs.filter((d) => d.state === "done").length;
  const requiredCount = requiredVisible.length;
  const remainingCount = requiredVisible.filter((s) => !s.completed).length;

  const situationState: RailStepState = input.hasEligibilityQuestions
    ? input.eligibilityCompleted
      ? "done"
      : "current"
    : "done";
  const documentsState: RailStepState = allRequiredDone
    ? "done"
    : situationState === "done"
      ? "current"
      : "upcoming";
  const retrieveState: RailStepState = allRequiredDone ? "current" : "locked";

  return {
    situation: { state: situationState, hasQuestions: input.hasEligibilityQuestions },
    documents: { state: documentsState, docs, completedCount, totalCount: docs.length },
    retrieve: { state: retrieveState, requiredCount, remainingCount },
    allRequiredDone,
  };
}
