/// Reprise fine d'un dossier PDF (Lot 3) — helpers PURS, sans aucune
/// dépendance (testables en isolation).
///
/// On persiste côté serveur `lastFormId` + `lastStepId` : l'identifiant STABLE
/// de la dernière étape vue (`MacroStep.id` / `CoreStep.id`), JAMAIS un index
/// numérique — la liste d'étapes visibles est dynamique (`visibleIf`), un index
/// ne survivrait pas à un changement de réponse.

/// Étape à reprendre pour CE formulaire : on ne restaure `lastStepId` que si le
/// dernier formulaire actif du run correspond bien à `formId` (sinon on repart
/// du début — la reprise concerne un autre document du dossier).
export function pickInitialStepId(
  lastFormId: string | null | undefined,
  lastStepId: string | null | undefined,
  formId: string,
): string | undefined {
  return lastFormId === formId ? (lastStepId ?? undefined) : undefined;
}

/// Résout un id d'étape stable vers son index dans la liste ORDONNÉE courante
/// des étapes. Retourne 0 quand la cible est absente / introuvable (l'étape a
/// pu disparaître via `visibleIf` entre deux sessions) ou indéfinie.
export function resolveStepIndexById(stepIds: string[], targetId: string | undefined): number {
  if (!targetId) return 0;
  const idx = stepIds.indexOf(targetId);
  return idx >= 0 ? idx : 0;
}
