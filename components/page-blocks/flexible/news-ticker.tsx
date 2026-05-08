'use client'

import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Field, Group, Pills } from '@/components/page-builder/inspector/controls'
import { RepeaterList } from '@/components/page-builder/inspector/repeater-list'
import { defineBlock } from '@/lib/page-builder/block-definition'

const itemSchema = z.object({
  label: z.string(),
  href: z.string().optional(),
  date: z.string().optional(),
})

const schema = z.object({
  items: z.array(itemSchema).max(50),
  speed: z.enum(['slow', 'normal', 'fast']).optional(),
})

type Item = z.infer<typeof itemSchema>
type Props = z.infer<typeof schema>

const DURATION: Record<NonNullable<Props['speed']>, string> = {
  slow: '60s',
  normal: '30s',
  fast: '15s',
}

export const newsTicker = defineBlock({
  type: 'newsTicker',
  schema,
  defaults: {
    items: [
      { label: 'Annonce 1', href: '#' },
      { label: 'Annonce 2', href: '#' },
      { label: 'Annonce 3', href: '#' },
    ],
    speed: 'normal',
  },
  meta: {
    name: 'Bandeau actu',
    description: 'Bandeau défilant d\'actualités',
    category: 'utility',
    icon: 'arrow-right',
    shortcuts: ['ticker', 'actu'],
  },
  Render: ({ props }) => {
    const { items, speed = 'normal' } = props
    return (
      <div className="my-2 overflow-hidden border-y bg-card py-2">
        <div
          className="flex gap-12 whitespace-nowrap"
          style={{ animation: `ticker ${DURATION[speed]} linear infinite` }}
        >
          {[...items, ...items].map((item, i) => (
            <span key={i} className="inline-flex items-center gap-2 text-sm">
              <span className="size-2 rounded-full bg-primary animate-pulse" />
              {item.date && <span className="text-xs text-muted-foreground">{item.date}</span>}
              {item.href ? (
                <a href={item.href} className="hover:underline">
                  {item.label}
                </a>
              ) : (
                <span>{item.label}</span>
              )}
            </span>
          ))}
        </div>
        <style jsx>{`
          @keyframes ticker {
            from {
              transform: translateX(0);
            }
            to {
              transform: translateX(-50%);
            }
          }
        `}</style>
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <>
      <Group title="Réglages" defaultOpen>
        <Field label="Vitesse">
          <Pills
            value={props.speed ?? 'normal'}
            onChange={(v) => onChange({ speed: v as Props['speed'] })}
            options={[
              { value: 'slow', label: 'Lente' },
              { value: 'normal', label: 'Normale' },
              { value: 'fast', label: 'Rapide' },
            ]}
          />
        </Field>
      </Group>
      <Group title={`Annonces (${props.items.length})`} defaultOpen>
        <RepeaterList<Item>
          items={props.items}
          onChange={(items) => onChange({ items })}
          render={(it, set) => (
            <>
              <Input
                value={it.label}
                onChange={(e) => set({ label: e.target.value })}
                placeholder="Texte"
                className="h-8 text-xs"
              />
              <Input
                value={it.href ?? ''}
                onChange={(e) => set({ href: e.target.value })}
                placeholder="Lien (optionnel)"
                className="h-8 text-xs"
              />
              <Input
                value={it.date ?? ''}
                onChange={(e) => set({ date: e.target.value })}
                placeholder="Date (optionnel)"
                className="h-8 text-xs"
              />
            </>
          )}
          addItem={() => ({ label: 'Nouvelle annonce' })}
        />
      </Group>
    </>
  ),
})
