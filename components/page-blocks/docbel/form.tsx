'use client'

import { useState, type FormEvent } from 'react'
import { z } from 'zod'
import { useTranslations } from 'next-intl'
import { Check, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Field, Group, Pills } from '@/components/page-builder/inspector/controls'
import { RepeaterList } from '@/components/page-builder/inspector/repeater-list'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { formSchema as schema } from './schemas'

type Props = z.infer<typeof schema>
type FieldDef = Props['fields'][number]

const FIELD_TYPES: Array<{ value: FieldDef['type']; label: string }> = [
  { value: 'text', label: 'Texte' },
  { value: 'email', label: 'Email' },
  { value: 'tel', label: 'Téléphone' },
  { value: 'textarea', label: 'Zone de texte' },
  { value: 'select', label: 'Liste' },
  { value: 'checkbox', label: 'Case à cocher' },
]

export const form = defineBlock({
  type: 'form',
  schema,
  defaults: {
    title: 'Contactez-nous',
    description: 'Remplissez ce formulaire pour nous écrire.',
    fields: [
      { type: 'text', name: 'name', label: 'Nom', required: true },
      { type: 'email', name: 'email', label: 'Email', required: true },
      { type: 'textarea', name: 'message', label: 'Message', required: true },
    ],
    submitText: 'Envoyer',
    successMessage: 'Merci, votre message a bien été envoyé.',
  },
  meta: {
    name: 'Formulaire',
    description: 'Champs de saisie + soumission',
    category: 'docbel',
    icon: 'mouse-pointer-click',
    shortcuts: ['form', 'formulaire', 'contact'],
  },
  Render: ({ props }) => {
    const t = useTranslations('public.blocks')
    const {
      title,
      description,
      fields,
      submitText,
      successMessage = 'Message envoyé.',
      endpoint = '/api/messages',
    } = props
    const [submitting, setSubmitting] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
      e.preventDefault()
      setSubmitting(true)
      setError(null)
      const formData = new FormData(e.currentTarget)
      const payload: Record<string, unknown> = {}
      formData.forEach((value, key) => {
        payload[key] = value
      })
      payload._source = window.location.pathname
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          setError(j.error || t('form.error'))
        } else {
          setSuccess(true)
          ;(e.currentTarget as HTMLFormElement).reset()
        }
      } catch {
        setError(t('form.networkError'))
      } finally {
        setSubmitting(false)
      }
    }

    return (
      <div className="rounded-2xl border bg-card p-6 md:p-8">
        {title && <h3 className="text-xl font-bold tracking-tight">{title}</h3>}
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        {success ? (
          <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200 dark:border-emerald-900 flex items-center gap-2">
            <Check className="size-4" />
            {successMessage}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {/* Honeypot anti-spam : caché aux humains, souvent rempli par les bots. */}
            <input
              type="text"
              name="_hp"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="absolute -left-[9999px] h-px w-px opacity-0"
            />
            {fields.map((field, i) => (
              <div key={i} className="space-y-1.5">
                <label className="text-sm font-medium">
                  {field.label}
                  {field.required && <span className="text-destructive ml-0.5">*</span>}
                </label>
                {field.type === 'textarea' ? (
                  <textarea
                    name={field.name}
                    placeholder={field.placeholder}
                    required={field.required}
                    minLength={field.minLength}
                    maxLength={field.maxLength}
                    rows={4}
                    className="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                  />
                ) : field.type === 'select' ? (
                  <select
                    name={field.name}
                    required={field.required}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                  >
                    <option value="">{field.placeholder || t('form.selectPlaceholder')}</option>
                    {field.options?.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : field.type === 'checkbox' ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name={field.name}
                      required={field.required}
                      className="size-4 rounded border-input"
                    />
                    <span className="text-sm">{field.placeholder || field.label}</span>
                  </div>
                ) : (
                  <input
                    type={field.type}
                    name={field.name}
                    placeholder={field.placeholder}
                    required={field.required}
                    pattern={field.pattern}
                    minLength={field.minLength}
                    maxLength={field.maxLength}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                  />
                )}
                {field.helpText && (
                  <p className="text-xs text-muted-foreground">{field.helpText}</p>
                )}
              </div>
            ))}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
              {submitText}
            </button>
          </form>
        )}
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <>
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
        <Field label="Texte du bouton">
          <Input
            value={props.submitText}
            onChange={(e) => onChange({ submitText: e.target.value })}
          />
        </Field>
        <Field label="Message de succès">
          <Input
            value={props.successMessage ?? ''}
            onChange={(e) => onChange({ successMessage: e.target.value })}
          />
        </Field>
      </Group>
      <Group title={`Champs (${props.fields.length})`} defaultOpen>
        <RepeaterList<FieldDef>
          items={props.fields}
          onChange={(fields) => onChange({ fields })}
          render={(field, set) => (
            <>
              <Pills
                value={field.type}
                onChange={(v) => set({ type: v as FieldDef['type'] })}
                options={FIELD_TYPES}
              />
              <Input
                value={field.label}
                onChange={(e) => set({ label: e.target.value })}
                placeholder="Libellé"
                className="h-8 text-xs"
              />
              <Input
                value={field.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="nom-technique"
                className="h-8 text-xs font-mono"
              />
              {(field.type === 'text' ||
                field.type === 'email' ||
                field.type === 'tel' ||
                field.type === 'textarea') && (
                <>
                  <Input
                    value={field.placeholder ?? ''}
                    onChange={(e) => set({ placeholder: e.target.value })}
                    placeholder="Placeholder"
                    className="h-8 text-xs"
                  />
                  {field.type !== 'textarea' && (
                    <Input
                      value={field.pattern ?? ''}
                      onChange={(e) =>
                        set({ pattern: e.target.value || undefined })
                      }
                      placeholder="Pattern (regex HTML5)"
                      className="h-8 text-xs font-mono"
                    />
                  )}
                  <div className="flex gap-1.5">
                    <Input
                      type="number"
                      min={0}
                      max={5000}
                      value={field.minLength ?? ''}
                      onChange={(e) =>
                        set({
                          minLength:
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value),
                        })
                      }
                      placeholder="Min."
                      className="h-8 text-xs"
                    />
                    <Input
                      type="number"
                      min={1}
                      max={5000}
                      value={field.maxLength ?? ''}
                      onChange={(e) =>
                        set({
                          maxLength:
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value),
                        })
                      }
                      placeholder="Max."
                      className="h-8 text-xs"
                    />
                  </div>
                  <Input
                    value={field.helpText ?? ''}
                    onChange={(e) =>
                      set({ helpText: e.target.value || undefined })
                    }
                    placeholder="Texte d'aide"
                    className="h-8 text-xs"
                  />
                </>
              )}
              {field.type === 'select' && (
                <Textarea
                  value={(field.options ?? []).join('\n')}
                  onChange={(e) =>
                    set({
                      options: e.target.value
                        .split('\n')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="Une option par ligne"
                  rows={3}
                  className="resize-y text-xs"
                />
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Requis</span>
                <Switch
                  checked={field.required ?? false}
                  onCheckedChange={(v) => set({ required: v })}
                />
              </div>
            </>
          )}
          addItem={() => ({ type: 'text', name: 'champ', label: 'Nouveau champ' })}
        />
      </Group>
    </>
  ),
})
