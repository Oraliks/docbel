'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  HelpCircle,
  Phone,
  Globe,
  Footprints,
  Car,
  ExternalLink,
} from 'lucide-react'
import { FlagToggle } from './bureau-card'
import { HoursTimeline } from './hours-timeline'
import { ReportForm } from './report-form'
import { OpHelpModal } from './op-help-modal'
import { haversineKm, type UserGeoloc } from './geoloc-banner'
import { OrganismeLogo } from '@/components/icons/organismes'
import type { BureauResult, CommuneSummary } from './types'

interface Props {
  bureaux: BureauResult[]
  commune: CommuneSummary | null
  userGeoloc: UserGeoloc | null
}

const ORDER = ['capac', 'fgtb', 'csc', 'cgslb']

/**
 * OP card alignée sur le layout standard BureauCard :
 *  - Header : label "ORGANISME DE PAIEMENT" + flag report
 *  - Strip tabs CAPAC/FGTB/CSC/CGSLB + lien "Quel OP choisir ?"
 *  - Content row : logo (dynamique selon tab) | contact (340px) | distances
 *    (80px) | horaires (flex-1) | bouton itinéraire
 *
 * Le content row reprend exactement les widths de BureauCard pour que toutes
 * les cards (ONEM, CPAS, Commune, OP) soient parfaitement alignées
 * visuellement.
 */
export function OpTabsCard({ bureaux, commune, userGeoloc }: Props) {
  const [activeIdx, setActiveIdx] = useState(0)
  const [showReport, setShowReport] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  const sorted = [...bureaux].sort(
    (a, b) =>
      ORDER.indexOf(a.organismeCode ?? '') -
      ORDER.indexOf(b.organismeCode ?? '')
  )
  const active = sorted[activeIdx] ?? sorted[0]
  if (!active) return null

  const switchTab = (i: number) => {
    setActiveIdx(i)
    setShowReport(false)
  }

  const ref =
    userGeoloc ??
    (commune?.lat != null && commune?.lng != null
      ? { lat: commune.lat, lng: commune.lng }
      : null)
  const distanceKm =
    ref && active.lat !== null && active.lng !== null
      ? haversineKm(ref, { lat: active.lat, lng: active.lng })
      : null
  const drivingMin =
    distanceKm !== null ? Math.max(1, Math.round((distanceKm / 30) * 60)) : null

  return (
    <>
      <Card>
        <CardContent className="p-3.5 space-y-2.5">
          {/* Header label + flag */}
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
              Organisme de paiement
            </p>
            <FlagToggle
              active={showReport}
              onToggle={() => setShowReport((v) => !v)}
            />
          </div>

          {/* Strip tabs + help link */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex flex-wrap gap-1.5">
              {sorted.map((b, i) => {
                const isActive = i === activeIdx
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => switchTab(i)}
                    className={`px-2 py-0.5 text-[10px] rounded-md border transition-colors font-semibold ${
                      isActive
                        ? 'border-transparent text-white'
                        : 'border-input bg-background hover:bg-muted text-foreground'
                    }`}
                    style={
                      isActive && b.organismeColor
                        ? {
                            backgroundColor: b.organismeColor,
                            borderColor: b.organismeColor,
                          }
                        : undefined
                    }
                  >
                    {b.organismeName ?? b.organismeCode}
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline shrink-0"
            >
              <HelpCircle className="w-3 h-3" />
              Quel organisme choisir&nbsp;?
            </button>
          </div>

          {/* Content row — même structure exacte que BureauCard pour alignement */}
          {showReport ? (
            <ReportForm
              bureauId={active.id}
              onClose={() => setShowReport(false)}
            />
          ) : (
            <div className="flex flex-col md:flex-row md:items-stretch gap-3">
              {/* Contact zone : 340px fixe (= BureauCard) */}
              <div className="flex gap-3 shrink-0 md:w-[340px] min-w-0">
                <div className="shrink-0">
                  <OrganismeLogo code={active.organismeCode} size={48} />
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <h3 className="text-sm font-semibold leading-tight">
                    {active.name}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-snug">
                    {active.street}
                    {active.streetNum ? ` ${active.streetNum}` : ''},{' '}
                    {active.postalCode} {active.city}
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs pt-0.5">
                    {active.phone && (
                      <a
                        href={`tel:${active.phone.replace(/\s/g, '')}`}
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <Phone className="w-3 h-3" />
                        {active.phone}
                      </a>
                    )}
                    {active.website && (
                      <a
                        href={active.website}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <Globe className="w-3 h-3" />
                        {shortDomain(active.website)}
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Distances : 80px fixe (= BureauCard) */}
              <div
                className="flex md:flex-col md:items-end gap-3 md:gap-1.5 shrink-0 md:w-[80px]"
                title={userGeoloc ? 'depuis ta position' : 'depuis le centre de la commune'}
              >
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                  <Footprints className="w-3.5 h-3.5" />
                  {distanceKm !== null
                    ? formatDistance(distanceKm)
                    : <span className="text-muted-foreground/40">—</span>}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                  <Car className="w-3.5 h-3.5" />
                  {drivingMin !== null
                    ? `${drivingMin} min`
                    : <span className="text-muted-foreground/40">—</span>}
                </span>
              </div>

              {/* Horaires : flex-1 (= BureauCard) */}
              <div className="flex-1 min-w-0 md:min-w-[260px]">
                <HoursTimeline
                  hours={active.hours}
                  notes={active.hoursNotes}
                  type={active.type}
                  onReport={() => setShowReport(true)}
                />
              </div>

              {/* Itineraire button (= BureauCard) */}
              <div className="shrink-0">
                <ItineraireButton bureau={active} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <OpHelpModal open={helpOpen} onOpenChange={setHelpOpen} />
    </>
  )
}

/** Reproduction locale du bouton Itinéraire (avec animation) — évite import circulaire. */
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
      className="group h-8 text-xs gap-1 px-3 relative overflow-hidden transition-all hover:scale-[1.03] hover:border-primary hover:text-primary hover:shadow-[0_0_0_3px_color-mix(in_oklab,var(--primary)_15%,transparent)]"
    >
      <span className="relative z-10">Itinéraire</span>
      <ExternalLink className="relative z-10 w-3 h-3 opacity-70 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
      <span className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/15 to-transparent animate-cta-shimmer pointer-events-none" />
    </Button>
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
