/**
 * Helpers de formatage des bureaux — partagés entre front public
 * (/outils/bureaux) et admin (/admin/bureaux).
 *
 * Vivait avant en double dans app/outils/bureaux/_components/types.ts.
 * Centralisé ici pour qu'un seul endroit gère le nommage cohérent
 * partout dans l'app.
 */

/**
 * Cas particulier ONEM : le name DB vient du lookup officiel ONEM et
 * n'est que la ville en MAJUSCULES ("BRUXELLES", "LIEGE", "ANTWERPEN").
 * Affiché brut on lit "BRUXELLES" sans savoir de quel organisme il
 * s'agit. On préfixe "ONEM de " + on convertit en TitleCase pour avoir
 * "ONEM de Bruxelles" lisible (cards finder + tooltip map + table admin).
 *
 * Idempotent : si le name commence déjà par "ONEM" on garde tel quel
 * (évite "ONEM de ONEM …" si la DB est nettoyée plus tard).
 *
 * Pour les autres types (CPAS, COMMUNE, SYNDICAT) les noms en DB sont
 * déjà self-descriptive ("CPAS de Schaerbeek", "FGTB Bruxelles") donc
 * on ne touche pas.
 */
export function displayBureauName(bureau: { type: string; name: string }): string {
  if (bureau.type === 'ONEM') {
    const raw = bureau.name.trim()
    if (/^onem\b/i.test(raw)) return raw
    return `ONEM de ${toTitleCase(raw)}`
  }
  return bureau.name
}

/**
 * "BRUXELLES" → "Bruxelles"
 * "SAINT-JOSSE-TEN-NOODE" → "Saint-Josse-Ten-Noode"
 * "L'ESCALE" → "L'Escale"
 */
export function toTitleCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s\-'])\p{L}/gu, (m) => m.toUpperCase())
}
