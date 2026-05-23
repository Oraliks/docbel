'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { HelpCircle } from 'lucide-react'
import { BureauContent, FlagToggle } from './bureau-card'
import { ReportForm } from './report-form'
import { OpHelpModal } from './op-help-modal'
import { haversineKm, type UserGeoloc } from './geoloc-banner'
import { OrganismeLogo, OpLogo } from '@/components/icons/organismes'
import type { BureauResult, CommuneSummary } from './types'

interface Props {
  bureaux: BureauResult[]
  commune: CommuneSummary | null
  userGeoloc: UserGeoloc | null
}

const ORDER = ['capac', 'fgtb', 'csc', 'cgslb']

/**
 * Card OP avec tabs CAPAC/FGTB/CSC/CGSLB. Le logo affiché à gauche change
 * selon l'OP actif (OrganismeLogo dispatch). Lien "Quel organisme choisir ?"
 * ouvre la modal éducative.
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

  return (
    <>
      <Card>
        <CardContent className="p-3.5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="shrink-0">
              <OrganismeLogo code={active.organismeCode} size={48} />
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                  Organisme de paiement
                </p>
                <FlagToggle
                  active={showReport}
                  onToggle={() => setShowReport((v) => !v)}
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                {sorted.map((b, i) => {
                  const isActive = i === activeIdx
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => switchTab(i)}
                      className={`px-2.5 py-1 text-[11px] rounded-md border transition-colors font-medium ${
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
                className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
              >
                <HelpCircle className="w-3 h-3" />
                Quel organisme de paiement choisir&nbsp;?
              </button>
            </div>
          </div>

          {showReport ? (
            <ReportForm
              bureauId={active.id}
              onClose={() => setShowReport(false)}
            />
          ) : (
            <BureauContent
              bureau={active}
              distanceKm={distanceKm}
              fromUserLocation={!!userGeoloc}
            />
          )}
        </CardContent>
      </Card>

      <OpHelpModal open={helpOpen} onOpenChange={setHelpOpen} />
    </>
  )
}

// Re-export utile au cas où on veuille référencer ailleurs
export { OpLogo }
