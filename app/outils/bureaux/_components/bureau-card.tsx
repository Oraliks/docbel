'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Phone,
  Globe,
  Flag,
  X,
  Footprints,
  Car,
  ExternalLink,
} from 'lucide-react'
import { HoursTimeline } from './hours-timeline'
import { ReportForm } from './report-form'
import type { BureauResult } from './types'

interface Props {
  /** Label catégorie (CPAS, ONEM, MAISON COMMUNALE, ORGANISME DE PAIEMENT) */
  label: string
  /** Logo SVG du bureau/organisme (depuis components/icons/organismes). */
  logo?: React.ReactNode
  bureau: BureauResult | null
  /** Distance en km depuis le user (géoloc) ou centroïde commune (fallback). */
  distanceKm?: number | null
  fromUserLocation?: boolean
  /**
   * Si fourni, remplace toute la zone droite (utilisé par OpTabsCard pour
   * afficher les tabs en place du dropdown horaires).
   */
  rightSlot?: React.ReactNode
  /**
   * Si true, on n'affiche pas le bouton "Signaler une erreur" (utilisé par
   * OpTabsCard qui gère son propre flag en haut, avec les tabs).
   */
  hideReport?: boolean
}

/**
 * Card uniforme : header avec label + flag, ligne logo+infos+distances+horaires,
 * bouton "Voir l'itinéraire" toujours présent (utilise lat/lng si dispo,
 * sinon fallback sur l'adresse texte pour Google Maps).
 */
