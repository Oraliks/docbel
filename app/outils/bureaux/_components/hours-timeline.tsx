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
  type: string
}

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
}

function computeStatus(slots: HourSlot[]): Status {
  if (slots.length === 0) return { label: 'Fermé', tone: 'closed' }
  const now = nowMinutes()
  for (const s of slots) {
    const open = timeToMinutes(s.open)
    const close = timeToMinutes(s.close)
    if (now >= open && now < close) return { label: 'Ouvert', tone: 'open' }
    if (now < open) return { label: 'Fermé', tone: 'closed' }
  }
  return { label: 'Fermé', tone: 'closed' }
}

/**
 * Panneau horaires dropdown :
 *  - Fermé (par défaut) : header avec status + ligne "Aujourd'hui · Lun.
 *    08:30–12:00 · 13:30–16:00 ⌄". Compact — montre l'info la plus utile
 *    (les horaires d'aujourd'hui) sans déployer le bloc.
 *  - Ouvert : header + 7 jours (Lun→Dim, ou Lun→Ven si ONEM/OP) + ⌃
 *
 * "Aujourd'hui" en vert si Ouvert, gris si Fermé.
 */
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
  const byDay = new Map<number, HourSlot[]>()
  for (const d of hours ?? []) byDay.set(d.day, d.slots)

  const todayClosed = todaySlots.length === 0
  const todayLabel = DAY_LABELS_SHORT[today]
  const todayHours = todayClosed
    ? 'Fermé'
    : todaySlots.map((s) => `${s.open}–${s.close}`).join(' · ')

  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className="w-full text-left rounded-md border border-border/60 bg-muted/30 hover:bg-muted/50 transition-colors px-3 py-2 space-y-1"
    >
      <div className="flex items-center gap-2">
        <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs font-medium text-foreground">
          Horaires d&apos;ouverture
        </span>
        <StatusPill status={status} className="ml-auto" />
      </div>

      {open ? (
        <div className="pt-1 space-y-0.5 mt-1">
          {visibleDays.map((day) => {
            const slots = byDay.get(day) ?? []
            const closed = slots.length === 0
            const isToday = day === today
            return (
              <div
                key={day}
                className="flex items-baseline gap-3 text-[11px] tabular-nums"
              >
                <span
                  className={`w-9 shrink-0 font-medium ${
                    isToday
                      ? status.tone === 'open'
                        ? 'text-green-700 dark:text-green-400'
                        : 'text-primary'
                      : 'text-muted-foreground'
                  }`}
                >
                  {DAY_LABELS_SHORT[day]}
                </span>
                <span
                  className={
                    closed ? 'text-primary font-medium' : 'text-foreground'
                  }
                >
                  {closed
                    ? 'Fermé'
                    : slots.map((s) => `${s.open}–${s.close}`).join(' · ')}
                </span>
              </div>
            )
          })}
          {notes && (
            <p className="text-[10px] text-muted-foreground italic pt-1 mt-1 border-t border-border/40">
              {notes}
            </p>
          )}
          <p className="flex items-start gap-1 text-[10px] text-muted-foreground/70 pt-1 mt-1 border-t border-border/40">
            <Info className="w-2.5 h-2.5 shrink-0 mt-0.5" />
            <span>
              Fermetures exceptionnelles non listées. À confirmer par téléphone.
            </span>
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-[11px] tabular-nums pt-0.5">
          <span
            className={`shrink-0 font-medium ${
              status.tone === 'open'
                ? 'text-green-700 dark:text-green-400'
                : 'text-muted-foreground'
            }`}
          >
            Aujourd&apos;hui
          </span>
          <span className="text-muted-foreground/50">·</span>
          <span className="text-muted-foreground font-medium">{todayLabel}</span>
          <span
            className={`truncate ${
              todayClosed ? 'text-primary font-medium' : 'text-foreground'
            }`}
          >
            {todayHours}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-auto shrink-0" />
        </div>
      )}
    </button>
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
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${cls} ${
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
    </span>
  )
}
