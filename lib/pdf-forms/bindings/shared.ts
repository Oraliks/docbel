// Helpers de bindings partagés entre formulaires.
//
// On partage la SÉMANTIQUE, PAS les noms de widgets — chaque document AcroForm
// a ses propres pdfFieldName, que l'appelant fournit au helper.
//
// Ce module ne garde que `concatBinding`. Trois autres helpers
// (`identityBindings`, `fullnameBinding`, `addressBindings`) y ont vécu sans
// jamais trouver d'appelant : ils pariaient sur des ids de champs figés
// (« nom », « pr_nom », « adresse_rue »…) qu'aucun seed n'a suivis. Retirés
// au lot S9 de l'audit du 2026-08-01 — l'historique git les garde si le
// besoin réapparaît.

import type { MappingRule } from "./types";
import type { FormPayload } from "../types";

/// Fabrique une règle qui remplit UN widget avec la concaténation de plusieurs
/// champs du formulaire, séparés par un espace, les vides ignorés.
///
/// Pattern très fréquent chez ONEM : le PDF imprime « Rue et numéro » ou
/// « Code postal et commune » sur une seule ligne, alors que la saisie garde
/// les valeurs séparées — c'est indispensable pour les hériter d'un autre
/// document du dossier, une clé canonique ne portant qu'UNE valeur.
///
/// Ne stampe rien si tout est vide : une ligne blanche vaut mieux qu'un espace
/// isolé sur un document officiel.
export function concatBinding(opts: {
  widget: string;
  fields: readonly string[];
  name?: string;
}): MappingRule {
  const join = (payload: FormPayload): string =>
    opts.fields
      .map((id) => (typeof payload[id] === "string" ? (payload[id] as string).trim() : ""))
      .filter(Boolean)
      .join(" ");
  return {
    name: opts.name ?? `concat:${opts.widget}`,
    whenFn: (payload) => join(payload) !== "",
    stampFn: (payload) => {
      const value = join(payload);
      return value ? [{ widget: opts.widget, value }] : [];
    },
    declaredWidgets: [opts.widget],
  };
}
