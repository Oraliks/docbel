'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Phone,
  Mail,
  Globe,
  Flag,
  X,
  MapPin,
  Footprints,
  Sparkles,
  ExternalLink,
} from 'lucide-react'
import { HoursTimeline } from './hours-timeline'
import { ReportForm } from './report-form'
import type { BureauResult } from './types'

interface Props {
  title: string
  icon?: React.ReactNode
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

export function BureauCard({
  title,
  icon,
  bureau,
  distanceKm,
  fromUserLocation,
  recommended,
  recommendedReason,
  hideHeader,
}: Props) {
  return (
    <Card
      className={
        recommended
          ? 'border-primary/60 ring-1 ring-primary/30 bg-primary/[0.03]'
          : ''
      }
    >
      {recommended && (
        <div className="flex items-center gap-1.5 px-4 pt-3 -mb-2">
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
      <CardContent className="p-4 space-y-2">
        {!hideHeader && (
          <CardHeader title={title} icon={icon} bureau={bureau} />
        )}
        <BureauContent
          bureau={bureau}
          distanceKm={distanceKm}
          fromUserLocation={fromUserLocation}
        />
      </CardContent>
    </Card>
  )
}

/** Header : titre + icône type + bouton signalement (si bureau présent). */
function CardHeader({
  title,
  icon,
  bureau,
}: {
  title: string
  icon?: React.ReactNode
  bureau: BureauResult | null
}) {
  const [showReport, setShowReport] = useState(false)
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {icon && (
            <span className="flex size-7 items-center justify-center rounded-md bg-muted text-foreground/70 shrink-0">
              {icon}
            </span>
          )}
          <span className="text-xs uppercase font-semibold text-muted-foreground tracking-wider truncate">
            {title}
          </span>
        </div>
        {bureau && (
          <FlagToggle
            active={showReport}
            onToggle={() => setShowReport((v) => !v)}
          />
        )}
      </div>
      {showReport && bureau && (
        <ReportForm bureauId={bureau.id} onClose={() => setShowReport(false)} />
      )}
    </>
  )
}

/**
 * Composant exposé pour permettre à OrganismesPaiementCard de réutiliser le
 * rendu détail sans réafficher le header (puisque les tabs servent de header).
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
  return (
    <>
      <div className="space-y-0.5">
        <h3 className="text-sm font-semibold">{bureau.name}</h3>
        <p className="text-xs text-muted-foreground">
          {bureau.street}
          {bureau.streetNum ? ` ${bureau.streetNum}` : ''}
          <br />
          {bureau.postalCode} {bureau.city}
        </p>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs pt-1">
        {bureau.phone && (
          <a
            href={`tel:${bureau.phone.replace(/\s/g, '')}`}
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            <Phone className="w-3 h-3" /> {bureau.phone}
          </a>
        )}
        {bureau.email && (
          <a
            href={`mailto:${bureau.email}`}
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            <Mail className="w-3 h-3" /> {bureau.email}
          </a>
        )}
        {bureau.website && (
          <a
            href={bureau.website}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            <Globe className="w-3 h-3" /> Site
          </a>
        )}
      </div>

      {distanceKm !== null && distanceKm !== undefined && (
        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Footprints className="w-3 h-3" />
          {distanceKm < 1
            ? `${Math.round(distanceKm * 1000)} m`
            : `${distanceKm.toFixed(1)} km`}{' '}
          {fromUserLocation ? 'depuis ta position' : 'depuis le centre de la commune'}
        </p>
      )}

      <HoursTimeline
        hours={bureau.hours}
        notes={bureau.hoursNotes}
        type={bureau.type}
      />

      {bureau.lat !== null && bureau.lng !== null && (
        <div className="pt-2">
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
            className="w-full h-8 text-xs"
          >
            <MapPin className="w-3 h-3 mr-1" />
            Voir l&apos;itinéraire
            <ExternalLink className="w-3 h-3 ml-1 opacity-60" />
          </Button>
        </div>
      )}
    </>
  )
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
