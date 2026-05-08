'use client'

import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  ColorControl,
  Field,
  Group,
  Pills,
} from '@/components/page-builder/inspector/controls'
import { RepeaterList } from '@/components/page-builder/inspector/repeater-list'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'

const itemSchema = z.object({
  label: z.string().max(120),
  variant: z.enum(['default', 'secondary', 'outline', 'destructive']).optional(),
  color: z.string().optional(),
})

const schema = z.object({
  title: z.string().max(200).optional(),
  items: z.array(itemSchema).max(50),
  align: z.enum(['left', 'center']).optional(),
})

type Props = z.infer<typeof schema>
type BadgeItem = Props['items'][number]

export const badges = defineBlock({
  type: 'badges',
  schema,
  defaults: {
    title: '',
    items: [
      { label: 'Nouveau', variant: 'default' },
      { label: 'Populaire', variant: 'secondary' },
      { label: 'Gratuit', variant: 'outline' },
    ],
    align: 'left',
  },
  meta: {
    name: 'Badges',
    description: 'Liste de tags / badges',
    category: 'ui',
    icon: 'square',
    shortcuts: ['badges', 'tags'],
  },
  Render: ({ props }) => {
    const { title, items, align = 'left' } = props
    return (
      <div className={cn('w-full', align === 'center' && 'text-center')}>
        {title && (
          <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            {title}
          </h3>
        )}
        <div className={cn('flex flex-wrap gap-2', align === 'center' && 'justify-center')}>
          {items.map((b, i) =>
            b.color ? (
              <span
                key={i}
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{ backgroundColor: b.color, color: 'white' }}
              >
                {b.label}
              </span>
            ) : (
              <Badge key={i} variant={b.variant ?? 'default'}>
                {b.label}
              </Badge>
            )
          )}
        </div>
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <>
      <Group title="En-tête" defaultOpen>
        <Field label="Titre (optionnel)">
          <Input
            value={props.title ?? ''}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </Field>
        <Field label="Alignement">
          <Pills
            value={props.align ?? 'left'}
            onChange={(v) => onChange({ align: v as Props['align'] })}
            options={[
              { value: 'left', label: 'Gauche' },
              { value: 'center', label: 'Centré' },
            ]}
          />
        </Field>
      </Group>
      <Group title={`Badges (${props.items.length})`} defaultOpen>
        <RepeaterList<BadgeItem>
          items={props.items}
          onChange={(items) => onChange({ items })}
          render={(item, set) => (
            <>
              <Input
                value={item.label}
                onChange={(e) => set({ label: e.target.value })}
                placeholder="Texte"
                className="h-8 text-xs"
              />
              <div className="grid grid-cols-2 gap-1.5">
                <Pills
                  value={item.variant ?? 'default'}
                  onChange={(v) => set({ variant: v as BadgeItem['variant'] })}
                  options={[
                    { value: 'default', label: 'Plein' },
                    { value: 'secondary', label: 'Sec.' },
                    { value: 'outline', label: 'Outline' },
                    { value: 'destructive', label: 'Rouge' },
                  ]}
                />
                <ColorControl value={item.color} onChange={(v) => set({ color: v })} />
              </div>
            </>
          )}
          addItem={() => ({ label: 'Nouveau badge', variant: 'default' })}
        />
      </Group>
    </>
  ),
})
