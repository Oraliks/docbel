'use client'

import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Field, Group, Pills } from '@/components/page-builder/inspector/controls'
import { RepeaterList } from '@/components/page-builder/inspector/repeater-list'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'

const itemSchema = z.object({
  text: z.string().max(120),
  link: z.string().max(4096),
  variant: z.enum(['primary', 'secondary', 'outline', 'ghost']).optional(),
  icon: z.string().max(40).optional(),
})

const schema = z.object({
  items: z.array(itemSchema).max(20),
  align: z.enum(['left', 'center', 'right']).optional(),
  size: z.enum(['sm', 'md', 'lg']).optional(),
})

type Props = z.infer<typeof schema>
type ButtonItem = Props['items'][number]

const VARIANT_STYLE: Record<NonNullable<ButtonItem['variant']>, string> = {
  primary: 'bg-primary text-primary-foreground hover:opacity-90',
  secondary: 'bg-foreground text-background hover:opacity-90',
  outline: 'border border-current bg-transparent hover:bg-foreground/5',
  ghost: 'bg-transparent hover:bg-foreground/5',
}
const SIZE_CLASS: Record<NonNullable<Props['size']>, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
}

export const buttonGroup = defineBlock({
  type: 'buttonGroup',
  schema,
  defaults: {
    items: [
      { text: 'Action principale', link: '#', variant: 'primary' },
      { text: 'Action secondaire', link: '#', variant: 'outline' },
    ],
    align: 'left',
    size: 'md',
  },
  meta: {
    name: 'Groupe de boutons',
    description: 'Plusieurs boutons côte à côte',
    category: 'ui',
    icon: 'mouse-pointer-click',
    shortcuts: ['buttons', 'boutons'],
  },
  Render: ({ props }) => {
    const { items, align = 'left', size = 'md' } = props
    const alignClass =
      align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start'
    return (
      <div className={cn('flex flex-wrap gap-2', alignClass)}>
        {items.map((btn, i) => (
          <a
            key={i}
            href={btn.link || '#'}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg font-medium transition',
              VARIANT_STYLE[btn.variant ?? 'primary'],
              SIZE_CLASS[size]
            )}
          >
            {btn.text}
          </a>
        ))}
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <>
      <Group title="Disposition" defaultOpen>
        <Field label="Alignement">
          <Pills
            value={props.align ?? 'left'}
            onChange={(v) => onChange({ align: v as Props['align'] })}
            options={[
              { value: 'left', label: 'Gauche' },
              { value: 'center', label: 'Centre' },
              { value: 'right', label: 'Droite' },
            ]}
          />
        </Field>
        <Field label="Taille">
          <Pills
            value={props.size ?? 'md'}
            onChange={(v) => onChange({ size: v as Props['size'] })}
            options={[
              { value: 'sm', label: 'Sm' },
              { value: 'md', label: 'Md' },
              { value: 'lg', label: 'Lg' },
            ]}
          />
        </Field>
      </Group>
      <Group title={`Boutons (${props.items.length})`} defaultOpen>
        <RepeaterList<ButtonItem>
          items={props.items}
          onChange={(items) => onChange({ items })}
          render={(item, set) => (
            <>
              <Input
                value={item.text}
                onChange={(e) => set({ text: e.target.value })}
                placeholder="Texte"
                className="h-8 text-xs"
              />
              <Input
                value={item.link}
                onChange={(e) => set({ link: e.target.value })}
                placeholder="Lien"
                className="h-8 text-xs"
              />
              <Pills
                value={item.variant ?? 'primary'}
                onChange={(v) => set({ variant: v as ButtonItem['variant'] })}
                options={[
                  { value: 'primary', label: 'Primary' },
                  { value: 'secondary', label: 'Sec.' },
                  { value: 'outline', label: 'Outline' },
                  { value: 'ghost', label: 'Ghost' },
                ]}
              />
            </>
          )}
          addItem={() => ({ text: 'Nouveau bouton', link: '#', variant: 'primary' })}
        />
      </Group>
    </>
  ),
})
