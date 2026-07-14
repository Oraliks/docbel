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
    emploiRegional: BureauResult | null
  }
  /** Bureaux de proximité (non attitrés), triés par distance côté serveur.
   * `autres` (type DB AUTRE) contient notamment les mutuelles/CAAMI proches :
   * le résolveur ne remplit `attitre.mutuelle` qu'avec un code mutuelle
   * explicite, donc le finder les surface depuis ici (cf. finder-model). */
  proximite?: {
    syndicats: BureauResult[]
    permanences: BureauResult[]
    autres: BureauResult[]
  }
  warnings: string[]
}

// DemarcheKey/recommendedBureauType retirés : le sélecteur de démarche a été
// jugé inutile par le user (pas d'usage clair). Si on veut réactiver un
// "Recommandé" contextuel un jour, c'est ici qu'il viendra.

// displayBureauName extrait dans lib/bureaus/format.ts pour être partagé
// avec l'admin (table annuaire + preview "côté user"). Ré-exporté ici
// pour ne pas casser les imports existants.
export { displayBureauName } from '@/lib/bureaus/format'
