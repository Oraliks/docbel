'use client'

import { z } from 'zod'
import { Check, X as XIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, Group } from '@/components/page-builder/inspector/controls'
import { RepeaterList } from '@/components/page-builder/inspector/repeater-list'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'
import { compareTableSchema as schema, compareRowSchema } from './schemas'

type Row = z.infer<typeof compareRowSchema>

export const compareTable = defineBlock({
  type: 'compareTable',
  schema,
  defaults: {
    title: 'Comparaison',
    columns: ['Notre solution', 'Concurrent A', 'Concurrent B'],
    rows: [
      { feature: 'Fonctionnalité 1', values: [true, true, false] },
      { feature: 'Fonctionnalité 2', values: [true, false, true] },
      { feature: 'Fonctionnalité 3', values: [true, false, false] },
      { feature: 'Prix', values: ['Gratuit', '19€', '49€'] },
    ],
    highlightColumn: 0,
  },
  meta: {
    name: 'Tableau comparatif',
    description: 'Comparer features vs concurrents',
    category: 'marketing',
    icon: 'columns-3',
    shortcuts: ['compare', 'vs'],
  },
  Render: ({ props }) => {
    const { title, columns, rows, highlightColumn } = props
    return (
      <div className="w-full py-8 overflow-x-auto">
        <div className="mx-auto max-w-5xl px-6">
          {title && <h3 className="text-2xl font-bold tracking-tight text-center mb-6">{title}</h3>}
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left p-3 font-medium text-sm text-muted-foreground" />
                {columns.map((col, i) => (
                  <th
                    key={i}
                    className={cn(
                      'text-center p-3 font-semibold',
                      highlightColumn === i && 'bg-primary/10 text-primary rounded-t-lg'
                    )}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className="border-t">
                  <td className="p-3 text-sm font-medium">{row.feature}</td>
                  {row.values.map((v, vi) => (
                    <td
                      key={vi}
                      className={cn('text-center p-3', highlightColumn === vi && 'bg-primary/5')}
                    >
                      {typeof v === 'boolean' ? (
                        v ? (
                          <Check className="size-4 mx-auto text-emerald-600" />
                        ) : (
                          <XIcon className="size-4 mx-auto text-muted-foreground/50" />
                        )
                      ) : (
                        <span className="text-sm">{v}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <>
      <Group title="En-tête" defaultOpen>
        <Field label="Titre">
          <Input
            value={props.title ?? ''}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </Field>
        <Field label="Colonnes (une par ligne)">
          <Textarea
            value={props.columns.join('\n')}
            onChange={(e) =>
              onChange({ columns: e.target.value.split('\n').filter(Boolean) })
            }
            rows={4}
            className="text-xs resize-y"
          />
        </Field>
        <Field label="Colonne mise en avant">
          <Input
            type="number"
            min={-1}
            value={props.highlightColumn ?? -1}
            onChange={(e) => onChange({ highlightColumn: Number(e.target.value) })}
          />
        </Field>
      </Group>
      <Group title={`Lignes (${props.rows.length})`} defaultOpen>
        <RepeaterList<Row>
          items={props.rows}
          onChange={(rows) => onChange({ rows })}
          render={(it, set) => (
            <>
              <Input
                value={it.feature}
                onChange={(e) => set({ feature: e.target.value })}
                placeholder="Feature"
                className="h-8 text-xs"
              />
              <Field label="Valeurs (true/false ou texte, séparées par |)" className="!space-y-1">
                <Input
                  value={it.values
                    .map((v) => (typeof v === 'boolean' ? (v ? 'true' : 'false') : v))
                    .join(' | ')}
                  onChange={(e) =>
                    set({
                      values: e.target.value.split('|').map((v) => {
                        const t = v.trim()
                        if (t === 'true') return true
                        if (t === 'false') return false
                        return t
                      }),
                    })
                  }
                  className="h-8 text-xs font-mono"
                />
              </Field>
            </>
          )}
          addItem={() => ({ feature: 'Nouvelle ligne', values: [] })}
        />
      </Group>
    </>
  ),
})
