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
  detail?: string
}

function computeStatus(slots: HourSlot[]): Status {
  if (slots.length === 0) return { label: 'Fermé', tone: 'closed' }
  const now = nowMinutes()
  for (const s of slots) {
    const open = timeToMinutes(s.open)
    const close = timeToMinutes(s.close)
    if (now >= open && now < close) {
      return { label: 'Ouvert', tone: 'open' }
    }
    if (now < open) return { label: 'Fermé', tone: 'closed' }
  }
  return { label: 'Fermé', tone: 'closed' }
}

/**
 * Dropdown horaires compact :
 *  - Bloc fermé : label "Horaires d'ouverture" + pill statut + chevron
 *  - Bloc ouvert : 7 lignes (Lun→Dim), une ligne par jour. Tight spacing.
 *    Jours fermés en violet. Disclaimer dégagé en icône tooltip plutôt
 *    qu'en pavé texte.
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

  return (
    <div className="rounded-md border border-border/60 bg-muted/30 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-muted/50 transition-colors"
      >
        <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs font-medium text-foreground">
          Horaires d&apos;ouverture
        </span>
        <StatusPill status={status} className="ml-1" />
        {(notes || true) && (
          <DisclaimerIcon onClick={(e) => e.stopPropagation()} />
        )}
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div className="px-3 pb-2 pt-1 space-y-0.5 border-t border-border/40">
          {visibleDays.map((day) => {
            const slots = byDay.get(day) ?? []
            const closed = slots.length === 0
            return (
              <div
                key={day}
                className="flex items-baseline gap-3 text-[11px] leading-relaxed tabular-nums"
              >
                <span className="text-muted-foreground w-9 shrink-0 font-medium">
                  {DAY_LABELS_SHORT[day]}
                </span>
                <span
                  className={
                    closed
                      ? 'text-primary font-medium'
                      : 'text-foreground'
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
        </div>
      )}
    </div>
  )
}

/**
 * Petite icône info avec tooltip natif. Évite d'avoir un pavé de texte de
 * disclaimer qui prend toute la place dans le dropdown.
 */
function DisclaimerIcon({ onClick }: { onClick?: (e: React.MouseEvent) => void }) {
  return (
    <span
      onClick={onClick}
      title="Certaines fermetures exceptionnelles (jours fériés, ponts) ne sont pas listées. Confirme par téléphone ou sur le site avant de te déplacer."
      className="text-muted-foreground/50 hover:text-muted-foreground cursor-help"
    >
      <Info className="w-3 h-3" />
    </span>
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
