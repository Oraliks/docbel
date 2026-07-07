import type { FormPayload } from "./types";

/// Le template C1 page 2 a un widget « Date de DA » (x=506, y=810) dans le
/// header. Oraliks 2026-07-07 : « c'est celle du changement donc la date que
/// je mentionne sur le form runner ».
///
/// Ce transform remplit le champ `dateHeaderP2` (autoAnswered) avec :
///   1. `dateModificationEffective` en priorité (date du changement saisie)
///   2. `dateDemande` en fallback (date de demande d'allocations)
///
/// Le stamping applique le format FR (`DD/MM/YYYY`) via `formatDateFR` du
/// filler (cas `type === "date"`).
export function applyDateHeaderP2Derivation(values: FormPayload): FormPayload {
  const date =
    (typeof values.dateModificationEffective === "string" && values.dateModificationEffective.trim()) ||
    (typeof values.dateDemande === "string" && values.dateDemande.trim()) ||
    "";
  if (!date) return values;
  return { ...values, dateHeaderP2: date };
}
