import { loc, type Locale, type Localized } from "./types";

/// Sélecteur PUR (§10.4, Lot 4d) : renvoie le texte d'aide localisé propre à un
/// champ (`help`) ou `null` s'il est absent / vide. Sert au panneau d'aide de
/// gauche pour surfacer « À propos de ce champ » AU-DESSUS des infos importantes
/// (form-context-tips) quand un champ est focalisé — il ne modifie rien et ne
/// touche pas au résolveur des conseils contextuels (`resolveTips`).
///
/// Le paramètre est typé au minimum (`{ help?: Localized }`) : `PublicField`
/// comme `PdfFormField` (les deux portent `help?: Localized`) le satisfont sans
/// cast.
export function pickFieldHelp(
  field: { help?: Localized },
  locale: Locale,
): string | null {
  const text = loc(field.help, locale).trim();
  return text === "" ? null : text;
}
