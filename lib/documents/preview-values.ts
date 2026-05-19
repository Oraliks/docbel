import type { DocumentField } from "./types";

/// Génère une valeur d'aperçu fictive (mais réaliste belge) pour un champ.
/// Utilisé par le "mode Aperçu rempli" de l'éditeur pour visualiser à quoi
/// ressemble le PDF final sans avoir à exporter.
///
/// Les valeurs sont **déterministes** (pas de Math.random) — pareil champ →
/// pareille valeur, pour que l'admin puisse comparer entre deux modifs.
export function getPreviewValue(field: DocumentField): string {
  const label = (field.label || "").toLowerCase();

  switch (field.type) {
    case "checkbox":
      return "✓";
    case "signature":
      return "—— signé ——";
    case "date":
      if (label.includes("naissance")) return "15/03/1985";
      if (label.includes("signature")) return "19/05/2026";
      return "01/01/2026";
    case "number":
      if (label.includes("salaire") || label.includes("montant")) return "2 500,00";
      if (label.includes("heure")) return "38";
      if (label.includes("jour")) return "21";
      return "100";
    case "niss":
      return "85.03.15-123.07";
    case "iban":
      return "BE68 5390 0754 7034";
    case "bce":
    case "tva_be":
      return "0123.456.789";
    case "postal_be":
      return "1000";
    case "phone_be":
      return "+32 470 12 34 56";
    case "select":
      // Première option du select s'il y en a une
      if (Array.isArray(field.options) && field.options[0]) {
        return field.options[0].label;
      }
      return "Option";
    case "textarea":
      return "Texte d'exemple en plusieurs mots pour tester le rendu…";
    case "text":
    default:
      if (label.includes("pr") && label.includes("nom")) return "Jean Dupont";
      if (label.includes("prénom") || label.includes("prenom")) return "Jean";
      if (label.includes("nom")) return "Dupont";
      if (label.includes("email") || label.includes("mail")) return "jean.dupont@exemple.be";
      if (label.includes("rue") || label.includes("avenue")) return "Rue de la Loi";
      if (label.includes("commune") || label.includes("ville")) return "Bruxelles";
      if (label.includes("pays")) return "Belgique";
      if (label.includes("employeur")) return "ACME SA";
      return "Exemple";
  }
}
