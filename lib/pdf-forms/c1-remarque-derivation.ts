import type { FormPayload } from "./types";

/// Au submit du C1 « changement de situation », l'usager ne remplit plus
/// manuellement le champ « Remarque (situation familiale) » — celui-ci
/// devient `autoAnswered` (cf. c1-fields-improvements.ts) et est renseigné
/// automatiquement à partir de choix concrets pris ailleurs dans le
/// formulaire :
///
///   • statutFamilial === "isole" ET habiteEnColocation === "oui"
///       → « cohousing »  (le citoyen est officiellement isolé mais partage
///         un logement en pratique — l'agent ONEM lit la remarque et sait
///         qu'il faut vérifier la composition de ménage manuellement).
///   • statutJugementPensionAlimentaire === "en-cours"
///       → « jugement en cours »
///   • statutJugementPensionAlimentaire === "pas-encore-recu"
///       → « je n'ai pas encore reçu mon jugement »
///
/// Les mentions sont concaténées avec « ; » si plusieurs cas s'appliquent
/// simultanément. Si l'usager avait déjà tapé une remarque manuelle avant
/// que le champ soit passé en `autoAnswered` (données historiques d'un
/// dossier repris), on ne l'écrase que si notre calcul produit du contenu —
/// sinon on laisse la valeur existante intacte (safe upgrade).
///
/// Module volontairement minimal (aucun autre import que `types`) — le runner
/// (composant client) l'importe directement, même pattern que
/// `c1-motif-transfer.ts` et `c1-iban-routing.ts`.
export function applyRemarqueSituationFamiliale(values: FormPayload): FormPayload {
  const parts: string[] = [];
  if (values.statutFamilial === "isole" && values.habiteEnColocation === "oui") {
    parts.push("cohousing");
  }
  const statut = values.statutJugementPensionAlimentaire;
  if (statut === "en-cours") parts.push("jugement en cours");
  else if (statut === "pas-encore-recu") parts.push("je n'ai pas encore reçu mon jugement");
  if (parts.length === 0) return values;
  return { ...values, remarqueSituationFamiliale: parts.join(" ; ") };
}
