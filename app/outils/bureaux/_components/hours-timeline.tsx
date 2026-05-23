'use client'

import { useState } from 'react'
import { Clock, ChevronDown, ChevronUp, Info } from 'lucide-react'

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
 * Horaires compacts : affiche par défaut UNIQUEMENT le jour en cours
 * + statut (ouvert maintenant / fermé). Bouton "Voir tous les jours" ouvre
 * une timeline visuelle (barre lun-dim).
 *
 * Objectif : ne pas inonder la card. La 99% des users veut juste savoir
 * "c'est ouvert maintenant ?".
 */

const DAY_LABELS_SHORT = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.']
const DAY_LABELS_TINY = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
const DAYS_ORDER = [1, 2, 3, 4, 5, 6, 0] // Lun → Dim

const SCALE_START = 7
const SCALE_END = 19

function timeToFraction(time: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim())
  if (!m) return null
  const h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  const fraction = (h + min / 60 - SCALE_START) / (SCALE_END - SCALE_START)
  return Math.max(0, Math.min(1, fraction))
}

function timeToMinutes(time: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim())
  if (!m) return 0
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
}

function nowMinutes(): number {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

function jsDayToOurDay(d: number): number {
  return d // js Date.getDay() : 0=dim, 1=lun, ..., 6=sam — aligné avec notre format
}

interface Status {
  label: string
  tone: 'open' | 'closed' | 'soon'
  detail?: string
}

function computeStatus(slots: HourSlot[]): Status {
  if (slots.length === 0) return { label: 'Fermé aujourd’hui', tone: 'closed' }
  const now = nowMinutes()
  for (const s of slots) {
    const open = timeToMinutes(s.open)
    const close = timeToMinutes(s.close)
    if (now >= open && now < close) {
      return {
        label: 'Ouvert',
        tone: 'open',
        detail: `jusqu'à ${s.close}`,
      }
    }
    if (now < open) {
      const diff = open - now
      if (diff <= 60) {
        return {
          label: 'Bientôt ouvert',
          tone: 'soon',
          detail: `à ${s.open}`,
        }
      }
      return {
        label: 'Fermé',
        tone: 'closed',
        detail: `ouvre à ${s.open}`,
      }
    }
  }
  return { label: 'Fermé', tone: 'closed' }
}

export function HoursTimeline({ hours, notes, type }: Props) {
  const [expanded, setExpanded] = useState(false)

  const hideWeekend = type !== 'COMMUNE' && type !== 'CPAS'
  const allDays = (hours ?? []).filter((d) => {
    if (hideWeekend && (d.day === 0 || d.day === 6)) return false
    return true
  })

  const hasData = allDays.some((d) => d.slots.length > 0)
  if (!hasData) return null

  const today = jsDayToOurDay(new Date().getDay())
  const todaySlots = (hours ?? []).find((d) => d.day === today)?.slots ?? []
  const status = computeStatus(todaySlots)

  return (
    <div className="pt-2 border-t border-border/60 space-y-1.5">
      {/* Ligne compacte : statut + jour en cours + toggle */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
          <StatusPill status={status} />
          <span className="text-muted-foreground truncate">
            {todaySlots.length > 0
              ? todaySlots.map((s) => `${s.open}–${s.close}`).join(' · ')
              : '—'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          {expanded ? (
            <>
              Voir moins <ChevronUp className="w-3 h-3" />
            </>
          ) : (
            <>
              Voir tous les jours <ChevronDown className="w-3 h-3" />
            </>
          )}
        </button>
      </div>

      {/* Vue déployée : timeline visuelle lun-dim */}
      {expanded && (
        <div className="space-y-1 pt-1">
          {DAYS_ORDER.filter((d) => {
            if (hideWeekend && (d === 0 || d === 6)) return false
            return true
          }).map((day) => {
            const slots = (hours ?? []).find((d) => d.day === day)?.slots ?? []
            const closed = slots.length === 0
            const isToday = day === today
            return (
              <div key={day} className="flex items-center gap-2">
                <span
                  className={`w-3 text-[9px] font-semibold text-center ${
                    isToday
                      ? 'text-primary'
                      : closed
                        ? 'text-muted-foreground/40'
                        : 'text-foreground'
                  }`}
                >
                  {DAY_LABELS_TINY[day]}
                </span>
                <div
                  className={`relative flex-1 h-2 rounded-sm overflow-hidden ${
                    isToday ? 'bg-primary/10' : 'bg-muted/60'
                  }`}
                >
                  {slots.map((s, i) => {
                    const from = timeToFraction(s.open)
                    const to = timeToFraction(s.close)
                    if (from === null || to === null || to <= from) return null
                    return (
                      <div
                        key={i}
                        className={`absolute top-0 bottom-0 ${
                          isToday ? 'bg-primary' : 'bg-primary/60'
                        }`}
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
                  className={`text-[9px] tabular-nums w-[80px] text-right ${
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

          {notes && (
            <p className="text-[10px] text-muted-foreground italic pt-1">{notes}</p>
          )}

          <p className="flex items-start gap-1 text-[10px] text-muted-foreground/80 pt-1">
            <Info className="w-2.5 h-2.5 shrink-0 mt-0.5" />
            <span>
              Certaines fermetures exceptionnelles (jours fériés, ponts) ne sont
              pas listées ici. Confirme par téléphone ou sur le site avant de
              te déplacer.
            </span>
          </p>
        </div>
      )}
    </div>
  )
}

function StatusPill({ status }: { status: Status }) {
  const cls =
    status.tone === 'open'
      ? 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300'
      : status.tone === 'soon'
        ? 'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300'
        : 'bg-muted text-muted-foreground'
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${cls}`}>
      <span
        className={`size-1.5 rounded-full ${
          status.tone === 'open'
            ? 'bg-green-500'
            : status.tone === 'soon'
              ? 'bg-orange-500'
              : 'bg-muted-foreground/40'
        }`}
      />
      {status.label}
      {status.detail && (
        <span className="font-normal opacity-80">· {status.detail}</span>
      )}
    </span>
  )
}

// Unused export pour éviter de casser ailleurs si DAY_LABELS_SHORT est référencé
export const _DAY_LABELS_SHORT = DAY_LABELS_SHORT
