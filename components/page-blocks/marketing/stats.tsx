'use client'

import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Field, Group, Pills } from '@/components/page-builder/inspector/controls'
import { RepeaterList } from '@/components/page-builder/inspector/repeater-list'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'

const itemSchema = z.object({
  value: z.string().max(40),
  label: z.string().max(200),
  prefix: z.string().max(20).optional(),
  suffix: z.string().max(20).optional(),
})

const schema = z.object({
  title: z.string().max(500).optional(),
  items: z.array(itemSchema).max(12),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  variant: z.enum(['simple', 'cards', 'centered']).optional(),
})

type Props = z.infer<typeof schema>
type Item = Props['items'][number]

const COLS: Record<Props['columns'], string> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
}

export const stats = defineBlock({
  type: 'stats',
  schema,
  defaults: {
    title: 'Nos chiffres',
    items: [
      { value: '10', suffix: 'k+', label: 'Utilisateurs' },
      { value: '99', suffix: '%', label: 'Satisfaction' },
      { value: '24', suffix: '/7', label: 'Support' },
    ],
    columns: 3,
    variant: 'simple',
  },
  meta: {
    name: 'Statistiques',
    description: 'Chiffres clés',
    category: 'marketing',
    icon: 'bar-chart-3',
    shortcuts: ['stats', 'chiffres', 'kpi'],
    variants: [
      { id: 'simple', name: 'Simple' },
      { id: 'cards', name: 'Cartes' },
      { id: 'centered', name: 'Centré' },
    ],
  },
  Render: ({ props }) => {
    const { title, items, columns, variant = 'simple' } = props
    return (
      <div className="w-full py-12">
        <div className="mx-auto max-w-7xl px-6">
          {title && (
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-center mb-10">
              {title}
            </h2>
          )}
          <div className={cn('grid grid-cols-1 gap-6', COLS[columns])}>
            {items.map((s, idx) =>
              variant === 'cards' ? (
                <div key={idx} className="rounded-2xl border bg-card p-6 text-center shadow-sm">
                  <div className="text-4xl md:text-5xl font-bold tracking-tight text-primary">
                    {s.prefix}
                    {s.value}
                    {s.suffix}
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">{s.label}</div>
                </div>
              ) : (
                <div key={idx} className="text-center">
                  <div className="text-4xl md:text-5xl font-bold tracking-tight">
                    {s.prefix}
                    {s.value}
                    {s.suffix}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground uppercase tracking-wider">
                    {s.label}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <>
      <Group title="En-tête" defaultOpen>
        <Field label="Titre de section">
          <Input
            value={props.title ?? ''}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </Field>
        <Field label="Colonnes">
          <Pills
            value={props.columns}
            onChange={(v) => onChange({ columns: v as Props['columns'] })}
            options={[
              { value: 2, label: '2' },
              { value: 3, label: '3' },
              { value: 4, label: '4' },
            ]}
          />
        </Field>
      </Group>
      <Group title={`Statistiques (${props.items.length})`} defaultOpen>
        <RepeaterList<Item>
          items={props.items}
          onChange={(items) => onChange({ items })}
          render={(item, set) => (
            <>
              <div className="grid grid-cols-3 gap-1.5">
                <Input
                  value={item.prefix ?? ''}
                  onChange={(e) => set({ prefix: e.target.value })}
                  placeholder="$"
                  className="h-8 text-xs"
                />
                <Input
                  value={item.value}
                  onChange={(e) => set({ value: e.target.value })}
                  placeholder="100"
                  className="h-8 text-xs"
                />
                <Input
                  value={item.suffix ?? ''}
                  onChange={(e) => set({ suffix: e.target.value })}
                  placeholder="%"
                  className="h-8 text-xs"
                />
              </div>
              <Input
                value={item.label}
                onChange={(e) => set({ label: e.target.value })}
                placeholder="Libellé"
                className="h-8 text-xs"
              />
            </>
          )}
          addItem={() => ({ value: '0', label: 'Métrique' })}
        />
      </Group>
    </>
  ),
})
