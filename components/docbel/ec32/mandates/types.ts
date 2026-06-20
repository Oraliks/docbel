// =====================================================================
//  eC3.2 — Gestion des accès (mandats) : types locaux
// ---------------------------------------------------------------------
//  Sous-système purement pédagogique : permet à un citoyen de donner
//  accès à sa Carte de chômage temporaire à un proche. Les types ne
//  vivent QUE dans ce dossier (pas d'import depuis lib/ec32/types) afin
//  de garder le mockup totalement autonome.
// =====================================================================

/** Périmètre d'accès : pour l'instant, uniquement la carte eC3.2. */
export type Ec32MandateScope = 'temporary_unemployment_card'

/** Statut visuel d'un accès (mandat). */
export type Ec32MandateStatus = 'active' | 'pending' | 'expired'

/** Un accès accordé / demandé / reçu, représenté en liste. */
export interface Ec32MandateAccess {
  id: string
  /** Prénom + nom (libellé), pas de NRN. */
  personName: string
  scope: Ec32MandateScope
  /** Libellé lisible du périmètre (FR). */
  scopeLabel: string
  status: Ec32MandateStatus
  /** Date ISO yyyy-mm-dd. */
  validUntil: string
}

/** Langue de la demande de mandat (FR/NL/DE). */
export type Ec32MandateLanguage = 'fr' | 'nl' | 'de'

/** Canal de transmission de la demande au citoyen. */
export type Ec32MandateTransmissionChannel = 'email' | 'qr' | 'link'

/** Brouillon de demande, manipulé par le wizard. */
export interface Ec32MandateDraft {
  scope: Ec32MandateScope | null
  /** Mode de durée : 1 an max (défaut) ou date butoir libre. */
  durationMode: 'max_1y' | 'until'
  /** Date ISO yyyy-mm-dd ou null si mode max_1y. */
  durationUntil: string | null
  personName: string
  personEmail: string
  language: Ec32MandateLanguage
  channel: Ec32MandateTransmissionChannel | null
}
