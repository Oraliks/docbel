/**
 * Helper de locale du Lookup.
 *
 * Point de bascule UNIQUE pour l'internationalisation (i18n) future du Lookup.
 * Toute la logique de choix de langue des descriptions ONEM (vue table) passe par ici.
 */

/** Langues supportées par le Lookup. */
export type LookupLocale = 'fr' | 'nl'

/**
 * Renvoie la locale active du Lookup.
 *
 * Le site est mono-FR aujourd'hui (pas encore d'i18n).
 *
 * TODO i18n: brancher la vraie locale (next-intl / cookie / <html lang>).
 * Le jour où le site passe en NL, renvoyer 'nl' ici suffit à basculer
 * TOUTES les descriptions du Lookup (vue table) sans autre changement.
 */
export function resolveLookupLocale(): LookupLocale {
  return 'fr'
}

/**
 * Sélectionne le libellé correspondant à la locale, avec repli sur le FR.
 *
 * En NL, si le libellé néerlandais est vide/absent, on retombe sur le FR
 * pour ne jamais afficher de chaîne vide.
 */
export function pickLabel(
  locale: LookupLocale,
  labels: { labelFr: string; labelNl: string | null },
): string {
  return locale === 'nl' ? labels.labelNl || labels.labelFr : labels.labelFr
}
