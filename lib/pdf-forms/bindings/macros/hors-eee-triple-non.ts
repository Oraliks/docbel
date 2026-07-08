// Macro : coche 3 cases « non » (réfugié / apatride / hors EEE) dès que
// le citoyen s'auto-déclare EEE.
//
// Pattern présent sur le C1 (widgets « non_17 », « non_18 », « non_19 »
// avec la question déclencheuse `nationaliteHorsEEE === "non"`). Ces 3
// cases sont normalement remplies séparément par les autres champs, mais
// pour un citoyen belge/EEE elles ont toutes la même réponse — d'où
// l'intérêt de la macro qui les coche en un seul geste dès que le champ
// principal est répondu.

import type { MappingRule } from "../types";
import type { FieldValue } from "../../types";

export interface HorsEeeTripleNonWidgets {
  /// Widget « non » de la question « statut réfugié ».
  nonRefugie: string;
  /// Widget « non » de la question « apatride reconnu ».
  nonApatride: string;
  /// Widget « non » de la question « ressortissant hors EEE ».
  nonHorsEee: string;
}

/// Fabrique la règle. `sourceField` = ID du champ EXPLICITE « es-tu hors
/// EEE ? » (souvent `nationaliteHorsEEE`). Ne stampe que quand ce champ
/// vaut EXACTEMENT `matchValue` (défaut "non") — jamais depuis un texte
/// libre nationalité (piège classique : « nationalité=Belge » ne doit PAS
/// déclencher la macro, seule la question binaire compte).
export function horsEeeTripleNon(opts: {
  sourceField: string;
  matchValue?: FieldValue;
  widgets: HorsEeeTripleNonWidgets;
  name?: string;
}): MappingRule {
  const matchValue = opts.matchValue ?? "non";
  return {
    name: opts.name ?? "hors-eee-non",
    when: { [opts.sourceField]: { equals: matchValue } },
    stamp: [
      { widget: opts.widgets.nonRefugie, value: true },
      { widget: opts.widgets.nonApatride, value: true },
      { widget: opts.widgets.nonHorsEee, value: true },
    ],
  };
}
