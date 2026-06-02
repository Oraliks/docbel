'use client'

import { z } from 'zod'
import { Star } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Field,
  Group,
  Pills,
  SliderControl,
} from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'
import { starRatingSchema as schema } from './schemas'

type Props = z.infer<typeof schema>

const SIZES: Record<NonNullable<Props['size']>, string> = {
  sm: 'size-3.5',
  md: 'size-4',
  lg: 'size-5',
}

export const starRating = defineBlock({
  type: 'starRating',
  schema,
  defaults: { value: 4.5, count: 127, showCount: true, size: 'md' },
  meta: {
    name: 'Note (étoiles)',
    description: 'Affichage de note 0-5',
    category: 'marketing',
    icon: 'star',
    shortcuts: ['rating', 'stars'],
  },
  Render: ({ props }) => {
    const { value, count, showCount = true, size = 'md' } = props
    const v = Math.max(0, Math.min(5, value))
    const full = Math.floor(v)
    const fractional = v - full
    const cls = SIZES[size]
    return (
      <div className="inline-flex items-center gap-2 my-1">
        <div className="flex">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={cn('relative', cls)}>
              <Star className={cn(cls, 'text-muted-foreground/30')} />
              {i < full && (
                <Star className={cn(cls, 'absolute inset-0 text-amber-400 fill-amber-400')} />
              )}
              {i === full && fractional > 0 && (
                <div
                  className="absolute inset-0 overflow-hidden"
                  style={{ width: `${fractional * 100}%` }}
                >
                  <Star className={cn(cls, 'text-amber-400 fill-amber-400')} />
                </div>
              )}
            </div>
          ))}
        </div>
        <span className="text-sm font-medium tabular-nums">{v.toFixed(1)}</span>
        {showCount && count !== undefined && (
          <span className="text-xs text-muted-foreground">({count.toLocaleString('fr-FR')})</span>
        )}
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Note">
        <SliderControl
          value={props.value}
          onChange={(v) => onChange({ value: v })}
          min={0}
          max={5}
          step={0.1}
        />
      </Field>
      <Field label="Nombre d'avis">
        <Input
          type="number"
          value={props.count ?? 0}
          onChange={(e) => onChange({ count: Number(e.target.value) })}
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
  ),
})
