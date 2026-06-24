'use client'

import { useState, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import { Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, Group } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { newsletterSchema as schema } from './schemas'

export const newsletter = defineBlock({
  type: 'newsletter',
  schema,
  defaults: {
    title: 'Restez informé',
    description: 'Recevez nos nouveautés une fois par semaine.',
    placeholder: 'votre@email.com',
    buttonText: 'S\'inscrire',
    endpoint: '/api/messages',
    successMessage: 'Merci, vous êtes inscrit !',
  },
  meta: {
    name: 'Newsletter inline',
    description: 'Inscription email rapide',
    category: 'marketing',
    icon: 'mail',
    shortcuts: ['newsletter', 'subscribe'],
  },
  Render: ({ props }) => {
    const tr = useTranslations('public.blocks')
    const {
      title,
      description,
      placeholder = 'votre@email.com',
      buttonText,
      endpoint = '/api/messages',
      successMessage = 'Merci, vous êtes inscrit !',
    } = props
    const [email, setEmail] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [success, setSuccess] = useState(false)

    const onSubmit = async (e: FormEvent) => {
      e.preventDefault()
      if (!email) return
      setSubmitting(true)
      try {
        if (endpoint) {
          await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          })
        }
        setSuccess(true)
        toast.success(successMessage)
      } catch {
        toast.error(tr('newsletter.error'))
      } finally {
        setSubmitting(false)
      }
    }

    return (
      <div className="rounded-2xl border bg-card p-6 my-2">
        {title && <h3 className="text-lg font-semibold">{title}</h3>}
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        {success ? (
          <div className="mt-4 flex items-center gap-2 text-emerald-600 text-sm font-medium">
            <Check className="size-4" />
            {successMessage}
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-4 flex gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={placeholder}
              className="flex-1 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
            />
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {buttonText}
            </button>
          </form>
        )}
      </div>
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
      <Field label="Description">
        <Textarea
          value={props.description ?? ''}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={2}
          className="resize-y"
        />
      </Field>
      <Field label="Placeholder champ email">
        <Input
          value={props.placeholder ?? ''}
          onChange={(e) => onChange({ placeholder: e.target.value })}
        />
      </Field>
      <Field label="Texte du bouton">
        <Input
          value={props.buttonText}
          onChange={(e) => onChange({ buttonText: e.target.value })}
        />
      </Field>
      <Field label="Endpoint POST (optionnel)">
        <Input
          value={props.endpoint ?? ''}
          onChange={(e) => onChange({ endpoint: e.target.value })}
          placeholder="/api/newsletter/subscribe"
          className="font-mono text-xs"
        />
      </Field>
      <Field label="Message de succès">
        <Input
          value={props.successMessage ?? ''}
          onChange={(e) => onChange({ successMessage: e.target.value })}
        />
      </Field>
    </Group>
  ),
})
