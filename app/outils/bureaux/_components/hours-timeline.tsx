'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Clock, ChevronDown, Info, Flag } from 'lucide-react'

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
  /**
   * Callback déclenché par le CTA "Signaler" dans l'empty state quand on n'a
   * pas d'horaires. Typiquement ouvre le ReportForm de la card parente.
   * Si pas fourni, le CTA n'apparaît pas.
   */
  onReport?: () => void
}

const DAY_LABEL_KEYS = [
  'htDaySun',
  'htDayMon',
  'htDayTue',
  'htDayWed',
  'htDayThu',
  'htDayFri',
  'htDaySat',
] as const
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
  labelKey: 'htStatusOpen' | 'htStatusClosed' | 'htStatusSoon'
  tone: 'open' | 'closed' | 'soon'
}

function computeStatus(slots: HourSlot[]): Status {
  if (slots.length === 0) return { labelKey: 'htStatusClosed', tone: 'closed' }
  const now = nowMinutes()
  for (const s of slots) {
    const open = timeToMinutes(s.open)
    const close = timeToMinutes(s.close)
    if (now >= open && now < close) return { labelKey: 'htStatusOpen', tone: 'open' }
    if (now < open) return { labelKey: 'htStatusClosed', tone: 'closed' }
  }
  return { labelKey: 'htStatusClosed', tone: 'closed' }
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
export function HoursTimeline({ hours, notes, type, onReport }: Props) {
  const t = useTranslations('public.outils')
  const [open, setOpen] = useState(false)

  const hideWeekend = type !== 'COMMUNE' && type !== 'CPAS'
  const visibleDays = DAYS_ORDER.filter((d) => {
    if (hideWeekend && (d === 0 || d === 6)) return false
    return true
  })

  const hasData = (hours ?? []).some((d) => d.slots.length > 0)

  // Empty state : pas d'horaires connus → affichage explicite + CTA signaler
  if (!hasData) {
    return (
      <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 space-y-1.5">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
          <span className="text-xs font-medium text-muted-foreground">
            {t('htEmptyTitle')}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground/80 leading-snug">
          {t('htEmptyBody')}
        </p>
        {onReport && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onReport()
            }}
            className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline font-medium"
          >
            <Flag className="w-2.5 h-2.5" />
            {t('htEmptyReportCta')}
          </button>
        )}
      </div>
    )
  }

  const today = new Date().getDay()
  const todaySlots = (hours ?? []).find((d) => d.day === today)?.slots ?? []
  const status = computeStatus(todaySlots)
  const byDay = new Map<number, HourSlot[]>()
  for (const d of hours ?? []) byDay.set(d.day, d.slots)

  const todayClosed = todaySlots.length === 0
  const todayLabel = t(DAY_LABEL_KEYS[today])
  const todayHours = todayClosed
    ? t('htClosed')
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
          {t('htHeader')}
        </span>
        <StatusPill status={status} className="ml-auto" />
      </div>

      {open ? (
        <div className="pt-1 mt-1">
          {/* 2 colonnes pour gagner de la largeur (4+3 ou 3+2 selon weekend) */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
            {visibleDays.map((day) => {
              const slots = byDay.get(day) ?? []
              const closed = slots.length === 0
              const isToday = day === today
              return (
                <div
                  key={day}
                  className="flex items-baseline gap-2 text-[11px] tabular-nums"
                >
                  <span
                    className={`w-9 shrink-0 font-medium ${
                      isToday
                        ? status.tone === 'open'
                          ? 'text-[color:var(--glass-success-ink)]'
                          : 'text-primary'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {t(DAY_LABEL_KEYS[day])}
                  </span>
                  <span
                    className={`truncate ${
                      closed ? 'text-primary font-medium' : 'text-foreground'
                    }`}
                  >
                    {closed
                      ? t('htClosed')
                      : slots.map((s) => `${s.open}–${s.close}`).join(' · ')}
                  </span>
                </div>
              )
            })}
          </div>
          {notes && (
            <p className="text-[10px] text-muted-foreground italic pt-1 mt-1 border-t border-border/40">
              {notes}
            </p>
          )}
          <p className="flex items-start gap-1 text-[10px] text-muted-foreground/70 pt-1 mt-1 border-t border-border/40">
            <Info className="w-2.5 h-2.5 shrink-0 mt-0.5" />
            <span>
              {t('htNoticeExceptional')}
            </span>
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-[11px] tabular-nums pt-0.5">
          <span
            className={`shrink-0 font-medium ${
              status.tone === 'open'
                ? 'text-[color:var(--glass-success-ink)]'
                : 'text-muted-foreground'
            }`}
          >
            {t('htToday')}
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
  const t = useTranslations('public.outils')
  const cls =
    status.tone === 'open'
      ? 'bg-[color:var(--glass-success-surface)] text-[color:var(--glass-success-ink)]'
      : status.tone === 'soon'
        ? 'bg-[color:var(--glass-warning-surface)] text-[color:var(--glass-warning-ink)]'
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
            ? 'bg-[color:var(--glass-success)]'
            : status.tone === 'soon'
              ? 'bg-[color:var(--glass-warning)]'
              : 'bg-muted-foreground/40'
        }`}
      />
      {t(status.labelKey)}
    </span>
  )
}
