import type { FormPayload } from "./types";

/// À appeler sur le payload juste avant l'envoi au serveur (génération PDF),
/// jamais sur le state React live du formulaire. Sur le C1, le 5e chip
/// `transfereOrganismePaiement` (dossier "changement de situation
/// personnelle", cf. lib/pdf-forms/seed/c1-fields-improvements.ts) et
/// `motifIntroduction` ciblent 2 cases PDF mutuellement exclusives ("je
/// déclare une modification concernant" vs "je change d'organisme de
/// paiement") : si l'utilisateur a coché le transfert, la valeur réelle à
/// soumettre est "changement-op", jamais le défaut "modification". No-op
/// pour les formulaires sans ce champ (c1, c1-insertion).
///
/// Module volontairement minimal (aucun autre import) : le runner (composant
/// client partagé par tous les dossiers) l'importe directement, sans jamais
/// tirer le gros schéma C1 (~150 champs) dans le bundle client.
export function applyMotifTransferOverride(values: FormPayload): FormPayload {
  if (values.transfereOrganismePaiement !== true) return values;
  return { ...values, motifIntroduction: "changement-op" };
}
