// Règles serveur du C47 — « Demande de dispense / inaptitude permanente ».
//
// Comme le C1A, le C47 imprime son adresse sur deux lignes qui fusionnent
// chacune DEUX informations. La saisie les garde séparées (une clé canonique =
// une valeur, pour hériter du C1) ; ces règles recomposent les lignes.
//
// Le nom n'a pas besoin de règle : `pr_nom_et_nom` est un champ `fullname` que
// le filler assemble seul.
//
// Ordre d'assemblage : rue puis numéro, code postal puis commune (confirmé par
// Oraliks le 2026-07-26), comme sur le C1 et le C1A. Le nom du widget dit
// l'inverse (« Commune et code postal ») : c'est sans importance, les
// formulaires ONEM alternent librement les deux formulations sans que ça
// change ce qu'on écrit dans la case.
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
