'use client'

import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Field, Group, Pills } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'

const schema = z.object({
  text: z.string().max(500).default('Titre'),
  level: z
    .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)])
    .default(2),
  variant: z.enum(['default', 'display', 'gradient']).optional(),
})

type Props = z.infer<typeof schema>

const SIZES: Record<Props['level'], string> = {
  1: 'text-4xl md:text-5xl lg:text-6xl',
  2: 'text-3xl md:text-4xl',
  3: 'text-2xl md:text-3xl',
  4: 'text-xl md:text-2xl',
  5: 'text-lg md:text-xl',
  6: 'text-base md:text-lg',
}

const VARIANT_CLASS: Record<NonNullable<Props['variant']>, string> = {
  default: 'font-bold tracking-tight',
  display: 'font-extrabold tracking-tighter',
  gradient:
    'font-extrabold tracking-tighter bg-gradient-to-br from-primary to-foreground bg-clip-text text-transparent',
}

export const heading = defineBlock({
  type: 'heading',
  schema,
  defaults: { text: 'Titre', level: 2, variant: 'default' },
  meta: {
    name: 'Titre',
    description: 'Titre H1 à H6',
    category: 'text',
    icon: 'heading',
    shortcuts: ['h1', 'h2', 'h3', 'titre', 'heading'],
    variants: [
      { id: 'default', name: 'Standard' },
      { id: 'display', name: 'Display' },
      { id: 'gradient', name: 'Dégradé' },
    ],
  },
  Render: ({ props }) => {
    const { text, level, variant = 'default' } = props
    const Tag = `h${level}` as unknown as keyof React.JSX.IntrinsicElements
    return <Tag className={cn(SIZES[level], VARIANT_CLASS[variant], 'leading-[1.1]')}>{text}</Tag>
  },
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Texte">
        <Input value={props.text} onChange={(e) => onChange({ text: e.target.value })} />
      </Field>
      <Field label="Niveau">
        <Pills
          value={props.level}
          onChange={(v) => onChange({ level: v as Props['level'] })}
          options={([1, 2, 3, 4, 5, 6] as const).map((n) => ({ value: n, label: `H${n}` }))}
        />
      </Field>
    </Group>
  ),
})
