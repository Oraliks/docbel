'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Phone,
  Globe,
  Flag,
  X,
  MapPin,
  Footprints,
  Car,
  Sparkles,
  ExternalLink,
} from 'lucide-react'
import { HoursTimeline } from './hours-timeline'
import { ReportForm } from './report-form'
import type { BureauResult } from './types'

interface Props {
  /** Label catégorie (CPAS, ONEM (CHÔMAGE), MAISON COMMUNALE, ORGANISME DE PAIEMENT) */
  label: string
  /** Logo SVG du bureau/organisme (depuis components/icons/organismes). */
  logo?: React.ReactNode
  bureau: BureauResult | null
  /** Distance en km depuis le user (géoloc) ou centroïde commune (fallback). */
  distanceKm?: number | null
  fromUserLocation?: boolean
  /**
   * featured = card mise en avant (badge "Recommandé pour toi", taille plus
   * grosse, CTA primary violet). default = compact, CTA outline.
   */
  variant?: 'featured' | 'default'
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

export function BureauCard({
  label,
  logo,
  bureau,
  distanceKm,
  fromUserLocation,
  variant = 'default',
  rightSlot,
  hideReport,
}: Props) {
  const [showReport, setShowReport] = useState(false)
  const isFeatured = variant === 'featured'

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
    <Card
      className={
        isFeatured
          ? 'border-primary/60 ring-1 ring-primary/30 bg-primary/[0.025]'
          : ''
      }
    >
      <CardContent className={isFeatured ? 'p-4 space-y-3' : 'p-3.5 space-y-2.5'}>
        {/* Badge "Recommandé pour toi" en haut (featured uniquement) */}
        {isFeatured && (
          <div className="flex items-center justify-between gap-2">
            <Badge className="gap-1 bg-primary text-primary-foreground hover:bg-primary text-[10px] tracking-wider uppercase">
              <Sparkles className="w-3 h-3" />
              Recommandé pour toi
            </Badge>
            {!hideReport && (
              <FlagToggle
                active={showReport}
                onToggle={() => setShowReport(!showReport)}
              />
            )}
          </div>
        )}

        {showReport ? (
          <ReportForm bureauId={bureau.id} onClose={() => setShowReport(false)} />
        ) : (
          <>
            {/* Layout horizontal */}
            <div className="flex flex-col md:flex-row md:items-start gap-3">
              {/* Zone 1 : logo + label + nom + addr + contact */}
              <div className="flex gap-3 flex-1 min-w-0">
                {logo && (
                  <div className="shrink-0">
                    {logo}
                  </div>
                )}
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p
                    className={`text-[10px] uppercase font-semibold tracking-wider ${
                      isFeatured ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    {label}
                  </p>
                  <h3
                    className={`font-semibold leading-tight ${
                      isFeatured ? 'text-base' : 'text-sm'
                    }`}
                  >
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

              {/* Zone 2 : distances (verticales) */}
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

              {/* Zone 3 : horaires (dropdown) ou rightSlot custom */}
              <div
                className={`shrink-0 ${
                  isFeatured ? 'md:w-[220px]' : 'md:w-[200px]'
                }`}
              >
                {rightSlot ?? (
                  <HoursTimeline
                    hours={bureau.hours}
                    notes={bureau.hoursNotes}
                    type={bureau.type}
                  />
                )}
              </div>

              {/* Zone 4 : CTA itinéraire + flag pour non-featured */}
              <div className="flex md:flex-col items-center md:items-end gap-2 shrink-0">
                {bureau.lat !== null && bureau.lng !== null && (
                  <Button
                    render={
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${bureau.lat},${bureau.lng}`}
                        target="_blank"
                        rel="noreferrer"
                      />
                    }
                    variant={isFeatured ? 'default' : 'outline'}
                    size="sm"
                    className={`h-8 text-xs gap-1 ${
                      isFeatured ? 'px-4' : 'px-3'
                    }`}
                  >
                    {isFeatured ? "Voir l'itinéraire" : 'Itinéraire'}
                    <ExternalLink className="w-3 h-3 opacity-70" />
                  </Button>
                )}
                {!isFeatured && !hideReport && (
                  <FlagToggle
                    active={showReport}
                    onToggle={() => setShowReport(!showReport)}
                  />
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

/** Rendu détail sans header — utilisé par OpTabsCard (qui gère son label). */
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
    <div className="space-y-3">
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
        <div className="md:w-[200px] shrink-0">
          <HoursTimeline
            hours={bureau.hours}
            notes={bureau.hoursNotes}
            type={bureau.type}
          />
        </div>
      </div>
      {bureau.lat !== null && bureau.lng !== null && (
        <Button
          render={
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${bureau.lat},${bureau.lng}`}
              target="_blank"
              rel="noreferrer"
            />
          }
          variant="outline"
          size="sm"
          className="w-full h-8 text-xs gap-1"
        >
          <MapPin className="w-3 h-3" />
          Voir l&apos;itinéraire
          <ExternalLink className="w-3 h-3 ml-0.5 opacity-60" />
        </Button>
      )}
    </div>
  )
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  if (km < 10) return `${km.toFixed(1)} km`
  return `${Math.round(km)} km`
}

/** "https://www.onem.be/foo" → "onem.be" */
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