export function BureauCard({
  label,
  logo,
  bureau,
  distanceKm,
  fromUserLocation,
  rightSlot,
  hideReport,
}: Props) {
  const [showReport, setShowReport] = useState(false)

  if (!bureau) {
    return (
      <Card>
        <CardContent className="p-4">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
            {label}
          </span>
          <p className="text-xs text-muted-foreground italic mt-2">
            Aucun bureau attitré trouvé pour cette commune.
          </p>
        </CardContent>
      </Card>
    )
  }

  const walkingMin =
    distanceKm !== null && distanceKm !== undefined
      ? Math.max(1, Math.round((distanceKm / 5) * 60))
      : null
  const drivingMin =
    distanceKm !== null && distanceKm !== undefined
      ? Math.max(1, Math.round((distanceKm / 30) * 60))
      : null

  return (
    <Card>
      <CardContent className="p-3.5 space-y-2.5">
        {/* Header : label + flag report */}
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
            {label}
          </p>
          {!hideReport && (
            <FlagToggle
              active={showReport}
              onToggle={() => setShowReport(!showReport)}
            />
          )}
        </div>

        {showReport ? (
          <ReportForm bureauId={bureau.id} onClose={() => setShowReport(false)} />
        ) : (
          <>
            <div className="flex flex-col md:flex-row md:items-start gap-3">
              {/* Logo + nom + addr + contact */}
              <div className="flex gap-3 flex-1 min-w-0">
                {logo && <div className="shrink-0">{logo}</div>}
                <div className="min-w-0 flex-1 space-y-0.5">
                  <h3 className="text-sm font-semibold leading-tight">
                    {bureau.name}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-snug">
                    {bureau.street}
                    {bureau.streetNum ? ` ${bureau.streetNum}` : ''},{' '}
                    {bureau.postalCode} {bureau.city}
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs pt-0.5">
                    {bureau.phone && (
                      <a
                        href={`tel:${bureau.phone.replace(/\s/g, '')}`}
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <Phone className="w-3 h-3" />
                        {bureau.phone}
                      </a>
                    )}
                    {bureau.website && (
                      <a
                        href={bureau.website}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <Globe className="w-3 h-3" />
                        {shortDomain(bureau.website)}
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Distances */}
              {(walkingMin !== null || drivingMin !== null) && (
                <div
                  className="flex md:flex-col md:items-end gap-3 md:gap-1.5 shrink-0 md:min-w-[80px]"
                  title={
                    fromUserLocation
                      ? 'depuis ta position'
                      : 'depuis le centre de la commune'
                  }
                >
                  {distanceKm !== null && distanceKm !== undefined && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                      <Footprints className="w-3.5 h-3.5" />
                      {formatDistance(distanceKm)}
                    </span>
                  )}
                  {drivingMin !== null && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                      <Car className="w-3.5 h-3.5" />
                      {drivingMin} min
                    </span>
                  )}
                </div>
              )}

              {/* Horaires (ou rightSlot custom) */}
              <div className="shrink-0 md:w-[200px]">
                {rightSlot ?? (
                  <HoursTimeline
                    hours={bureau.hours}
                    notes={bureau.hoursNotes}
                    type={bureau.type}
                  />
                )}
              </div>

              {/* CTA itinéraire — toujours présent */}
              <div className="shrink-0">
                <ItineraireButton bureau={bureau} />
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Bouton itinéraire toujours présent. Utilise lat/lng si dispo (plus précis,
 * pas d'ambiguïté), sinon fallback sur l'adresse texte (concat
 * street + streetNum + CP + ville) que Google Maps sait résoudre.
 */
function ItineraireButton({ bureau }: { bureau: BureauResult }) {
  const destination =
    bureau.lat !== null && bureau.lng !== null
      ? `${bureau.lat},${bureau.lng}`
      : encodeURIComponent(
          `${bureau.street}${bureau.streetNum ? ' ' + bureau.streetNum : ''}, ${bureau.postalCode} ${bureau.city}, Belgique`
        )
  return (
    <Button
      render={
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${destination}`}
          target="_blank"
          rel="noreferrer"
        />
      }
      variant="outline"
      size="sm"
      className="h-8 text-xs gap-1 px-3"
    >
      Itinéraire
      <ExternalLink className="w-3 h-3 opacity-70" />
    </Button>
  )
}

/** Rendu détail sans header — utilisé par OpTabsCard. */
export function BureauContent({
  bureau,
  distanceKm,
  fromUserLocation,
}: {
  bureau: BureauResult | null
  distanceKm?: number | null
  fromUserLocation?: boolean
}) {
  if (!bureau) {
    return (
      <p className="text-xs text-muted-foreground italic">
        Aucun bureau attitré trouvé pour cette commune.
      </p>
    )
  }
  const drivingMin =
    distanceKm !== null && distanceKm !== undefined
      ? Math.max(1, Math.round((distanceKm / 30) * 60))
      : null
  return (
    <div className="space-y-2.5">
      <div className="flex flex-col md:flex-row md:items-start gap-3">
        <div className="flex-1 min-w-0 space-y-0.5">
          <h3 className="text-sm font-semibold leading-tight">{bureau.name}</h3>
          <p className="text-xs text-muted-foreground leading-snug">
            {bureau.street}
            {bureau.streetNum ? ` ${bureau.streetNum}` : ''},{' '}
            {bureau.postalCode} {bureau.city}
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs pt-0.5">
            {bureau.phone && (
              <a
                href={`tel:${bureau.phone.replace(/\s/g, '')}`}
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <Phone className="w-3 h-3" />
                {bureau.phone}
              </a>
            )}
            {bureau.website && (
              <a
                href={bureau.website}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <Globe className="w-3 h-3" />
                {shortDomain(bureau.website)}
              </a>
            )}
          </div>
        </div>
        {distanceKm !== null && distanceKm !== undefined && (
          <div
            className="flex md:flex-col md:items-end gap-3 md:gap-1.5 shrink-0"
            title={
              fromUserLocation
                ? 'depuis ta position'
                : 'depuis le centre de la commune'
            }
          >
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
              <Footprints className="w-3.5 h-3.5" />
              {formatDistance(distanceKm)}
            </span>
            {drivingMin !== null && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                <Car className="w-3.5 h-3.5" />
                {drivingMin} min
              </span>
            )}
          </div>
        )}
        <div className="shrink-0 md:w-[200px]">
          <HoursTimeline
            hours={bureau.hours}
            notes={bureau.hoursNotes}
            type={bureau.type}
          />
        </div>
        <div className="shrink-0">
          <ItineraireButton bureau={bureau} />
        </div>
      </div>
    </div>
  )
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  if (km < 10) return `${km.toFixed(1)} km`
  return `${Math.round(km)} km`
}

function shortDomain(url: string): string {
  try {
    const u = new URL(url)
    return u.hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function FlagToggle({
  active,
  onToggle,
}: {
  active: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={active ? 'Fermer le signalement' : 'Signaler une erreur'}
      aria-label={active ? 'Fermer le signalement' : 'Signaler une erreur'}
      className="text-muted-foreground hover:text-red-600 transition-colors shrink-0 p-1 -m-1 rounded"
    >
      {active ? <X className="w-4 h-4" /> : <Flag className="w-3.5 h-3.5" />}
    </button>
  )
}
