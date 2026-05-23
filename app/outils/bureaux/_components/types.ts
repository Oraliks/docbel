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

export type DemarcheKey = 'chomage' | 'aide_sociale' | 'autre'

export const DEMARCHE_LABEL: Record<DemarcheKey, string> = {
  chomage: 'Chômage',
  aide_sociale: 'Aide sociale',
  autre: 'Autre démarche',
}

/**
 * Quel bureau mettre en avant selon la démarche. null = aucun (neutre).
 * Types Bureau possibles : ONEM, CPAS, COMMUNE, SYNDICAT.
 */
export function recommendedBureauType(demarche: DemarcheKey | null): string | null {
  if (demarche === 'chomage') return 'ONEM'
  if (demarche === 'aide_sociale') return 'CPAS'
  return null
}
