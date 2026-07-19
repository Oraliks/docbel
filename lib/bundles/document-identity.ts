import { isAutoField } from "@/lib/pdf-forms/auto-fields";

/// Forme minimale d'un champ pour identifier les champs « auto » à ignorer.
interface FieldShape {
  id: string;
  type: string;
  prefillFrom?: string;
  label?: { fr?: string; nl?: string; de?: string };
  autoAnswered?: boolean;
  hidden?: boolean;
}

/// Clé de contenu STABLE d'un document rempli, pour détecter deux demandes
/// identiques. On EXCLUT :
///  - les champs « auto » (signature, date de création, autoAnswered) — sinon
///    deux documents au contenu identique mais générés des jours différents
///    (dateCreation) sembleraient différents ;
///  - les valeurs vides (""/null/undefined) — normalise « champ absent » vs
///    « champ vidé ».
/// Les clés sont triées → indépendance à l'ordre d'insertion. Deux documents
/// au même contenu métier → même clé.
export function stableDocumentKey(
  payload: Record<string, unknown>,
  fields: FieldShape[],
): string {
  const autoIds = new Set(fields.filter((f) => isAutoField(f)).map((f) => f.id));
  const clean: Record<string, unknown> = {};
  for (const key of Object.keys(payload).sort()) {
    if (autoIds.has(key)) continue;
    const value = payload[key];
    if (value === "" || value === null || value === undefined) continue;
    clean[key] = value;
  }
  return JSON.stringify(clean);
}

/// true si deux payloads du MÊME formulaire ont un contenu métier identique.
export function documentPayloadsIdentical(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  fields: FieldShape[],
): boolean {
  return stableDocumentKey(a, fields) === stableDocumentKey(b, fields);
}
