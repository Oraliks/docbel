'use client'

import { useState } from 'react'
import { z } from 'zod'
import { Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Field, Group } from '@/components/page-builder/inspector/controls'
import { RepeaterList } from '@/components/page-builder/inspector/repeater-list'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'
import { pollOptionSchema, pollSchema as schema } from './schemas'

type Option = z.infer<typeof pollOptionSchema>

export const poll = defineBlock({
  type: 'poll',
  schema,
  defaults: {
    question: 'Quelle est votre opinion ?',
    options: [
      { label: 'Très favorable', votes: 0 },
      { label: 'Favorable', votes: 0 },
      { label: 'Mitigé', votes: 0 },
      { label: 'Défavorable', votes: 0 },
    ],
  },
  meta: {
    name: 'Sondage',
    description: 'Vote en direct',
    category: 'engagement',
    icon: 'bar-chart-3',
    shortcuts: ['poll', 'vote', 'sondage'],
  },
  Render: ({ props }) => {
    const { question, options } = props
    const [voted, setVoted] = useState<number | null>(null)
    const [counts, setCounts] = useState<number[]>(() => options.map((o) => o.votes))
    const total = counts.reduce((a, b) => a + b, 0) || 1

    const vote = (i: number) => {
      if (voted !== null) return
      setVoted(i)
      setCounts((c) => c.map((v, idx) => (idx === i ? v + 1 : v)))
    }

    return (
      <div className="rounded-2xl border bg-card p-6 my-2">
        <p className="text-lg font-semibold mb-4">{question}</p>
        <div className="space-y-2">
          {options.map((opt, i) => {
            const pct = (counts[i] / total) * 100
            const isVoted = voted === i
            return (
              <button
                key={i}
                type="button"
                onClick={() => vote(i)}
                disabled={voted !== null}
                className={cn(
                  'relative w-full overflow-hidden rounded-md border bg-card px-4 py-3 text-left text-sm font-medium transition',
                  voted !== null
                    ? 'cursor-default'
                    : 'hover:border-primary hover:bg-primary/5'
                )}
              >
                {voted !== null && (
                  <div
                    className={cn(
                      'absolute inset-y-0 left-0 transition-all',
                      isVoted ? 'bg-primary/20' : 'bg-muted/40'
                    )}
                    style={{ width: `${pct}%` }}
                  />
                )}
                <span className="relative flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    {isVoted && <Check className="size-4 text-primary" />}
                    {opt.label}
                  </span>
                  {voted !== null && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {pct.toFixed(0)}% · {counts[i]}
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
        {voted !== null && (
          <p className="mt-3 text-xs text-muted-foreground text-center">
            {total} vote{total > 1 ? 's' : ''} · Résultat local (non persisté)
          </p>
        )}
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <>
      <Group title="Contenu" defaultOpen>
        <Field label="Question">
          <Input
            value={props.question}
            onChange={(e) => onChange({ question: e.target.value })}
          />
        </Field>
      </Group>
      <Group title={`Options (${props.options.length})`} defaultOpen>
        <RepeaterList<Option>
          items={props.options}
          onChange={(options) => onChange({ options })}
          render={(it, set) => (
            <Input
              value={it.label}
              onChange={(e) => set({ label: e.target.value })}
              placeholder="Option"
              className="h-8 text-xs"
            />
          )}
          addItem={() => ({ label: 'Nouvelle option', votes: 0 })}
        />
      </Group>
    </>
  ),
})
