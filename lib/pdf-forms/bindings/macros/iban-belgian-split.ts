// Macro : IBAN belge splitté en 4 slots visuels (« B E · __ __ · __ __ __ __ ·
// __ __ __ __ · __ __ __ __ »).
//
// Pattern présent sur le template C1 changement de situation (widgets « B E »,
// undefined_11/12/13). Réutilisable dès qu'un autre document ONEM aurait le
// même pattern d'IBAN visuel — la macro évite la duplication ligne-par-ligne
// des 4 slices (0-2, 2-6, 6-10, 10-14).

import type { MappingRule } from "../types";
import type { FormPayload } from "../../types";

export interface IbanBelgianSplitWidgets {
  /// Widget de 2 chiffres (maxLen=2) qui reçoit les chiffres de contrôle
  /// après le préfixe pays « BE ». Souvent nommé « B E » sur les templates
  /// ONEM (2 espaces intercalés qu'on retrouve dans l'AcroForm).
  checkDigits: string;
  /// 3 widgets de 4 chiffres chacun (maxLen=4) pour les 3 groupes de
  /// 4 chiffres du n° de compte belge. Ordre = gauche à droite sur le PDF.
  part1: string;
  part2: string;
  part3: string;
}

/// Vérifie qu'un IBAN belge complet est présent (préfixe BE + 14 chiffres
/// après). Normalise en majuscules et retire les espaces avant le test.
function isBelgianIbanComplete(payload: FormPayload, sourceField: string): boolean {
  const raw = typeof payload[sourceField] === "string" ? (payload[sourceField] as string) : "";
  const normalized = raw.replace(/\s+/g, "").toUpperCase();
  return normalized.startsWith("BE") && normalized.length >= 16;
}

/// Fabrique la règle de split IBAN belge. Sur un IBAN vide ou étranger, ne
/// stampe rien — la macro `ibanForeignRouting` couvre la branche opposée.
///
/// Usage :
///   ibanBelgianSplit({
///     sourceField: "iban",
///     widgets: { checkDigits: "B E", part1: "undefined_11",
///                part2: "undefined_12", part3: "undefined_13" },
///   })
export function ibanBelgianSplit(opts: {
  sourceField: string;
  widgets: IbanBelgianSplitWidgets;
  /// Nom de règle personnalisé (défaut : "iban-be-split").
  name?: string;
}): MappingRule {
  const w = opts.widgets;
  return {
    name: opts.name ?? "iban-be-split",
    whenFn: (payload) => isBelgianIbanComplete(payload, opts.sourceField),
    stampFn: (payload) => {
      const raw = String(payload[opts.sourceField] ?? "").replace(/\s+/g, "").toUpperCase();
      const digits = raw.slice(2); // Retire "BE"
      if (digits.length < 14) return [];
      return [
        { widget: w.checkDigits, value: digits.slice(0, 2) },
        { widget: w.part1, value: digits.slice(2, 6) },
        { widget: w.part2, value: digits.slice(6, 10) },
        { widget: w.part3, value: digits.slice(10, 14) },
      ];
    },
    declaredWidgets: [w.checkDigits, w.part1, w.part2, w.part3],
  };
}
