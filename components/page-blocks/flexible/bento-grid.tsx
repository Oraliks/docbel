'use client'

/* eslint-disable @next/next/no-img-element */

import { z } from 'zod'
import { Field, Group, Pills } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { safeHref } from '@/lib/page-builder/url-utils'
import { cn } from '@/lib/utils'
import { bentoGridSchema as schema } from './schemas'

type Props = z.infer<typeof schema>

const COLS_CLASS: Record<NonNullable<Props['cols']>, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-2 md:grid-cols-4',
  6: 'grid-cols-3 md:grid-cols-6',
}

export const bentoGrid = defineBlock({
  type: 'bentoGrid',
  schema,
  defaults: {
    title: '',
    cols: 4,
    cells: [
      { span: { col: 2, row: 2 }, title: 'Cellule large', description: 'Span 2x2', variant: 'highlighted' },
      { span: { col: 2 }, title: 'Cellule horizontale', description: 'Span 2x1' },
      { span: {}, title: 'Petite', description: '1x1' },
      { span: {}, title: 'Petite', description: '1x1' },
    ],
  },
  meta: {
    name: 'Bento grid',
    description: 'Grille asymétrique style Apple',
    category: 'layout',
    icon: 'grid-2x2',
    shortcuts: ['bento', 'grid'],
  },
  Render: ({ props }) => {
    const { title, cells, cols = 4 } = props
    return (
      <div className="my-2">
        {title && <h2 className="text-2xl font-bold tracking-tight mb-4">{title}</h2>}
        <div className={cn('grid gap-3 auto-rows-[140px]', COLS_CLASS[cols])}>
          {cells.map((cell, i) => {
            const Inner = (
              <div
                className={cn(
                  'rounded-2xl border p-5 transition relative overflow-hidden',
                  cell.variant === 'highlighted' &&
                    'bg-primary text-primary-foreground border-primary',
                  cell.variant === 'minimal' && 'bg-transparent border-dashed',
                  !cell.variant || cell.variant === 'default'
                    ? 'bg-card hover:shadow-md'
                    : '',
                  cell.href && 'cursor-pointer'
                )}
                style={{ backgroundColor: cell.bgColor }}
              >
                {cell.image && (
                  <img
                    src={cell.image}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-cover opacity-40"
                  />
                )}
                <div className="relative">
                  {cell.title && <h3 className="font-semibold text-lg">{cell.title}</h3>}
                  {cell.description && (
                    <p className="mt-1 text-sm opacity-80">{cell.description}</p>
                  )}
                </div>
              </div>
            )
            return (
              <div
                key={i}
                style={{
                  gridColumn: cell.span.col
                    ? `span ${cell.span.col} / span ${cell.span.col}`
                    : undefined,
                  gridRow: cell.span.row
                    ? `span ${cell.span.row} / span ${cell.span.row}`
                    : undefined,
                }}
              >
                {cell.href ? (
                  <a href={safeHref(cell.href)} className="block h-full">
                    {Inner}
                  </a>
                ) : (
                  <div className="h-full">{Inner}</div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Disposition" defaultOpen>
      <Field label="Colonnes">
        <Pills
          value={props.cols ?? 4}
          onChange={(v) => onChange({ cols: v as Props['cols'] })}
          options={[
            { value: 2, label: '2' },
            { value: 3, label: '3' },
            { value: 4, label: '4' },
            { value: 6, label: '6' },
          ]}
        />
      </Field>
    </Group>
  ),
})
