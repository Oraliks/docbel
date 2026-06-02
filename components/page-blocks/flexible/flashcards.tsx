'use client'

import { useState } from 'react'
import { z } from 'zod'
import { RotateCw } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Field, Group } from '@/components/page-builder/inspector/controls'
import { RepeaterList } from '@/components/page-builder/inspector/repeater-list'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { flashcardsSchema as schema } from './schemas'

type Card = z.infer<typeof schema>['items'][number]

export const flashcards = defineBlock({
  type: 'flashcards',
  schema,
  defaults: {
    title: 'Apprenez les termes',
    items: [
      { front: 'Cohabitant', back: 'Personne vivant sous le même toit que d\'autres adultes.' },
      { front: 'Isolé', back: 'Personne vivant seule, sans cohabitant adulte.' },
    ],
  },
  meta: {
    name: 'Flashcards',
    description: 'Cartes recto-verso',
    category: 'education',
    icon: 'graduation-cap',
    shortcuts: ['flashcards', 'cards'],
  },
  Render: ({ props }) => {
    const { title, items } = props
    const [idx, setIdx] = useState(0)
    const [flipped, setFlipped] = useState(false)

    if (items.length === 0) return null
    const card = items[idx]

    const next = () => {
      setIdx((i) => (i + 1) % items.length)
      setFlipped(false)
    }
    const prev = () => {
      setIdx((i) => (i - 1 + items.length) % items.length)
      setFlipped(false)
    }

    return (
      <div className="my-2 max-w-md mx-auto">
        {title && <h3 className="text-lg font-semibold mb-3 text-center">{title}</h3>}
        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          className="relative w-full aspect-[3/2] rounded-2xl border-2 bg-card hover:shadow-lg transition"
          style={{ perspective: 1000 }}
        >
          <div
            className="absolute inset-0 flex items-center justify-center text-2xl font-medium p-6 text-center transition-all duration-500"
            style={{
              transform: flipped ? 'rotateY(180deg)' : 'rotateY(0)',
              backfaceVisibility: 'hidden',
            }}
          >
            {card.front}
          </div>
          <div
            className="absolute inset-0 flex items-center justify-center text-base bg-primary/5 rounded-2xl p-6 text-center transition-all duration-500"
            style={{
              transform: flipped ? 'rotateY(0)' : 'rotateY(-180deg)',
              backfaceVisibility: 'hidden',
            }}
          >
            {card.back}
          </div>
        </button>
        <div className="mt-3 flex items-center justify-between text-sm">
          <button onClick={prev} className="text-muted-foreground hover:text-foreground">
            ← Précédent
          </button>
          <span className="font-medium tabular-nums">
            {idx + 1} / {items.length}
          </span>
          <button onClick={next} className="text-muted-foreground hover:text-foreground">
            Suivant →
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Cliquez sur la carte pour la retourner <RotateCw className="inline size-3 ml-1" />
        </p>
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
      <Group title={`Cartes (${props.items.length})`} defaultOpen>
        <RepeaterList<Card>
          items={props.items}
          onChange={(items) => onChange({ items })}
          render={(it, set) => (
            <>
              <Input
                value={it.front}
                onChange={(e) => set({ front: e.target.value })}
                placeholder="Recto"
                className="h-8 text-xs"
              />
              <Input
                value={it.back}
                onChange={(e) => set({ back: e.target.value })}
                placeholder="Verso"
                className="h-8 text-xs"
              />
            </>
          )}
          addItem={() => ({ front: 'Question', back: 'Réponse' })}
        />
      </Group>
    </>
  ),
})
