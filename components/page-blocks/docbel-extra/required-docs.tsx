'use client'

import { z } from 'zod'
import { FileText } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Field, Group } from '@/components/page-builder/inspector/controls'
import { RepeaterList } from '@/components/page-builder/inspector/repeater-list'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'

const docSchema = z.object({
  name: z.string().max(500),
  description: z.string().max(1000).optional(),
  required: z.boolean().optional(),
})

const schema = z.object({
  title: z.string().max(500).optional(),
  items: z.array(docSchema).max(50),
})

type Doc = z.infer<typeof docSchema>

export const requiredDocs = defineBlock({
  type: 'requiredDocs',
  schema,
  defaults: {
    title: 'Pièces à fournir',
    items: [
      { name: 'Carte d\'identité', required: true, description: 'Recto-verso' },
      { name: 'Justificatif de domicile', required: true },
      { name: 'Composition de ménage', required: true },
      { name: 'Preuve de revenus', required: false, description: 'Si applicable' },
    ],
  },
  meta: {
    name: 'Documents requis',
    description: 'Checklist des pièces à fournir',
    category: 'docbel',
    icon: 'file-text',
    shortcuts: ['docs', 'documents'],
  },
  Render: ({ props }) => {
    const { title, items } = props
    return (
      <div className="rounded-2xl border bg-card p-5 my-2">
        {title && (
          <div className="flex items-center gap-2 mb-3">
            <FileText className="size-4 text-primary" />
            <h3 className="font-semibold">{title}</h3>
          </div>
        )}
        <ul className="space-y-2">
          {items.map((doc, i) => (
            <li key={i} className="flex items-start gap-3 text-sm">
              <span
                className={cn(
                  'mt-0.5 size-5 rounded-full border-2 flex items-center justify-center shrink-0',
                  doc.required ? 'border-primary' : 'border-muted-foreground/40'
                )}
              >
                {doc.required && <span className="size-2 rounded-full bg-primary" />}
              </span>
              <div className="flex-1">
                <span className="font-medium">{doc.name}</span>
                {!doc.required && (
                  <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Optionnel
                  </span>
                )}
                {doc.description && (
                  <div className="mt-0.5 text-xs text-muted-foreground">{doc.description}</div>
                )}
              </div>
            </li>
          ))}
        </ul>
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
      </Group>
      <Group title={`Documents (${props.items.length})`} defaultOpen>
        <RepeaterList<Doc>
          items={props.items}
          onChange={(items) => onChange({ items })}
          render={(it, set) => (
            <>
              <Input
                value={it.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="Nom du document"
                className="h-8 text-xs"
              />
              <Input
                value={it.description ?? ''}
                onChange={(e) => set({ description: e.target.value })}
                placeholder="Description (optionnel)"
                className="h-8 text-xs"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Obligatoire</span>
                <Switch
                  checked={it.required ?? true}
                  onCheckedChange={(v) => set({ required: v })}
                />
              </div>
            </>
          )}
          addItem={() => ({ name: 'Nouveau document', required: true })}
        />
      </Group>
    </>
  ),
})
