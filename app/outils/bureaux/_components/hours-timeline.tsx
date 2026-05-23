'use client'

import { useState } from 'react'
import { Clock, ChevronDown, Info } from 'lucide-react'

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
 * Horaires en bloc dropdown. État replié : juste un label avec statut temps
 * réel (Ouvert/Fermé/Bientôt ouvert) + chevron. État ouvert : liste regroupée
 * intelligemment par plages identiques (ex: "Lun. - Ven." pour les jours qui
 * ont les mêmes slots) + disclaimer fermetures exceptionnelles.
 */

const DAY_LABELS_SHORT = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.']
const DAYS_ORDER = [1, 2, 3, 4, 5, 6, 0] // Lun → Dim

function timeToMinutes(time: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim())
  if (!m) return 0
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
}

function nowMinutes(): number {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

interface Status {
  label: string
  tone: 'open' | 'closed' | 'soon'
  detail?: string
}

function computeStatus(slots: HourSlot[]): Status {
  if (slots.length === 0) return { label: 'Fermé', tone: 'closed' }
  const now = nowMinutes()
  for (const s of slots) {
    const open = timeToMinutes(s.open)
    const close = timeToMinutes(s.close)
    if (now >= open && now < close) {
      return { label: 'Ouvert', tone: 'open', detail: `jusqu'à ${s.close}` }
    }
    if (now < open) {
      const diff = open - now
      if (diff <= 60) {
        return { label: 'Bientôt ouvert', tone: 'soon', detail: `à ${s.open}` }
      }
      return { label: 'Fermé', tone: 'closed', detail: `ouvre à ${s.open}` }
    }
  }
  return { label: 'Fermé', tone: 'closed' }
}

/** Sérialise les slots d'un jour pour comparaison (regroupement). */
function slotsKey(slots: HourSlot[]): string {
  return slots.map((s) => `${s.open}-${s.close}`).join('|')
}

/** Formate les slots pour affichage. "Fermé" si vide. */
function slotsLabel(slots: HourSlot[]): string {
  if (slots.length === 0) return 'Fermé'
  return slots.map((s) => `${s.open} – ${s.close}`).join(' · ')
}

interface Group {
  days: number[] // dans l'ordre logique lundi → dimanche
  slots: HourSlot[]
}

/**
 * Regroupe les jours consécutifs (dans l'ordre lun→dim) qui ont les mêmes
 * slots. Renvoie des groupes affichables (ex: "Lun. – Ven." si 5 jours ont
 * les mêmes horaires, ou "Mar., Jeu." si éparpillés).
 */
function groupDays(hours: DayHours[], visibleDays: number[]): Group[] {
  const byDay = new Map<number, HourSlot[]>()
  for (const d of hours) byDay.set(d.day, d.slots)

  const groups: Group[] = []
  let current: Group | null = null
  let currentKey = ''
  for (const day of visibleDays) {
    const slots = byDay.get(day) ?? []
    const key = slotsKey(slots)
    if (current && key === currentKey) {
      current.days.push(day)
    } else {
      current = { days: [day], slots }
      currentKey = key
      groups.push(current)
    }
  }
  return groups
}

function formatGroupDays(days: number[]): string {
  if (days.length === 1) return DAY_LABELS_SHORT[days[0]]
  if (days.length === 2) {
    return `${DAY_LABELS_SHORT[days[0]]}, ${DAY_LABELS_SHORT[days[1]]}`
  }
  // 3+ jours consécutifs → "Lun. – Ven."
  return `${DAY_LABELS_SHORT[days[0]]} – ${DAY_LABELS_SHORT[days[days.length - 1]]}`
}

export function HoursTimeline({ hours, notes, type }: Props) {
  const [open, setOpen] = useState(false)

  const hideWeekend = type !== 'COMMUNE' && type !== 'CPAS'
  const visibleDays = DAYS_ORDER.filter((d) => {
    if (hideWeekend && (d === 0 || d === 6)) return false
    return true
  })

  const hasData = (hours ?? []).some((d) => d.slots.length > 0)
  if (!hasData) return null

  const today = new Date().getDay()
  const todaySlots = (hours ?? []).find((d) => d.day === today)?.slots ?? []
  const status = computeStatus(todaySlots)
  const groups = groupDays(hours ?? [], visibleDays)

  return (
    <div className="rounded-md border border-border/60 bg-muted/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors rounded-md"
      >
        <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs font-medium text-foreground">
          Horaires d&apos;ouverture
        </span>
        <StatusPill status={status} className="ml-1" />
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground ml-auto shrink-0 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div className="px-3 pb-2.5 pt-1 space-y-1.5 border-t border-border/40">
          <table className="text-xs w-full">
            <tbody>
              {groups.map((g, i) => {
                const closed = g.slots.length === 0
                return (
                  <tr key={i} className="align-baseline">
                    <td className="text-muted-foreground pr-4 py-0.5 whitespace-nowrap font-medium">
                      {formatGroupDays(g.days)}
                    </td>
                    <td
                      className={`py-0.5 tabular-nums ${
                        closed
                          ? 'text-muted-foreground/60 italic'
                          : 'text-foreground'
                      }`}
                    >
                      {slotsLabel(g.slots)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {notes && (
            <p className="text-[10px] text-muted-foreground italic">{notes}</p>
          )}

          <p className="flex items-start gap-1 text-[10px] text-muted-foreground/80 pt-1 border-t border-border/40">
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

function StatusPill({
  status,
  className,
}: {
  status: Status
  className?: string
}) {
  const cls =
    status.tone === 'open'
      ? 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300'
      : status.tone === 'soon'
        ? 'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300'
        : 'bg-muted text-muted-foreground'
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${cls} ${
        className ?? ''
      }`}
    >
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
