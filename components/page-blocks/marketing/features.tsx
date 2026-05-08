'use client'

import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, Group, Pills } from '@/components/page-builder/inspector/controls'
import { IconPicker, renderIcon } from '@/components/page-builder/inspector/icon-picker'
import { RepeaterList } from '@/components/page-builder/inspector/repeater-list'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'

const itemSchema = z.object({
  icon: z.string().max(40).optional(),
  title: z.string().max(200),
  description: z.string().max(1000),
})

const schema = z.object({
  title: z.string().max(500).optional(),
  subtitle: z.string().max(500).optional(),
  items: z.array(itemSchema).max(24),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  variant: z.enum(['cards', 'icons', 'centered']).optional(),
})

type Props = z.infer<typeof schema>
type FeatureItem = Props['items'][number]

const COLS: Record<Props['columns'], string> = {
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-2 lg:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
}

export const features = defineBlock({
  type: 'features',
  schema,
  defaults: {
    title: 'Pourquoi nous choisir',
    subtitle: 'Quelques arguments clés.',
    items: [
      { icon: '⚡', title: 'Rapide', description: 'Performance optimale.' },
      { icon: '🔒', title: 'Sécurisé', description: 'Données protégées.' },
      { icon: '📱', title: 'Responsive', description: 'Sur tous écrans.' },
    ],
    columns: 3,
    variant: 'cards',
  },
  meta: {
    name: 'Fonctionnalités',
    description: 'Grille de fonctionnalités',
    category: 'marketing',
    icon: 'grid-2x2',
    shortcuts: ['features', 'avantages'],
    variants: [
      { id: 'cards', name: 'Cartes' },
      { id: 'icons', name: 'Icônes' },
      { id: 'centered', name: 'Centré' },
    ],
  },
  Render: ({ props }) => {
    const { title, subtitle, items, columns, variant = 'cards' } = props
    return (
      <div className="w-full py-12 md:py-16">
        <div className="mx-auto max-w-7xl px-6">
          {(title || subtitle) && (
            <header className="mb-10 text-center max-w-2xl mx-auto">
              {title && (
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{title}</h2>
              )}
              {subtitle && <p className="mt-3 text-muted-foreground">{subtitle}</p>}
            </header>
          )}
          <div className={cn('grid grid-cols-1 gap-6', COLS[columns])}>
            {items.map((item, idx) => {
              if (variant === 'icons') {
                return (
                  <div key={idx} className="flex gap-4">
                    {item.icon && (
                      <div className="shrink-0 leading-none text-primary">
                        {renderIcon(item.icon, 'size-7')}
                      </div>
                    )}
                    <div>
                      <h3 className="text-lg font-semibold">{item.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                )
              }
              if (variant === 'centered') {
                return (
                  <div key={idx} className="text-center">
                    {item.icon && (
                      <div className="mb-3 inline-flex items-center justify-center text-primary">
                        {renderIcon(item.icon, 'size-8')}
                      </div>
                    )}
                    <h3 className="text-lg font-semibold">{item.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                  </div>
                )
              }
              return (
                <div
                  key={idx}
                  className="rounded-2xl border bg-card p-6 transition hover:shadow-md hover:-translate-y-0.5"
                >
                  {item.icon && (
                    <div className="mb-3 leading-none text-primary">
                      {renderIcon(item.icon, 'size-7')}
                    </div>
                  )}
                  <h3 className="text-lg font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                </div>
              )
            })}
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
        <Field label="Sous-titre">
          <Input
            value={props.subtitle ?? ''}
            onChange={(e) => onChange({ subtitle: e.target.value })}
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
      <Group title={`Items (${props.items.length})`} defaultOpen>
        <RepeaterList<FeatureItem>
          items={props.items}
          onChange={(items) => onChange({ items })}
          render={(item, set) => (
            <>
              <IconPicker value={item.icon ?? ''} onChange={(icon) => set({ icon })} />
              <Input
                value={item.title}
                onChange={(e) => set({ title: e.target.value })}
                placeholder="Titre"
                className="h-8 text-xs"
              />
              <Textarea
                value={item.description}
                onChange={(e) => set({ description: e.target.value })}
                placeholder="Description"
                rows={2}
                className="resize-y text-xs"
              />
            </>
          )}
          addItem={() => ({
            icon: 'sparkles',
            title: 'Nouvelle fonctionnalité',
            description: 'Description.',
          })}
        />
      </Group>
    </>
  ),
})
