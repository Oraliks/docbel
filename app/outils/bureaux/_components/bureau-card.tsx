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
  title: string
  icon?: React.ReactNode
  iconBg?: string // gradient/color pour le carré icon
  bureau: BureauResult | null
  /** Distance en km depuis le user (géoloc) ou centroïde commune (fallback). */
  distanceKm?: number | null
  /** Le user est-il géolocalisé ? Influence le label "depuis chez toi" vs "depuis la commune". */
  fromUserLocation?: boolean
  /** Met en avant la card avec un badge "Recommandé" + bordure colorée. */
  recommended?: boolean
  recommendedReason?: string
  /** Header inutile si on est dans un OP wrapper (OrganismesPaiementCard gère). */
  hideHeader?: boolean
}

/**
 * Card horizontale 3-zones (style mockup) :
 *
 *  ┌────────────────────────────────────────────────────────────┐
 *  │ [icon] Nom du bureau              [Horaires ⌄]  [850 m  ]  │
 *  │        Adresse                                  [10 min  ]  │
 *  │        📞 phone · 🌐 site                                   │
 *  │ ─────────────────────────────────────────────────────────  │
 *  │ [             Voir l'itinéraire (outline button)        ]  │
 *  └────────────────────────────────────────────────────────────┘
 *
 * En mobile, les zones s'empilent verticalement.
 */
export function BureauCard({
  title,
  icon,
  iconBg,
  bureau,
  distanceKm,
  fromUserLocation,
  recommended,
  recommendedReason,
  hideHeader,
}: Props) {
  const [showReport, setShowReport] = useState(false)

  if (!bureau) {
    return (
      <Card>
        <CardContent className="p-4">
          {!hideHeader && (
            <span className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">
              {title}
            </span>
          )}
          <p className="text-xs text-muted-foreground italic mt-2">
            Aucun bureau attitré trouvé pour cette commune.
          </p>
        </CardContent>
      </Card>
    )
  }

  const drivingMin = distanceKm !== null && distanceKm !== undefined
    ? Math.max(1, Math.round((distanceKm / 30) * 60)) // ~30km/h urbain moyen
    : null
  const walkingMin = distanceKm !== null && distanceKm !== undefined
    ? Math.max(1, Math.round((distanceKm / 5) * 60)) // ~5km/h marche
    : null

  return (
    <Card
      className={
        recommended
          ? 'border-primary/60 ring-1 ring-primary/30 bg-primary/[0.025]'
          : ''
      }
    >
      <CardContent className="p-4 space-y-3">
        {/* Badge Recommandé en haut */}
        {recommended && (
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="gap-1 bg-primary text-primary-foreground hover:bg-primary">
              <Sparkles className="w-3 h-3" />
              Recommandé
            </Badge>
            {recommendedReason && (
              <span className="text-[10px] text-muted-foreground italic">
                {recommendedReason}
              </span>
            )}
          </div>
        )}

        {/* Si formulaire signalement ouvert, on remplace tout le contenu */}
        {showReport ? (
          <ReportForm bureauId={bureau.id} onClose={() => setShowReport(false)} />
        ) : (
          <>
            {/* Header : icon + titre catégorie + flag report */}
            {!hideHeader && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                  {title}
                </span>
                <FlagToggle
                  active={showReport}
                  onToggle={() => setShowReport(true)}
                />
              </div>
            )}

            {/* Layout horizontal : icon+infos | horaires | distances */}
            <div className="flex flex-col md:flex-row md:items-start gap-4">
              {/* Zone 1 : icon + nom + addr + contact */}
              <div className="flex gap-3 flex-1 min-w-0">
                {icon && (
                  <span
                    className="flex size-12 items-center justify-center rounded-xl text-white shrink-0"
                    style={{
                      background:
                        iconBg ??
                        'linear-gradient(135deg, var(--primary), color-mix(in oklab, var(--primary) 70%, white))',
                    }}
                  >
                    {icon}
                  </span>
                )}
                <div className="min-w-0 space-y-1">
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
                        Site web
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Zone 2 : horaires (dropdown) */}
              <div className="md:w-[260px] shrink-0">
                <HoursTimeline
                  hours={bureau.hours}
                  notes={bureau.hoursNotes}
                  type={bureau.type}
                />
              </div>

              {/* Zone 3 : distances + flag report (top-right si pas de header) */}
              <div className="flex md:flex-col md:items-end md:w-[100px] shrink-0 gap-3 md:gap-1.5 items-center">
                {hideHeader && (
                  <FlagToggle
                    active={showReport}
                    onToggle={() => setShowReport(true)}
                  />
                )}
                {walkingMin !== null && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                    <Footprints className="w-3.5 h-3.5" />
                    {formatDistance(distanceKm!)}
                  </span>
                )}
                {drivingMin !== null && (
                  <span
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums"
                    title={fromUserLocation ? 'depuis ta position' : 'depuis le centre de la commune'}
                  >
                    <Car className="w-3.5 h-3.5" />
                    {drivingMin} min
                  </span>
                )}
              </div>
            </div>

            {/* CTA itinéraire pleine largeur */}
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
          </>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Rendu détail seul (sans header / badge / cta) — utilisé par OpTabsCard
 * qui réutilise une variante "embedded".
 */
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
  const drivingMin = distanceKm !== null && distanceKm !== undefined
    ? Math.max(1, Math.round((distanceKm / 30) * 60))
    : null
  return (
    <div className="space-y-3">
      <div className="flex flex-col md:flex-row md:items-start gap-4">
        <div className="flex-1 min-w-0 space-y-1">
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
                Site web
              </a>
            )}
          </div>
        </div>
        <div className="md:w-[260px] shrink-0">
          <HoursTimeline
            hours={bureau.hours}
            notes={bureau.hoursNotes}
            type={bureau.type}
          />
        </div>
        <div className="flex md:flex-col md:items-end md:w-[100px] shrink-0 gap-3 md:gap-1.5 items-center">
          {distanceKm !== null && distanceKm !== undefined && (
            <>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                <Footprints className="w-3.5 h-3.5" />
                {formatDistance(distanceKm)}
              </span>
              {drivingMin !== null && (
                <span
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums"
                  title={fromUserLocation ? 'depuis ta position' : 'depuis le centre de la commune'}
                >
                  <Car className="w-3.5 h-3.5" />
                  {drivingMin} min
                </span>
              )}
            </>
          )}
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
      className="text-muted-foreground hover:text-red-600 transition-colors shrink-0"
    >
      {active ? <X className="w-4 h-4" /> : <Flag className="w-3.5 h-3.5" />}
    </button>
  )
}
