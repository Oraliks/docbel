/**
 * Types partagés des composants /outils/bureaux.
 * Miroir de ce que renvoie /api/bureaux/resolve.
 */

export interface HourSlot {
  open: string
  close: string
}

export interface DayHours {
  day: number
  slots: HourSlot[]
}

export interface BureauResult {
  id: string
  type: string
  name: string
  street: string
  streetNum: string | null
  postalCode: string
  city: string
  phone: string | null
  email: string | null
  website: string | null
  appointmentUrl: string | null
  hours: DayHours[]
  hoursNotes: string | null
  lat: number | null
  lng: number | null
  organismeCode: string | null
  organismeName: string | null
  organismeColor: string | null
}

export interface CommuneSummary {
  id: string
  insCode: string
  nameFr: string
  nameNl: string | null
  region: string
  province: string | null
  lat: number | null
  lng: number | null
}

export interface ResolveResponse {
  commune: CommuneSummary | null
  attitre: {
    cpas: BureauResult | null
    commune: BureauResult | null
    onem: BureauResult | null
    organismePaiement: BureauResult | null
    organismesPaiement: BureauResult[]
    mutuelle: BureauResult | null
  }
  warnings: string[]
}

// DemarcheKey/recommendedBureauType retirés : le sélecteur de démarche a été
// jugé inutile par le user (pas d'usage clair). Si on veut réactiver un
// "Recommandé" contextuel un jour, c'est ici qu'il viendra.

/**
 * Affichage d'un nom de bureau pour l'UI (cards + tooltip map).
 *
 * Cas particulier ONEM : le name DB vient du lookup officiel ONEM et
 * n'est que la ville en MAJUSCULES ("BRUXELLES", "LIEGE", "ANTWERPEN").
 * Affiché brut on lit "BRUXELLES" sans savoir de quel organisme il
 * s'agit. On préfixe "ONEM de " + on convertit en TitleCase pour avoir
 * "ONEM de Bruxelles" lisible partout (card ET tooltip map).
 *
 * Idempotent : si le name commence déjà par "ONEM" on garde tel quel
 * (évite "ONEM de ONEM …" si la DB est nettoyée plus tard).
 *
 * Pour les autres types (CPAS, COMMUNE, SYNDICAT) les noms en DB sont
 * déjà self-descriptive ("CPAS de Schaerbeek", "FGTB Bruxelles") donc
 * on ne touche pas.
 */
export function displayBureauName(bureau: Pick<BureauResult, 'type' | 'name'>): string {
  if (bureau.type === 'ONEM') {
    const raw = bureau.name.trim()
    if (/^onem\b/i.test(raw)) return raw
    return `ONEM de ${toTitleCase(raw)}`
  }
  return bureau.name
}

/** "BRUXELLES" → "Bruxelles", "SAINT-JOSSE-TEN-NOODE" → "Saint-Josse-Ten-Noode", "L'ESCALE" → "L'Escale". */
function toTitleCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s\-'])\p{L}/gu, (m) => m.toUpperCase())
}
