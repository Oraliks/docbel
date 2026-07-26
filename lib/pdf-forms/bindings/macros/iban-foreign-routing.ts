// Macro : routage d'un IBAN NON-belge vers un widget SEPA étranger.
//
// Pattern présent sur le C1 changement (widget « SEPA étranger IBAN  BIC »
// avec double espace). Réutilisable dès qu'un document expose un champ IBAN
// unique en saisie mais 2 widgets distincts sur le PDF officiel (belge vs
// étranger) — pattern courant chez ONEM.

import type { MappingRule } from "../types";
import type { FormPayload } from "../../types";
import { wrapAcrossLines } from "../format";

/// Vrai si `sourceField` porte un IBAN valide dont le préfixe pays est != BE.
function isForeignIban(payload: FormPayload, sourceField: string): boolean {
  const raw = typeof payload[sourceField] === "string" ? (payload[sourceField] as string) : "";
  const normalized = raw.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}/.test(normalized)) return false;
  return !normalized.startsWith("BE");
}

/// Route un IBAN étranger vers le ou les widgets PDF dédiés. La valeur stampée
/// conserve les espaces d'origine (les IBANs SEPA sont lus par groupes
/// de 4 chiffres, l'ONEM accepte).
///
/// `widgets` accepte PLUSIEURS lignes : sur le C1, le compte étranger est un
/// champ unique imprimé sur DEUX lignes, pour absorber un IBAN long (jusqu'à
/// 34 caractères, davantage s'il est saisi par groupes). On remplit la 1ʳᵉ
/// ligne puis on déborde sur la suivante ; tant que l'IBAN tient, la 2ᵉ ligne
/// n'est pas stampée. Avant (2026-07-26), tout partait sur la SECONDE ligne et
/// la première restait vide.
///
/// `maxCharsPerLine` est un budget approximatif dérivé de la largeur du widget
/// (≈ 5,8 pt par caractère pour de l'alphanumérique majuscule à 10 pt).
///
/// Usage :
///   ibanForeignRouting({ sourceField: "iban", widgets: ["IBAN", "SEPA…"], maxCharsPerLine: [34, 40] })
export function ibanForeignRouting(opts: {
  sourceField: string;
  /// Une seule ligne — forme historique, équivalente à `widgets: [widget]`.
  widget?: string;
  widgets?: readonly string[];
  maxCharsPerLine?: readonly number[];
  name?: string;
}): MappingRule {
  const widgets = opts.widgets ?? (opts.widget ? [opts.widget] : []);
  // Une seule ligne : budget volontairement énorme → tout part sur elle,
  // comportement identique à la version d'origine.
  const budget = opts.maxCharsPerLine ?? widgets.map(() => Number.MAX_SAFE_INTEGER);
  return {
    name: opts.name ?? "iban-etranger",
    whenFn: (payload) => isForeignIban(payload, opts.sourceField),
    stampFn: (payload) => {
      const raw = String(payload[opts.sourceField] ?? "").trim();
      if (!raw || widgets.length === 0) return [];
      return wrapAcrossLines(raw, budget)
        .slice(0, widgets.length)
        .map((value, i) => ({ widget: widgets[i], value }));
    },
    declaredWidgets: [...widgets],
  };
}
