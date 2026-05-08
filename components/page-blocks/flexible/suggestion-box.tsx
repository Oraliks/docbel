'use client'

import { useState, type FormEvent } from 'react'
import { z } from 'zod'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Field, Group } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'

const schema = z.object({
  title: z.string().max(500).optional(),
  placeholder: z.string().max(200).optional(),
  endpoint: z.string().max(500).optional(),
})

export const suggestionBox = defineBlock({
  type: 'suggestionBox',
  schema,
  defaults: {
    title: 'Une idée d\'amélioration ?',
    placeholder: 'Votre suggestion…',
  },
  meta: {
    name: 'Boîte à idées',
    description: 'Soumettre une suggestion',
    category: 'engagement',
    icon: 'mail',
    shortcuts: ['suggestion', 'idee'],
  },
  Render: ({ props }) => {
    const {
      title = 'Une idée à partager ?',
      placeholder = 'Votre suggestion…',
      endpoint,
    } = props
    const [text, setText] = useState('')
    const [submitted, setSubmitted] = useState(false)

    const submit = async (e: FormEvent) => {
      e.preventDefault()
      if (!text.trim()) return
      if (endpoint) {
        try {
          await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ suggestion: text }),
          })
        } catch {
          toast.error('Erreur — réessayez')
          return
        }
      }
      setSubmitted(true)
      toast.success('Merci pour votre suggestion !')
    }

    if (submitted) {
      return (
        <div className="rounded-2xl border bg-card p-5 my-2 text-center text-sm">
          ✨ Merci, votre suggestion a été enregistrée.
        </div>
      )
    }

    return (
      <form onSubmit={submit} className="rounded-2xl border bg-card p-5 my-2">
        <h3 className="font-semibold mb-2">{title}</h3>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="mt-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          Envoyer
        </button>
      </form>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Titre">
        <Input
          value={props.title ?? ''}
          onChange={(e) => onChange({ title: e.target.value })}
        />
      </Field>
      <Field label="Placeholder">
        <Input
          value={props.placeholder ?? ''}
          onChange={(e) => onChange({ placeholder: e.target.value })}
        />
      </Field>
      <Field label="Endpoint POST (optionnel)">
        <Input
          value={props.endpoint ?? ''}
          onChange={(e) => onChange({ endpoint: e.target.value })}
          placeholder="/api/suggestions"
          className="font-mono text-xs"
        />
      </Field>
    </Group>
  ),
})
