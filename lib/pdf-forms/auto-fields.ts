// Helpers pour détecter les champs à exclure du rendu interactif des étapes :
//   - signature : générée automatiquement (bloc "Signé numériquement par X")
//   - date de création : date du jour
//   - autoAnswered : valeur fixée par ailleurs (defaultValue au montage,
//     dérivation à la soumission) — cf. `PdfFormField.autoAnswered`
//
// La détection préfère les marqueurs explicites (`type === "signature"`,
// `prefillFrom === "system.today"`, `autoAnswered === true`). Mais comme
// beaucoup de PdfForms en production ont été créés AVANT que ces marqueurs ne
// soient appliqués par l'inférence (parser AcroForm + admin), on retombe sur
// le LIBELLÉ pour ne pas afficher au public des champs sémantiquement "auto"
// (signature/date de création uniquement — `autoAnswered` n'a pas de repli
// par libellé, c'est un marqueur explicite posé au cas par cas).

// Shape minimale acceptée — couvre à la fois PublicField (client) et
// PdfFormField (serveur).
interface AutoFieldShape {
  id: string;
  type: string;
  prefillFrom?: string;
  label?: { fr?: string; nl?: string; de?: string };
  autoAnswered?: boolean;
}

const SIGNATURE_LABEL_RE = /\b(signature|handtekening|unterschrift)\w*/i;
const CREATION_DATE_LABEL_RE =
  /(date.{0,5}(cr[ée]ation|g[ée]n[ée]ration|today|jour))|aanmaakdatum|erstellungsdatum/i;

function labelText(f: AutoFieldShape): string {
  return [f.label?.fr ?? "", f.label?.nl ?? "", f.label?.de ?? "", f.id].join(" ").trim();
}

/// true si le champ doit être traité comme une signature (sera apposée
/// automatiquement à la génération).
export function isSignatureField(f: AutoFieldShape): boolean {
  if (f.type === "signature") return true;
  return SIGNATURE_LABEL_RE.test(labelText(f));
}

/// true si le champ doit être pré-rempli automatiquement par la date du jour
/// à la génération (date de création / date du document).
export function isCreationDateField(f: AutoFieldShape): boolean {
  if (f.prefillFrom === "system.today") return true;
  return CREATION_DATE_LABEL_RE.test(labelText(f));
}

/// true si le champ doit être masqué du formulaire utilisateur (signature,
/// date de création, OU marqueur explicite `autoAnswered`).
export function isAutoField(f: AutoFieldShape): boolean {
  return isSignatureField(f) || isCreationDateField(f) || f.autoAnswered === true;
}
