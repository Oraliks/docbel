import type { FormPayload } from "./types";

/// Sur le C1, le template imprime la ligne IBAN belge comme :
///   « B E  __ __  __ __ __ __  __ __ __ __  __ __ __ __ »
/// avec :
///   - Widget « B E » statique (préfixe BE imprimé)
///   - 3 slots undefined_11 / undefined_12 / undefined_13 pour les 14 chiffres
///
/// Notre champ `iban` porte la valeur validée « BE68 5390 0754 7034 ». Ce
/// transform strippe le préfixe BE et répartit les 14 chiffres restants en 3
/// groupes pour remplir les 3 slots visuels (Oraliks 2026-07-07 : « le compte
/// bancaire n'est pas dans le bon champs acroform il doit être plus haut »).
///
/// Slots du template (avec maxLength AcroForm entre parenthèses) :
///   - "B E"          maxLength=2  → check digits "68" (les 2 chiffres après BE)
///   - undefined_11   maxLength=4  → premier groupe de 4 : "5390"
///   - undefined_12   maxLength=4  → deuxième groupe de 4 : "0754"
///   - undefined_13   maxLength=4  → troisième groupe de 4 : "7034"
///
/// Total = 2 + 4 + 4 + 4 = 14 chiffres après le préfixe BE (le template imprime
/// "BE" en texte statique en amont du widget "B E"). Le widget "B E" reçoit
/// les 2 chiffres de contrôle car son maxLength=2 (ce que le nom "B E" ne
/// laisse pas deviner, mais confirmé via `PDFTextField.getMaxLength`).
///
/// Ne touche PAS la branche étrangère : les IBAN non-BE vivent dans
/// `sepa_tranger_iban_bic` (routé par `applyIbanCountryRouting`) et stampent
/// le widget « SEPA étranger IBAN BIC ».
export function applyIbanSplitDerivation(values: FormPayload): FormPayload {
  const raw = typeof values.iban === "string" ? values.iban.trim() : "";
  if (!raw) return values;
  const normalized = raw.replace(/\s+/g, "").toUpperCase();
  if (!normalized.startsWith("BE")) return values;
  const digits = normalized.slice(2); // Retire "BE" → 14 chiffres attendus
  if (digits.length < 14) return values;
  return {
    ...values,
    ibanCheckDigits: digits.slice(0, 2), // "68" → widget "B E"
    ibanPart1: digits.slice(2, 6),       // "5390" → undefined_11
    ibanPart2: digits.slice(6, 10),      // "0754" → undefined_12
    ibanPart3: digits.slice(10, 14),     // "7034" → undefined_13
  };
}
