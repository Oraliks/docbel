'use client'

import { Clock, Info } from 'lucide-react'

interface HourSlot {
  open: string
  close: string
}
interface DayHours {
  day: number
  slots: HourSlot[]
}

interface Props {
  hours: DayHours[]
  notes?: string | null
  /** Type Bureau pour décider d'afficher samedi/dimanche ou pas. */
  type: string
}

/**
 * Timeline horaires visuelle : barre horizontale lun-dim avec créneaux ouverts
 * en violet. Plus rapide à scanner que la liste textuelle.
 *
 * Échelle fixe 7h → 19h (12h utiles). Les horaires hors plage sont quand même
 * dessinés mais en dehors de la grille — rare mais bon de pas crash.
 */

const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const DAYS_ORDER = [1, 2, 3, 4, 5, 6, 0] // Lundi → Dimanche

const SCALE_START = 7 // 7h
const SCALE_END = 19 // 19h

function timeToFraction(time: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim())
  if (!m) return null
  const h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  const fraction = (h + min / 60 - SCALE_START) / (SCALE_END - SCALE_START)
  return Math.max(0, Math.min(1, fraction))
}

export function HoursTimeline({ hours, notes, type }: Props) {
  // ONEM et OP : weekend toujours fermé, on masque pour pas polluer
  const hideWeekend = type !== 'COMMUNE' && type !== 'CPAS'
  const visibleDays = DAYS_ORDER.filter((d) => {
    if (hideWeekend && (d === 0 || d === 6)) return false
    return true
  })

  const byDay = new Map<number, HourSlot[]>()
  for (const d of hours ?? []) byDay.set(d.day, d.slots)

  // Si aucune vraie donnée horaire → on cache (mieux que tout "Fermé")
  const hasData = (hours ?? []).some((d) => d.slots.length > 0)
  if (!hasData) return null

  return (
    <div className="pt-3 border-t border-border/60 space-y-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
        <Clock className="w-3 h-3" /> Horaires
        <span className="ml-auto text-[10px] normal-case font-normal tracking-normal text-muted-foreground/70">
          {SCALE_START}h–{SCALE_END}h
        </span>
      </div>

      <div className="space-y-1">
        {visibleDays.map((day) => {
          const slots = byDay.get(day) ?? []
          const closed = slots.length === 0
          return (
            <div key={day} className="flex items-center gap-2">
              <span
                className={`w-4 text-[10px] font-semibold text-center ${
                  closed ? 'text-muted-foreground/40' : 'text-foreground'
                }`}
              >
                {DAY_LABELS[day === 0 ? 6 : day - 1]}
              </span>
              <div className="relative flex-1 h-3 rounded-sm bg-muted/60 overflow-hidden">
                {slots.map((s, i) => {
                  const from = timeToFraction(s.open)
                  const to = timeToFraction(s.close)
                  if (from === null || to === null || to <= from) return null
                  return (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 bg-primary/70 hover:bg-primary transition-colors"
                      style={{
                        left: `${from * 100}%`,
                        width: `${(to - from) * 100}%`,
                      }}
                      title={`${s.open} – ${s.close}`}
                    />
                  )
                })}
              </div>
              <span
                className={`text-[10px] tabular-nums w-[88px] text-right ${
                  closed ? 'text-muted-foreground/50 italic' : 'text-muted-foreground'
                }`}
              >
                {closed
                  ? 'Fermé'
                  : slots.map((s) => `${s.open}–${s.close}`).join(' · ')}
              </span>
            </div>
          )
        })}
      </div>

      {notes && (
        <p className="text-[10px] text-muted-foreground italic">{notes}</p>
      )}

      <p className="flex items-start gap-1 text-[10px] text-muted-foreground/80">
        <Info className="w-3 h-3 shrink-0 mt-0.5" />
        <span>
          Certaines fermetures exceptionnelles (jours fériés régionaux, ponts, etc.)
          ne sont pas listées ici. Confirme par téléphone ou sur le site de
          l&apos;organisme avant de te déplacer.
        </span>
      </p>
    </div>
  )
}
