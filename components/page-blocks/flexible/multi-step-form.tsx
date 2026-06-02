'use client'

import { Fragment, useState, type FormEvent } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Field, Group } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'
import { multiStepFormSchema as schema } from './schemas'

export const multiStepForm = defineBlock({
  type: 'multiStepForm',
  schema,
  defaults: {
    title: 'Demande en plusieurs étapes',
    steps: [
      {
        title: 'Vos informations',
        fields: [
          { type: 'text', name: 'name', label: 'Nom', required: true },
          { type: 'email', name: 'email', label: 'Email', required: true },
        ],
      },
      {
        title: 'Votre situation',
        fields: [
          {
            type: 'textarea',
            name: 'message',
            label: 'Détaillez votre demande',
            required: true,
          },
        ],
      },
    ],
    submitText: 'Envoyer',
  },
  meta: {
    name: 'Formulaire multi-étapes',
    description: 'Formulaire en plusieurs écrans',
    category: 'engagement',
    icon: 'mouse-pointer-click',
    shortcuts: ['multistep', 'wizard'],
  },
  Render: ({ props }) => {
    const {
      title,
      steps,
      submitText,
      successMessage = 'Demande envoyée.',
      endpoint = '/api/messages',
    } = props
    const [step, setStep] = useState(0)
    const [data, setData] = useState<Record<string, unknown>>({})
    const [submitting, setSubmitting] = useState(false)
    const [done, setDone] = useState(false)

    const isLast = step === steps.length - 1

    const next = (e: FormEvent) => {
      e.preventDefault()
      const formData = new FormData(e.currentTarget as HTMLFormElement)
      const stepData: Record<string, unknown> = {}
      formData.forEach((v, k) => (stepData[k] = v))
      const merged = { ...data, ...stepData }
      setData(merged)
      if (!isLast) {
        setStep((s) => s + 1)
        return
      }
      void (async () => {
        setSubmitting(true)
        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(merged),
          })
          if (res.ok) setDone(true)
          else toast.error('Erreur lors de l\'envoi')
        } catch {
          toast.error('Erreur réseau')
        } finally {
          setSubmitting(false)
        }
      })()
    }

    if (done) {
      return (
        <div className="rounded-2xl border bg-emerald-500/10 border-emerald-500/30 p-6 my-2 flex items-center gap-3">
          <Check className="size-5 text-emerald-600" />
          <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
            {successMessage}
          </p>
        </div>
      )
    }

    const current = steps[step]

    return (
      <div className="rounded-2xl border bg-card p-6 my-2">
        {title && <h3 className="text-lg font-semibold">{title}</h3>}
        <div className="mt-2 mb-4 flex items-center gap-2 text-xs">
          {steps.map((_, i) => (
            <Fragment key={i}>
              <div
                className={cn(
                  'flex size-7 items-center justify-center rounded-full font-bold transition',
                  i < step && 'bg-primary text-primary-foreground',
                  i === step && 'bg-primary/20 text-primary border-2 border-primary',
                  i > step && 'bg-muted text-muted-foreground'
                )}
              >
                {i < step ? <Check className="size-3" /> : i + 1}
              </div>
              {i < steps.length - 1 && <div className="flex-1 h-0.5 bg-border" />}
            </Fragment>
          ))}
        </div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Étape {step + 1} / {steps.length}
        </p>
        <h4 className="mt-1 text-base font-semibold">{current.title}</h4>
        <form onSubmit={next} className="mt-4 space-y-3">
          {current.fields.map((field, i) => (
            <div key={i} className="space-y-1">
              <label className="text-sm font-medium">
                {field.label}
                {field.required && <span className="text-destructive ml-0.5">*</span>}
              </label>
              {field.type === 'textarea' ? (
                <textarea
                  name={field.name}
                  placeholder={field.placeholder}
                  required={field.required}
                  rows={3}
                  className="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                />
              ) : field.type === 'select' ? (
                <select
                  name={field.name}
                  required={field.required}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                >
                  <option value="">{field.placeholder || 'Choisir…'}</option>
                  {field.options?.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type}
                  name={field.name}
                  placeholder={field.placeholder}
                  required={field.required}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                />
              )}
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Précédent
              </button>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="ml-auto rounded-md bg-primary text-primary-foreground px-5 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {submitting && <Loader2 className="size-3.5 animate-spin" />}
              {isLast ? submitText : 'Suivant'}
            </button>
          </div>
        </form>
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
      <Field label="Texte du bouton final">
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
      <Field label="Endpoint POST">
        <Input
          value={props.endpoint ?? ''}
          onChange={(e) => onChange({ endpoint: e.target.value })}
          className="font-mono text-xs"
        />
      </Field>
    </Group>
  ),
})
