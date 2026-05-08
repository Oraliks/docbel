'use client'

import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Field, Group } from '@/components/page-builder/inspector/controls'
import { RepeaterList } from '@/components/page-builder/inspector/repeater-list'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'

const rowSchema = z.object({
  situation: z.string().max(500),
  montant: z.string().max(120),
  periode: z.string().max(60).optional(),
  remarque: z.string().max(500).optional(),
})

const schema = z.object({
  title: z.string().max(500).optional(),
  subtitle: z.string().max(500).optional(),
  rows: z.array(rowSchema).max(50),
  source: z.string().max(200).optional(),
})

type Row = z.infer<typeof rowSchema>

export const tarifsTable = defineBlock({
  type: 'tarifsTable',
  schema,
  defaults: {
    title: 'Montants en vigueur',
    subtitle: '',
    rows: [
      { situation: 'Cohabitant', montant: '985,00 €', periode: '/ mois' },
      { situation: 'Isolé', montant: '1 300,00 €', periode: '/ mois' },
      { situation: 'Avec famille à charge', montant: '1 715,00 €', periode: '/ mois' },
    ],
    source: 'SPF Sécurité sociale',
  },
  meta: {
    name: 'Tarifs / Allocations',
    description: 'Table de montants par situation',
    category: 'docbel',
    icon: 'bar-chart-3',
    shortcuts: ['tarifs', 'allocations', 'montants'],
  },
  Render: ({ props }) => {
    const { title, subtitle, rows, source } = props
    return (
      <div className="rounded-2xl border bg-card overflow-hidden my-2">
        {(title || subtitle) && (
          <div className="border-b bg-muted/40 p-4">
            {title && <h3 className="font-semibold">{title}</h3>}
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        )}
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Situation
              </th>
              <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Montant
              </th>
              <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Période
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={cn(i < rows.length - 1 && 'border-b')}>
                <td className="px-4 py-3">
                  <div className="font-medium text-sm">{row.situation}</div>
                  {row.remarque && (
                    <div className="text-xs text-muted-foreground mt-0.5">{row.remarque}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-bold tabular-nums">{row.montant}</td>
                <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                  {row.periode || ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {source && (
          <div className="border-t px-4 py-2 text-[10px] text-muted-foreground italic">
            Source : {source}
          </div>
        )}
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
        <Field label="Sous-titre">
          <Input
            value={props.subtitle ?? ''}
            onChange={(e) => onChange({ subtitle: e.target.value })}
          />
        </Field>
        <Field label="Source">
          <Input
            value={props.source ?? ''}
            onChange={(e) => onChange({ source: e.target.value })}
            placeholder="SPF Sécurité sociale"
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
                value={it.situation}
                onChange={(e) => set({ situation: e.target.value })}
                placeholder="Situation"
                className="h-8 text-xs"
              />
              <div className="grid grid-cols-2 gap-1.5">
                <Input
                  value={it.montant}
                  onChange={(e) => set({ montant: e.target.value })}
                  placeholder="Montant"
                  className="h-8 text-xs"
                />
                <Input
                  value={it.periode ?? ''}
                  onChange={(e) => set({ periode: e.target.value })}
                  placeholder="/mois"
                  className="h-8 text-xs"
                />
              </div>
              <Input
                value={it.remarque ?? ''}
                onChange={(e) => set({ remarque: e.target.value })}
                placeholder="Remarque (optionnel)"
                className="h-8 text-xs"
              />
            </>
          )}
          addItem={() => ({ situation: 'Nouvelle situation', montant: '0,00 €' })}
        />
      </Group>
    </>
  ),
})
