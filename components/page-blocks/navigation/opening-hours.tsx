'use client'

import { z } from 'zod'
import { Clock } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Field, Group } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'

const daySchema = z.object({
  day: z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
  open: z.string().optional(),
  close: z.string().optional(),
  closed: z.boolean().optional(),
})

const schema = z.object({
  title: z.string().max(500).optional(),
  schedule: z.array(daySchema),
  showCurrentStatus: z.boolean().optional(),
})

type Day = z.infer<typeof daySchema>

const DAY_LABEL: Record<Day['day'], string> = {
  mon: 'Lundi',
  tue: 'Mardi',
  wed: 'Mercredi',
  thu: 'Jeudi',
  fri: 'Vendredi',
  sat: 'Samedi',
  sun: 'Dimanche',
}

const DAYS_ORDER: Day['day'][] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export const openingHours = defineBlock({
  type: 'openingHours',
  schema,
  defaults: {
    title: 'Horaires d\'ouverture',
    schedule: [
      { day: 'mon', open: '09:00', close: '17:00' },
      { day: 'tue', open: '09:00', close: '17:00' },
      { day: 'wed', open: '09:00', close: '17:00' },
      { day: 'thu', open: '09:00', close: '17:00' },
      { day: 'fri', open: '09:00', close: '17:00' },
      { day: 'sat', closed: true },
      { day: 'sun', closed: true },
    ],
    showCurrentStatus: true,
  },
  meta: {
    name: 'Horaires',
    description: 'Heures d\'ouverture',
    category: 'navigation',
    icon: 'clock',
    shortcuts: ['hours', 'horaires'],
  },
  Render: ({ props }) => {
    const { title, schedule, showCurrentStatus } = props
    const today = new Date()
    const dayKeys: Day['day'][] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
    const todayKey = dayKeys[today.getDay()]
    const todayEntry = schedule.find((s) => s.day === todayKey)

    let openNow = false
    if (todayEntry && !todayEntry.closed && todayEntry.open && todayEntry.close) {
      const [oh, om] = todayEntry.open.split(':').map(Number)
      const [ch, cm] = todayEntry.close.split(':').map(Number)
      const now = today.getHours() * 60 + today.getMinutes()
      openNow = now >= oh * 60 + om && now < ch * 60 + cm
    }

    return (
      <div className="rounded-2xl border bg-card p-5 my-2">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-primary" />
            <h3 className="font-semibold">{title || 'Horaires'}</h3>
          </div>
          {showCurrentStatus && (
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-medium',
                openNow
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                  : 'bg-red-500/15 text-red-700 dark:text-red-300'
              )}
            >
              {openNow ? '● Ouvert' : '● Fermé'}
            </span>
          )}
        </div>
        <dl className="space-y-1.5">
          {schedule.map((s) => (
            <div
              key={s.day}
              className={cn(
                'grid grid-cols-2 gap-2 text-sm rounded px-2 py-1',
                s.day === todayKey && 'bg-primary/5 font-medium'
              )}
            >
              <dt>{DAY_LABEL[s.day]}</dt>
              <dd className="text-right tabular-nums">
                {s.closed ? (
                  <span className="text-muted-foreground">Fermé</span>
                ) : (
                  `${s.open} – ${s.close}`
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    )
  },
  Fields: ({ props, onChange }) => {
    const updateDay = (key: Day['day'], patch: Partial<Day>) => {
      const existing = props.schedule.find((s) => s.day === key)
      if (existing) {
        onChange({
          schedule: props.schedule.map((s) => (s.day === key ? { ...s, ...patch } : s)),
        })
      } else {
        onChange({ schedule: [...props.schedule, { day: key, ...patch }] })
      }
    }
    return (
      <>
        <Group title="En-tête" defaultOpen>
          <Field label="Titre">
            <Input
              value={props.title ?? ''}
              onChange={(e) => onChange({ title: e.target.value })}
            />
          </Field>
          <div className="flex items-center justify-between gap-4 py-1">
            <Field label="Afficher le statut" className="flex-1">
              <span className="sr-only">status</span>
            </Field>
            <Switch
              checked={props.showCurrentStatus ?? true}
              onCheckedChange={(v) => onChange({ showCurrentStatus: v })}
            />
          </div>
        </Group>
        <Group title="Horaires" defaultOpen>
          {DAYS_ORDER.map((key) => {
            const day = props.schedule.find((s) => s.day === key)
            return (
              <div
                key={key}
                className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center text-xs"
              >
                <span className="font-medium">{DAY_LABEL[key]}</span>
                <Input
                  type="time"
                  value={day?.open ?? ''}
                  onChange={(e) => updateDay(key, { open: e.target.value, closed: false })}
                  disabled={day?.closed}
                  className="h-7 text-xs w-24"
                />
                <Input
                  type="time"
                  value={day?.close ?? ''}
                  onChange={(e) => updateDay(key, { close: e.target.value, closed: false })}
                  disabled={day?.closed}
                  className="h-7 text-xs w-24"
                />
                <Switch
                  checked={!day?.closed}
                  onCheckedChange={(v) => updateDay(key, { closed: !v })}
                />
              </div>
            )
          })}
        </Group>
      </>
    )
  },
})
