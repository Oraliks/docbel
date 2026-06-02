'use client'

import { z } from 'zod'
import { Calendar } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Field, Group, Pills } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { belgianDateHelperSchema as schema } from './schemas'

type Props = z.infer<typeof schema>

const HOLIDAYS: string[] = [
  '2024-01-01', '2024-04-01', '2024-05-01', '2024-05-09', '2024-05-20',
  '2024-07-21', '2024-08-15', '2024-11-01', '2024-11-11', '2024-12-25',
  '2025-01-01', '2025-04-21', '2025-05-01', '2025-05-29', '2025-06-09',
  '2025-07-21', '2025-08-15', '2025-11-01', '2025-11-11', '2025-12-25',
  '2026-01-01', '2026-04-06', '2026-05-01', '2026-05-14', '2026-05-25',
  '2026-07-21', '2026-08-15', '2026-11-01', '2026-11-11', '2026-12-25',
  '2027-01-01', '2027-03-29', '2027-05-01', '2027-05-06', '2027-05-17',
  '2027-07-21', '2027-08-15', '2027-11-01', '2027-11-11', '2027-12-25',
]

function isBusinessDay(d: Date): boolean {
  const day = d.getDay()
  if (day === 0 || day === 6) return false
  return !HOLIDAYS.includes(d.toISOString().slice(0, 10))
}

export const belgianDateHelper = defineBlock({
  type: 'belgianDateHelper',
  schema,
  defaults: {
    startDate: new Date().toISOString().slice(0, 10),
    daysToAdd: 30,
    countWeekendsAndHolidays: 'businessOnly',
    label: 'Date de fin estimée',
  },
  meta: {
    name: 'Calculateur de date BE',
    description: 'Calcul délais avec jours fériés belges',
    category: 'docbel',
    icon: 'calendar',
    shortcuts: ['dateBE', 'delai'],
  },
  Render: ({ props }) => {
    const { startDate, daysToAdd, countWeekendsAndHolidays, label = 'Date de fin' } = props
    const start = new Date(startDate)
    const end = new Date(start)
    if (countWeekendsAndHolidays === 'all') {
      end.setDate(end.getDate() + daysToAdd)
    } else {
      let added = 0
      while (added < daysToAdd) {
        end.setDate(end.getDate() + 1)
        if (isBusinessDay(end)) added++
      }
    }
    const formatDate = (d: Date) =>
      new Intl.DateTimeFormat('fr-BE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(d)
    return (
      <div className="rounded-2xl border bg-card p-5 my-2">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="size-4 text-primary" />
          <h3 className="font-semibold">{label}</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Début</div>
            <div className="mt-0.5 font-medium">{formatDate(start)}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Délai</div>
            <div className="mt-0.5 font-medium">
              +{daysToAdd}{' '}
              {countWeekendsAndHolidays === 'businessOnly' ? 'jours ouvrables' : 'jours'}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Fin</div>
            <div className="mt-0.5 font-bold text-primary">{formatDate(end)}</div>
          </div>
        </div>
        <p className="mt-3 text-[10px] text-muted-foreground italic">
          {countWeekendsAndHolidays === 'businessOnly'
            ? 'Jours ouvrables : hors weekends et jours fériés belges.'
            : 'Jours calendrier : tous les jours comptés.'}
        </p>
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Étiquette">
        <Input
          value={props.label ?? ''}
          onChange={(e) => onChange({ label: e.target.value })}
        />
      </Field>
      <Field label="Date de départ">
        <Input
          type="date"
          value={props.startDate ? props.startDate.slice(0, 10) : ''}
          onChange={(e) => onChange({ startDate: e.target.value })}
        />
      </Field>
      <Field label="Nombre de jours">
        <Input
          type="number"
          min={1}
          value={props.daysToAdd}
          onChange={(e) => onChange({ daysToAdd: Number(e.target.value) })}
        />
      </Field>
      <Field label="Type de jours">
        <Pills
          value={props.countWeekendsAndHolidays}
          onChange={(v) =>
            onChange({
              countWeekendsAndHolidays: v as Props['countWeekendsAndHolidays'],
            })
          }
          options={[
            { value: 'businessOnly', label: 'Ouvrables (BE)' },
            { value: 'all', label: 'Calendrier' },
          ]}
        />
      </Field>
    </Group>
  ),
})
