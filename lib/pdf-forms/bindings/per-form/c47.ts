// Règles serveur du C47 — « Demande de dispense / inaptitude permanente ».
//
// Comme le C1A, le C47 imprime son adresse sur deux lignes qui fusionnent
// chacune DEUX informations. La saisie les garde séparées (une clé canonique =
// une valeur, pour hériter du C1) ; ces règles recomposent les lignes.
//
// Le nom n'a pas besoin de règle : `pr_nom_et_nom` est un champ `fullname` que
// le filler assemble seul.
//
// ⚠ Ordre d'assemblage : convention belge (« Rue de la Loi 16 »,
// « 1000 Bruxelles »), cohérente avec le C1 et le C1A. Les noms de widgets du
// C47 suggèrent l'inverse (« Commune et code postal ») — à confirmer sur le
// formulaire papier, l'inversion tient en un échange de deux ids.
//
// ⚠ `pdfFieldName` = nom EXACT du widget. Les copier depuis
// `pnpm tsx scripts/dump-pdf-widgets.ts C47_FR`, jamais les retaper : c'est
// une apostrophe retapée qui avait rendu ce formulaire impubliable.

import { concatBinding } from "../shared";
import type { MappingRule } from "../types";

const W_RUE = "Rue";
const W_COMMUNE_CODE_POSTAL = "Commune et code postal";

export const C47_RULES: MappingRule[] = [
  concatBinding({ name: "adresse-rue-numero", widget: W_RUE, fields: ["rue", "numero"] }),
  concatBinding({
    name: "code-postal-commune",
    widget: W_COMMUNE_CODE_POSTAL,
    fields: ["codePostal", "commune"],
  }),
];
