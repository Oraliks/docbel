'use client'

import { useState } from 'react'
import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Group } from '@/components/page-builder/inspector/controls'
import { RepeaterList } from '@/components/page-builder/inspector/repeater-list'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'

const reactionSchema = z.object({
  emoji: z.string().max(10),
  label: z.string().max(60),
  count: z.number(),
})

const schema = z.object({
  reactions: z.array(reactionSchema).max(20),
})

type Reaction = z.infer<typeof reactionSchema>

export const reactions = defineBlock({
  type: 'reactions',
  schema,
  defaults: {
    reactions: [
      { emoji: '👍', label: 'J\'aime', count: 0 },
      { emoji: '❤️', label: 'J\'adore', count: 0 },
      { emoji: '🎉', label: 'Bravo', count: 0 },
      { emoji: '🤔', label: 'Réflexion', count: 0 },
    ],
  },
  meta: {
    name: 'Réactions',
    description: 'Boutons emoji like/love',
    category: 'engagement',
    icon: 'heart',
    shortcuts: ['reactions'],
  },
  Render: ({ props }) => {
    const [counts, setCounts] = useState(() => props.reactions.map((r) => r.count))
    const [active, setActive] = useState<Set<number>>(new Set())

    const toggle = (i: number) => {
      setActive((prev) => {
        const next = new Set(prev)
        if (next.has(i)) next.delete(i)
        else next.add(i)
        return next
      })
      setCounts((c) =>
        c.map((v, idx) => (idx === i ? v + (active.has(i) ? -1 : 1) : v))
      )
    }

    return (
      <div className="flex flex-wrap gap-2 my-2">
        {props.reactions.map((r, i) => (
          <button
            key={i}
            type="button"
            onClick={() => toggle(i)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition',
              active.has(i)
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border hover:border-muted-foreground'
            )}
            title={r.label}
          >
            <span className="text-base leading-none">{r.emoji}</span>
            <span className="font-medium tabular-nums">{counts[i]}</span>
          </button>
        ))}
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title={`Réactions (${props.reactions.length})`} defaultOpen>
      <RepeaterList<Reaction>
        items={props.reactions}
        onChange={(reactions) => onChange({ reactions })}
        render={(it, set) => (
          <div className="grid grid-cols-3 gap-1.5">
            <Input
              value={it.emoji}
              onChange={(e) => set({ emoji: e.target.value })}
              placeholder="👍"
              className="h-8 text-xs text-center"
            />
            <Input
              value={it.label}
              onChange={(e) => set({ label: e.target.value })}
              placeholder="Label"
              className="h-8 text-xs col-span-2"
            />
          </div>
        )}
        addItem={() => ({ emoji: '😀', label: 'Réaction', count: 0 })}
      />
    </Group>
  ),
})
