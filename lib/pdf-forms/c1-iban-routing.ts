import type { FormPayload } from "./types";

/// À appeler sur le payload juste avant l'envoi au serveur (génération PDF),
/// jamais sur le state React live du formulaire — même principe que
/// `applyMotifTransferOverride`. Sur le C1, le PDF officiel a DEUX widgets
/// distincts pour l'IBAN — l'un pour un compte belge (widget "IBAN"), l'autre
/// pour un compte SEPA étranger (widget "SEPA étranger IBAN  BIC"). Côté UX
/// on ne montre qu'UN seul champ IBAN qui accepte les deux : au submit, on
/// route la valeur vers le bon widget selon les 2 lettres de préfixe pays.
///
/// - `iban` commence par "BE" (ou est vide) : rien à faire, la valeur reste
///   sur le champ `iban` (pdfFieldName = "IBAN"). Le strip du préfixe "BE"
///   au stamping est géré par `filler.ts#stampScalarWidget` (le widget "B E"
///   du template affiche déjà "BE" statiquement en amont — sans strip on
///   verrait "BE BE68 5390..." doublement préfixé).
/// - `iban` commence par un autre préfixe : on VIDE `iban` et on transfère
///   la valeur sur `sepa_tranger_iban_bic` (pdfFieldName = "SEPA étranger
///   IBAN  BIC"), sans laquelle le PDF officiel afficherait un IBAN étranger
///   sur la ligne "compte belge" (illisible pour l'ONEM).
///
/// Module volontairement minimal (aucun autre import) : le runner (composant
/// client partagé par tous les dossiers) l'importe directement, sans jamais
/// tirer le gros schéma C1 (~130 champs) dans le bundle client — même
/// pattern que `c1-motif-transfer.ts`.
export function applyIbanCountryRouting(values: FormPayload): FormPayload {
  const raw = typeof values.iban === "string" ? values.iban : "";
  const normalized = raw.replace(/\s+/g, "").toUpperCase();
  if (!normalized) return values;
  // Un IBAN valide commence par 2 lettres pays. Si l'utilisateur a tapé
  // quelque chose de nettement plus court (< 2 lettres reconnues), on
  // n'invente pas de routage — Zod bloquera à la validation, pas ici.
  if (!/^[A-Z]{2}/.test(normalized)) return values;
  if (normalized.startsWith("BE")) return values;
  return { ...values, iban: "", sepa_tranger_iban_bic: raw };
}
