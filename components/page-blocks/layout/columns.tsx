'use client'

import { z } from 'zod'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Field, Group, Pills } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'
import { columnsSchema as schema } from './schemas'

type Props = z.infer<typeof schema>

const COLUMN_GAP: Record<NonNullable<Props['gap']>, string> = {
  sm: 'gap-3',
  md: 'gap-6',
  lg: 'gap-10',
}

const COLUMN_GRID: Record<Props['count'], string> = {
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4',
}

// Ratios → classes Tailwind LITTÉRALES (requis pour le JIT) + nb de colonnes.
const RATIO_CLASS: Record<
  Exclude<NonNullable<Props['ratio']>, 'equal'>,
  { cols: number; cls: string }
> = {
  '1-2': { cols: 2, cls: 'md:grid-cols-[1fr_2fr]' },
  '2-1': { cols: 2, cls: 'md:grid-cols-[2fr_1fr]' },
  '1-3': { cols: 2, cls: 'md:grid-cols-[1fr_3fr]' },
  '3-1': { cols: 2, cls: 'md:grid-cols-[3fr_1fr]' },
  '1-1-2': { cols: 3, cls: 'md:grid-cols-[1fr_1fr_2fr]' },
  '1-2-1': { cols: 3, cls: 'md:grid-cols-[1fr_2fr_1fr]' },
  '2-1-1': { cols: 3, cls: 'md:grid-cols-[2fr_1fr_1fr]' },
}

const VALIGN: Record<NonNullable<Props['vAlign']>, string> = {
  start: 'items-start',
  center: 'items-center',
  stretch: 'items-stretch',
}

export const columns = defineBlock({
  type: 'columns',
  schema,
  defaults: { count: 2, gap: 'md' },
  meta: {
    name: 'Colonnes',
    description: 'Grille à 2/3/4 colonnes',
    category: 'layout',
    icon: 'columns-3',
    shortcuts: ['columns', 'colonnes', 'grid'],
    canHaveChildren: true,
  },
  Render: ({ props, slotByIndex }) => {
    const ratio = props.ratio && props.ratio !== 'equal' ? RATIO_CLASS[props.ratio] : null
    const count = ratio ? ratio.cols : props.count
    const gridClass = ratio
      ? cn('grid-cols-1', ratio.cls)
      : COLUMN_GRID[count as Props['count']]
    const swap = props.reverseMobile && count === 2
    return (
      <div
        className={cn(
          'grid w-full',
          gridClass,
          COLUMN_GAP[props.gap ?? 'md'],
          props.vAlign && VALIGN[props.vAlign]
        )}
      >
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className={
              swap
                ? i === 0
                  ? 'order-2 md:order-none'
                  : 'order-1 md:order-none'
                : undefined
            }
          >
            {slotByIndex?.(i)}
          </div>
        ))}
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Nombre de colonnes" hint="Ignoré si un ratio est choisi">
        <Pills
          value={props.count}
          onChange={(v) => onChange({ count: v as Props['count'] })}
          options={[
            { value: 2, label: '2' },
            { value: 3, label: '3' },
            { value: 4, label: '4' },
          ]}
        />
      </Field>
      <Field label="Ratio des colonnes">
        <Select
          value={props.ratio ?? 'equal'}
          onValueChange={(v) => onChange({ ratio: v as Props['ratio'] })}
        >
          <SelectTrigger className="h-8 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="equal">Égales</SelectItem>
            <SelectItem value="1-2">1 : 2 (sidebar gauche)</SelectItem>
            <SelectItem value="2-1">2 : 1 (sidebar droite)</SelectItem>
            <SelectItem value="1-3">1 : 3</SelectItem>
            <SelectItem value="3-1">3 : 1</SelectItem>
            <SelectItem value="1-1-2">1 : 1 : 2</SelectItem>
            <SelectItem value="1-2-1">1 : 2 : 1</SelectItem>
            <SelectItem value="2-1-1">2 : 1 : 1</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Espacement">
        <Pills
          value={props.gap ?? 'md'}
          onChange={(v) => onChange({ gap: v as Props['gap'] })}
          options={[
            { value: 'sm', label: 'Sm' },
            { value: 'md', label: 'Md' },
            { value: 'lg', label: 'Lg' },
          ]}
        />
      </Field>
      <Field label="Alignement vertical">
        <Pills
          value={props.vAlign ?? 'stretch'}
          onChange={(v) => onChange({ vAlign: v as Props['vAlign'] })}
          options={[
            { value: 'start', label: 'Haut' },
            { value: 'center', label: 'Centre' },
            { value: 'stretch', label: 'Étirer' },
          ]}
        />
      </Field>
      <div className="flex items-center justify-between gap-4 py-1">
        <Field label="Inverser sur mobile" className="flex-1">
          <span className="sr-only">Inverser l’ordre des 2 colonnes sur mobile</span>
        </Field>
        <Switch
          checked={props.reverseMobile ?? false}
          onCheckedChange={(v) => onChange({ reverseMobile: v })}
        />
      </div>
    </Group>
  ),
})
