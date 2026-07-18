/// Plafond souple de demandes éditables par (dossier, citoyen). Anti-abus,
/// jamais atteint en usage normal.
export const MAX_EDITABLE_RUNS_PER_BUNDLE = 20;

export type ForceNewAction =
  | { kind: "reuse"; runId: string }
  | { kind: "create" }
  | { kind: "too_many" };

/// Décide ce que fait « Nouvelle demande » (forceNew) :
///  - un run VIDE existe déjà → on le réutilise (pas de doublon fantôme) ;
///  - sinon, au-delà du plafond → refus (`too_many`) ;
///  - sinon → création d'un nouveau run.
export function resolveForceNewAction(
  existingEditable: { id: string; hasProgress: boolean }[],
  cap: number = MAX_EDITABLE_RUNS_PER_BUNDLE,
): ForceNewAction {
  const empty = existingEditable.find((r) => !r.hasProgress);
  if (empty) return { kind: "reuse", runId: empty.id };
  if (existingEditable.length >= cap) return { kind: "too_many" };
  return { kind: "create" };
}
