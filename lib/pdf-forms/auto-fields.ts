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
  hidden?: boolean;
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

/// Injecte les valeurs auto-imposées par le serveur JUSTE AVANT la génération
/// du PDF : date de création = `today` (AAAA-MM-JJ), signature du citoyen =
/// « confirmed ». Renvoie un NOUVEAU payload (ne mute pas l'entrée).
///
/// À appeler sur l'objet FINAL passé au filler, PAS avant la validation Zod :
/// `buildValidator` EXCLUT totalement ces champs de son schéma (cf.
/// validation.ts), et un `z.object` strippe les clés inconnues — donc toute
/// valeur injectée avant `safeParse` est effacée par `result.data`. Le bug
/// observé (Oraliks 2026-07-11 : « toujours pas la date du document ni la
/// signature ») venait de là : la route /generate injectait AVANT de valider,
/// et la régénération de dossier (lib/bundles/regenerate-pdfs.ts) ne réinjectait
/// jamais — les deux chemins produisaient un PDF sans date ni signature.
///
/// Idempotent. Ne touche jamais un champ `hidden` (volet rempli par un tiers,
/// ex. partie « école » du DIPLÔME — sans ce garde, la signature du citoyen se
/// poserait sur les lignes de l'école) ni n'écrase une signature déjà fournie.
export function applyServerAutoFields<T extends Record<string, unknown>>(
  fields: AutoFieldShape[],
  payload: T,
  today: string,
): T {
  const next: Record<string, unknown> = { ...payload };
  for (const f of fields) {
    if (f.hidden) continue;
    if (isCreationDateField(f)) next[f.id] = today;
    if (isSignatureField(f) && !next[f.id]) next[f.id] = "confirmed";
  }
  return next as T;
}
