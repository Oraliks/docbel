// Règles serveur du C1A — « Déclaration d'activité accessoire / aide à un
// indépendant ».
//
// Le C1A n'a besoin que de recomposer son en-tête d'adresse : deux widgets du
// PDF officiel fusionnent chacun DEUX informations, alors que le formulaire de
// saisie les garde séparées pour pouvoir les hériter du C1 (une clé canonique
// = une valeur).
//
// Le nom complet, lui, n'a PAS besoin de règle : le champ `nomEtPrenom` est de
// type `fullname` et le filler assemble « Nom Prénom » tout seul (cf.
// `assembleFullName`, `nameOrder: "last-first"`).
//
// ⚠ Les `pdfFieldName` ci-dessous doivent reproduire EXACTEMENT les noms de
// widgets de C1A_FR.pdf. Ne jamais les retaper : les copier depuis
// `pnpm tsx scripts/dump-pdf-widgets.ts C1A_FR`. Le test `seeds-vs-pdf`
// n'attrape que les champs du schéma, pas les widgets déclarés par une règle —
// c'est `checkPublishable` qui s'en charge (erreur bloquante).

import { concatBinding } from "../shared";
import type { MappingRule } from "../types";

const W_RUE = "Rue";
const W_CODE_POSTAL_COMMUNE = "Code postal et commune";

export const C1A_RULES: MappingRule[] = [
  // « Rue et numéro » sur une seule ligne imprimée.
  concatBinding({ name: "adresse-rue-numero", widget: W_RUE, fields: ["rue", "numero"] }),
  // « 1000 Bruxelles » — même grammaire que la règle `code-postal-commune`
  // du C1 changement de situation.
  concatBinding({
    name: "code-postal-commune",
    widget: W_CODE_POSTAL_COMMUNE,
    fields: ["codePostal", "commune"],
  }),
];
