import type { FieldValue } from "./types";

/// Forme minimale acceptée — couvre PdfFormField (serveur) ET PublicField
/// (client) sans cast.
interface OnSelectSetShape {
  id: string;
  onSelectSet?: { whenValue: FieldValue; set: { fieldId: string; value: FieldValue }[] };
}

/// Résout l'effet de bord `onSelectSet` d'un champ pour une valeur donnée.
/// Renvoie la liste des couples {fieldId, value} à écrire dans le payload,
/// ou `null` si le champ n'a pas d'`onSelectSet` ou si la valeur ne matche
/// pas `whenValue`. Pur (aucune dépendance React) → testable en isolation ;
/// appelé par le form-runner dans `setValue` sur saisie utilisateur.
export function resolveOnSelectSet(
  field: OnSelectSetShape,
  value: FieldValue
): { fieldId: string; value: FieldValue }[] | null {
  if (!field.onSelectSet) return null;
  if (value !== field.onSelectSet.whenValue) return null;
  return field.onSelectSet.set;
}
