import type { FormPayload } from "./types";

/// À appeler sur le payload juste avant l'envoi au serveur (génération PDF),
/// jamais sur le state React live — même principe que
/// `applyMotifTransferOverride`. Sur le C1, le widget PDF « Nom du titulaire »
/// (x=304,y=462) doit être rempli DÈS QU'un mode paiement virement est
/// sélectionné, avec :
///
/// - Le nom de l'utilisateur (« Prénom Nom ») si `titulaireCompte === "mon-nom"`
///   (défaut) — Oraliks 2026-07-07 : « nom du titulaire bah c'est le même que
///   le user qui fait le form sauf s'il met non et que le compte est à
///   quelqu'un d'autre ».
/// - La saisie manuelle `titulaireCompteNom` si `titulaireCompte === "autre-nom"`.
///
/// Le champ visible côté UI (`titulaireCompteNom`) reste conditionné à
/// `titulaireCompte === "autre-nom"` (visibleIf) : on ne veut pas montrer un
/// champ pré-rempli du nom utilisateur à l'écran (redondant). Mais côté PDF,
/// la case DOIT être remplie dans les deux cas. Ce transform aligne la valeur
/// STAMPÉE avec le comportement voulu, sans polluer l'UI.
///
/// Module volontairement minimal (aucun import lourd) : importé côté runner.
export function applyTitulaireCompteNomDerivation(values: FormPayload): FormPayload {
  const titulaire = values.titulaireCompte;
  const modePaiement = values.modePaiement;
  // Widget « Nom du titulaire » : seulement pertinent pour virement ; en
  // chèque circulaire on ne stampe rien (le chèque va à l'adresse identité).
  if (modePaiement !== "virement") return values;

  if (titulaire === "autre-nom") {
    // L'utilisateur a explicitement saisi un autre nom : on l'utilise pour
    // le stamp PDF (le champ UI `titulaireCompteNom` porte la valeur).
    const explicit = typeof values.titulaireCompteNom === "string"
      ? values.titulaireCompteNom.trim()
      : "";
    if (!explicit) return values;
    return { ...values, titulaireCompteNomStamp: explicit };
  }

  // « mon-nom » (défaut) : on injecte le nom de l'utilisateur pour que le PDF
  // ne laisse pas la case vide.
  const prenom = typeof values.pr_nom === "string" ? values.pr_nom.trim() : "";
  const nom = typeof values.nom === "string" ? values.nom.trim() : "";
  const fullName = [prenom, nom].filter(Boolean).join(" ");
  if (!fullName) return values;
  return { ...values, titulaireCompteNomStamp: fullName };
}
