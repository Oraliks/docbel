'use client'

import { useState } from 'react'
import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Field, Group } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'

const schema = z.object({
  question: z.string().max(500).default(''),
  thanksMessage: z.string().max(500).optional(),
  endpoint: z.string().max(500).optional(),
})

export const feedbackBar = defineBlock({
  type: 'feedbackBar',
  schema,
  defaults: {
    question: 'Cette page vous a-t-elle été utile ?',
    thanksMessage: 'Merci pour votre retour !',
  },
  meta: {
    name: 'Cette page vous a-t-elle aidé ?',
    description: 'Feedback rapide 👍/👎',
    category: 'engagement',
    icon: 'heart',
    shortcuts: ['feedback', 'helpful'],
  },
  Render: ({ props }) => {
    const { question, thanksMessage = 'Merci !', endpoint } = props
    const [voted, setVoted] = useState<boolean | null>(null)

    const handleVote = async (helpful: boolean) => {
      setVoted(helpful)
      if (endpoint) {
        try {
          await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              helpful,
              page: typeof window !== 'undefined' ? window.location.pathname : '',
            }),
          })
        } catch {
          // silent
        }
      }
    }

    if (voted !== null) {
      return (
        <div className="rounded-lg border bg-card p-4 my-2 text-center">
          <p className="text-sm text-muted-foreground">{thanksMessage}</p>
        </div>
      )
    }

    return (
      <div className="rounded-lg border bg-card p-4 my-2 flex flex-col sm:flex-row items-center gap-3 justify-center">
        <p className="text-sm font-medium">{question}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleVote(true)}
            className="rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 px-4 py-1.5 text-sm font-medium transition"
          >
            👍 Oui
          </button>
          <button
            type="button"
            onClick={() => handleVote(false)}
            className="rounded-full bg-red-500/15 hover:bg-red-500/25 text-red-700 dark:text-red-300 px-4 py-1.5 text-sm font-medium transition"
          >
            👎 Non
          </button>
        </div>
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Question">
        <Input
          value={props.question}
          onChange={(e) => onChange({ question: e.target.value })}
        />
      </Field>
      <Field label="Message de remerciement">
        <Input
          value={props.thanksMessage ?? ''}
          onChange={(e) => onChange({ thanksMessage: e.target.value })}
        />
      </Field>
      <Field label="Endpoint POST (optionnel)">
        <Input
          value={props.endpoint ?? ''}
          onChange={(e) => onChange({ endpoint: e.target.value })}
          placeholder="/api/feedback"
          className="font-mono text-xs"
        />
      </Field>
    </Group>
  ),
})
