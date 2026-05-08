'use client'

import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, Group, Pills } from '@/components/page-builder/inspector/controls'
import { IconPicker, renderIcon } from '@/components/page-builder/inspector/icon-picker'
import { RepeaterList } from '@/components/page-builder/inspector/repeater-list'
import { defineBlock } from '@/lib/page-builder/block-definition'

const eventSchema = z.object({
  date: z.string().max(120),
  title: z.string().max(500),
  description: z.string().max(2000).optional(),
  icon: z.string().max(40).optional(),
})

const schema = z.object({
  title: z.string().max(500).optional(),
  events: z.array(eventSchema).max(50),
  variant: z.enum(['vertical', 'horizontal']).optional(),
})

type Props = z.infer<typeof schema>
type Event = Props['events'][number]

export const chronology = defineBlock({
  type: 'chronology',
  schema,
  defaults: {
    title: 'Notre histoire',
    events: [
      { date: '2020', title: 'Création', description: 'Lancement du projet.' },
      { date: '2022', title: 'Croissance', description: '10 000 utilisateurs.' },
      { date: '2024', title: 'Expansion', description: 'Nouveaux marchés.' },
    ],
    variant: 'vertical',
  },
  meta: {
    name: 'Chronologie',
    description: 'Timeline d\'événements',
    category: 'charts',
    icon: 'clock',
    shortcuts: ['timeline', 'chronologie'],
  },
  Render: ({ props }) => {
    const { title, events, variant = 'vertical' } = props
    if (variant === 'horizontal') {
      return (
        <div className="w-full my-4">
          {title && <h3 className="text-2xl font-bold tracking-tight mb-6">{title}</h3>}
          <div className="relative overflow-x-auto pb-4">
            <div className="absolute top-6 left-0 right-0 h-0.5 bg-border" />
            <div className="relative flex gap-8 min-w-max">
              {events.map((ev, i) => (
                <div key={i} className="flex flex-col items-center text-center w-48 shrink-0">
                  <div className="size-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold relative z-10">
                    {ev.icon ? renderIcon(ev.icon, 'size-5') : i + 1}
                  </div>
                  <div className="mt-3 text-xs font-bold text-primary">{ev.date}</div>
                  <h4 className="mt-1 font-semibold text-sm">{ev.title}</h4>
                  {ev.description && (
                    <p className="mt-1 text-xs text-muted-foreground">{ev.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    }
    return (
      <div className="w-full my-4">
        {title && <h3 className="text-2xl font-bold tracking-tight mb-6">{title}</h3>}
        <ol className="relative space-y-6 border-l-2 border-border pl-6 ml-2">
          {events.map((ev, i) => (
            <li key={i} className="relative">
              <span className="absolute -left-[34px] flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold ring-4 ring-background">
                {ev.icon ? renderIcon(ev.icon, 'size-4') : i + 1}
              </span>
              <div className="text-xs font-bold text-primary mb-0.5">{ev.date}</div>
              <h4 className="font-semibold">{ev.title}</h4>
              {ev.description && (
                <p className="mt-1 text-sm text-muted-foreground">{ev.description}</p>
              )}
            </li>
          ))}
        </ol>
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <>
      <Group title="Affichage" defaultOpen>
        <Field label="Titre">
          <Input
            value={props.title ?? ''}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </Field>
        <Field label="Orientation">
          <Pills
            value={props.variant ?? 'vertical'}
            onChange={(v) => onChange({ variant: v as Props['variant'] })}
            options={[
              { value: 'vertical', label: 'Verticale' },
              { value: 'horizontal', label: 'Horizontale' },
            ]}
          />
        </Field>
      </Group>
      <Group title={`Événements (${props.events.length})`} defaultOpen>
        <RepeaterList<Event>
          items={props.events}
          onChange={(events) => onChange({ events })}
          render={(it, set) => (
            <>
              <Input
                value={it.date}
                onChange={(e) => set({ date: e.target.value })}
                placeholder="2024"
                className="h-8 text-xs"
              />
              <Input
                value={it.title}
                onChange={(e) => set({ title: e.target.value })}
                placeholder="Titre"
                className="h-8 text-xs"
              />
              <Textarea
                value={it.description ?? ''}
                onChange={(e) => set({ description: e.target.value })}
                placeholder="Description"
                rows={2}
                className="text-xs resize-y"
              />
              <IconPicker value={it.icon ?? ''} onChange={(icon) => set({ icon })} />
            </>
          )}
          addItem={() => ({ date: '2024', title: 'Nouvel événement' })}
        />
      </Group>
    </>
  ),
})
