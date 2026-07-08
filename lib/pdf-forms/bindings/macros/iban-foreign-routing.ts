// Macro : routage d'un IBAN NON-belge vers un widget SEPA étranger.
//
// Pattern présent sur le C1 changement (widget « SEPA étranger IBAN  BIC »
// avec double espace). Réutilisable dès qu'un document expose un champ IBAN
// unique en saisie mais 2 widgets distincts sur le PDF officiel (belge vs
// étranger) — pattern courant chez ONEM.

import type { MappingRule } from "../types";
import type { FormPayload } from "../../types";

/// Vrai si `sourceField` porte un IBAN valide dont le préfixe pays est != BE.
function isForeignIban(payload: FormPayload, sourceField: string): boolean {
  const raw = typeof payload[sourceField] === "string" ? (payload[sourceField] as string) : "";
  const normalized = raw.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}/.test(normalized)) return false;
  return !normalized.startsWith("BE");
}

/// Route un IBAN étranger vers un widget PDF dédié. La valeur stampée
/// conserve les espaces d'origine (les IBANs SEPA sont lus par groupes
/// de 4 chiffres, l'ONEM accepte).
///
/// Usage :
///   ibanForeignRouting({ sourceField: "iban", widget: "SEPA étranger IBAN  BIC" })
export function ibanForeignRouting(opts: {
  sourceField: string;
  widget: string;
  name?: string;
}): MappingRule {
  return {
    name: opts.name ?? "iban-etranger",
    whenFn: (payload) => isForeignIban(payload, opts.sourceField),
    stampFn: (payload) => {
      const raw = String(payload[opts.sourceField] ?? "").trim();
      if (!raw) return [];
      return [{ widget: opts.widget, value: raw }];
    },
    declaredWidgets: [opts.widget],
  };
}
