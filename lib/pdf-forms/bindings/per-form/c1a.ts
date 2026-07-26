// Règles serveur du C1A — « Déclaration d'activité accessoire / aide à un
// indépendant ».
//
// Le C1A n'a besoin que de recomposer son en-tête d'adresse : deux widgets du
// PDF officiel fusionnent chacun DEUX informations, alors que le formulaire de
// saisie les garde séparées pour pouvoir les hériter du C1 (une clé canonique
// = une valeur).
//
// Le nom complet, lui, n'a PAS besoin de règle : le champ `nomEtPrenom` est de
// type `fullname` et le filler assemble « Nom Prénom » tout seul à partir des
// deux cases de saisie (cf. `assembleFullName`, `nameOrder: "last-first"`).
//
// ⚠ Les `pdfFieldName` ci-dessous doivent reproduire EXACTEMENT les noms de
// widgets de C1A_FR.pdf. Ne jamais les retaper : les copier depuis
// `pnpm tsx scripts/dump-pdf-widgets.ts C1A_FR`. Le test `seeds-vs-pdf`
// n'attrape que les champs du schéma, pas les widgets déclarés par une règle —
// c'est `checkPublishable` qui s'en charge (erreur bloquante).

import type { MappingRule } from "../types";
import type { FormPayload } from "../../types";

const W_RUE = "Rue";
const W_CODE_POSTAL_COMMUNE = "Code postal et commune";

/// Concatène les valeurs de plusieurs champs du payload, séparées par un
/// espace, en ignorant les vides. Ne stampe rien si tout est vide — une ligne
/// blanche vaut mieux qu'un espace isolé sur un document officiel.
function joinFields(payload: FormPayload, fieldIds: readonly string[]): string {
  return fieldIds
    .map((id) => (typeof payload[id] === "string" ? (payload[id] as string).trim() : ""))
    .filter(Boolean)
    .join(" ");
}

function concatRule(name: string, widget: string, fieldIds: readonly string[]): MappingRule {
  return {
    name,
    whenFn: (payload) => joinFields(payload, fieldIds) !== "",
    stampFn: (payload) => {
      const value = joinFields(payload, fieldIds);
      return value ? [{ widget, value }] : [];
    },
    declaredWidgets: [widget],
  };
}

export const C1A_RULES: MappingRule[] = [
  // « Rue et numéro » sur une seule ligne imprimée.
  concatRule("adresse-rue-numero", W_RUE, ["rue", "numero"]),
  // « 1000 Bruxelles » — même grammaire que la règle `code-postal-commune`
  // du C1 changement de situation.
  concatRule("code-postal-commune", W_CODE_POSTAL_COMMUNE, ["codePostal", "commune"]),
];
