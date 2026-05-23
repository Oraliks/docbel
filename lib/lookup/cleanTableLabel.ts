/**
 * Nettoie un libellé de table pour l'UI :
 *  - retire le préfixe module dupliqué en début ("S01 - Sexe" → "Sexe")
 *    car le badge à côté affiche déjà ce préfixe
 *  - retire le suffixe "(S01)" / "(S04)" en fin
 *  - capitalise la première lettre
 *
 * Exemples :
 *   "S04/S36 - Article d'indemnisation" → "Article d'indemnisation"
 *   "Nationalité (codification BCSS) (S01)" → "Nationalité (codification BCSS)"
 *   "lieu d'entretien DISPO" → "Lieu d'entretien DISPO"
 */
export function cleanTableLabel(label: string, prefix?: string): string {
  if (!label) return label
  let cleaned = label.trim()

  // Préfixe module en début, plusieurs variantes :
  //  - "S04/S36 - X" / "S01 — X" / "A27 – X"  (avec dash)
  //  - "S07Noss code" / "S15Undue"            (collé en CamelCase, sans dash)
  // Le badge à côté affiche déjà le module, c'est redondant.
  cleaned = cleaned.replace(
    /^(?:[A-Z]\d{1,3}(?:\/[A-Z]?\d{1,3})?|[A-Z]{2,5})\s*[-–—]\s*/,
    ''
  )
  cleaned = cleaned.replace(/^S\d{1,3}(?=[A-Z])/, '')

  // Suffixe parenthétique reprenant le préfixe : "(S01)" en fin
  if (prefix) {
    const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    cleaned = cleaned.replace(new RegExp(`\\s*\\(${escaped}\\)\\s*$`), '')
  } else {
    // Sinon : on enlève tout suffixe générique "(SXX)" / "(AXX)"
    cleaned = cleaned.replace(/\s*\([A-Z]\d{1,3}(?:\/[A-Z]?\d{1,3})?\)\s*$/, '')
  }

  // Capitalisation de la première lettre (préserve les accents)
  if (cleaned.length > 0) {
    cleaned = cleaned[0].toUpperCase() + cleaned.slice(1)
  }

  return cleaned.trim()
}
