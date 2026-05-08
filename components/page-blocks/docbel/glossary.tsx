'use client'

import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, Group } from '@/components/page-builder/inspector/controls'
import { RepeaterList } from '@/components/page-builder/inspector/repeater-list'
import { defineBlock } from '@/lib/page-builder/block-definition'

const itemSchema = z.object({
  term: z.string().max(200),
  definition: z.string().max(2000),
})

const schema = z.object({
  title: z.string().max(500).optional(),
  items: z.array(itemSchema).max(200),
  variant: z.enum(['list', 'cards', 'alphabetical']).optional(),
})

type Props = z.infer<typeof schema>
type Item = Props['items'][number]

export const glossary = defineBlock({
  type: 'glossary',
  schema,
  defaults: {
    title: 'Glossaire',
    items: [
      { term: 'Terme 1', definition: 'Définition du premier terme.' },
      { term: 'Terme 2', definition: 'Définition du deuxième terme.' },
    ],
    variant: 'list',
  },
  meta: {
    name: 'Glossaire',
    description: 'Liste de termes et définitions',
    category: 'docbel',
    icon: 'help-circle',
    shortcuts: ['glossary', 'glossaire', 'lexique'],
    variants: [
      { id: 'list', name: 'Liste' },
      { id: 'cards', name: 'Cartes' },
      { id: 'alphabetical', name: 'Alphabétique' },
    ],
  },
  Render: ({ props }) => {
    const { title, items, variant = 'list' } = props
    if (variant === 'alphabetical') {
      const grouped = items.reduce<Record<string, Item[]>>((acc, it) => {
        const letter = (it.term[0] || '#').toUpperCase()
        if (!acc[letter]) acc[letter] = []
        acc[letter].push(it)
        return acc
      }, {})
      const letters = Object.keys(grouped).sort()
      return (
        <div className="w-full py-6">
          <div className="mx-auto max-w-3xl px-4">
            {title && <h2 className="text-2xl font-bold tracking-tight mb-6">{title}</h2>}
            {letters.map((l) => (
              <div key={l} className="mb-6">
                <h3 className="text-3xl font-bold text-primary mb-3">{l}</h3>
                <dl className="space-y-3">
                  {grouped[l].map((item, i) => (
                    <div key={i} className="border-l-2 border-border pl-4">
                      <dt className="font-semibold">{item.term}</dt>
                      <dd className="text-sm text-muted-foreground mt-0.5">{item.definition}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </div>
      )
    }
    if (variant === 'cards') {
      return (
        <div className="w-full py-6">
          <div className="mx-auto max-w-5xl px-4">
            {title && <h2 className="text-2xl font-bold tracking-tight mb-6">{title}</h2>}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((item, i) => (
                <div key={i} className="rounded-xl border bg-card p-4">
                  <dt className="font-semibold text-primary">{item.term}</dt>
                  <dd className="mt-1 text-sm text-muted-foreground">{item.definition}</dd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    }
    return (
      <div className="w-full py-6">
        <div className="mx-auto max-w-3xl px-4">
          {title && <h2 className="text-2xl font-bold tracking-tight mb-6">{title}</h2>}
          <dl className="divide-y">
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-1 md:grid-cols-3 gap-2 py-3">
                <dt className="font-semibold md:col-span-1">{item.term}</dt>
                <dd className="text-sm text-muted-foreground md:col-span-2">{item.definition}</dd>
              </div>
            ))}
          </dl>
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
      </Group>
      <Group title={`Termes (${props.items.length})`} defaultOpen>
        <RepeaterList<Item>
          items={props.items}
          onChange={(items) => onChange({ items })}
          render={(item, set) => (
            <>
              <Input
                value={item.term}
                onChange={(e) => set({ term: e.target.value })}
                placeholder="Terme"
                className="h-8 text-xs"
              />
              <Textarea
                value={item.definition}
                onChange={(e) => set({ definition: e.target.value })}
                placeholder="Définition"
                rows={2}
                className="resize-y text-xs"
              />
            </>
          )}
          addItem={() => ({ term: 'Nouveau terme', definition: '' })}
        />
      </Group>
    </>
  ),
})
