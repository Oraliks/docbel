'use client'

import { useState, type FormEvent } from 'react'
import { z } from 'zod'
import { useTranslations } from 'next-intl'
import { Check, Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Field, Group } from '@/components/page-builder/inspector/controls'
import { LinkInput } from '@/components/page-builder/inspector/link-input'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { safeHref } from '@/lib/page-builder/url-utils'
import { leadMagnetSchema as schema } from './schemas'

type Props = z.infer<typeof schema>

function LeadMagnetView({
  title,
  description,
  collectName,
  buttonText,
  fileUrl,
  fileName,
  successMessage,
  endpoint = '/api/messages',
}: Props) {
  const t = useTranslations('public.blocks')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const buttonTextResolved = buttonText ?? t('leadMagnet.buttonFallback')
  const successMessageResolved = successMessage ?? t('leadMagnet.successFallback')

  const triggerDownload = () => {
    const href = safeHref(fileUrl)
    if (!href) return
    const a = document.createElement('a')
    a.href = href
    if (fileName) a.download = fileName
    a.rel = 'noopener'
    a.target = '_blank'
    a.click()
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email) return
    setSubmitting(true)
    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(collectName ? { nom: name } : {}),
          email,
          document: title || 'Lead magnet',
        }),
      })
      setSuccess(true)
      toast.success(successMessageResolved)
      triggerDownload()
    } catch {
      toast.error(t('leadMagnet.error'))
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls =
    'flex-1 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50'

  return (
    <div className="my-2 rounded-2xl border bg-card p-6 md:p-8">
      {title && <h3 className="text-xl font-semibold tracking-tight">{title}</h3>}
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      {success ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm font-medium text-emerald-600">
          <Check className="size-4" />
          {successMessageResolved}
          {fileUrl && (
            <button
              type="button"
              onClick={triggerDownload}
              className="ml-1 inline-flex items-center gap-1 underline"
            >
              <Download className="size-3.5" />
              {t('leadMagnet.downloadAgain')}
            </button>
          )}
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-2 sm:flex-row">
          {collectName && (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('leadMagnet.namePlaceholder')}
              className={inputCls}
            />
          )}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('leadMagnet.emailPlaceholder')}
            className={inputCls}
          />
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            {buttonTextResolved}
          </button>
        </form>
      )}
    </div>
  )
}

export const leadMagnet = defineBlock({
  type: 'leadMagnet',
  schema,
  defaults: {
    title: 'Téléchargez notre guide gratuit',
    description: 'Laissez votre email pour recevoir le document.',
    collectName: false,
    buttonText: 'Recevoir le document',
    fileUrl: '',
    fileName: '',
    successMessage: 'Merci ! Votre téléchargement va démarrer.',
    endpoint: '/api/messages',
  },
  meta: {
    name: 'Lead magnet',
    description: 'Formulaire + téléchargement après inscription',
    category: 'marketing',
    icon: 'gift',
    shortcuts: ['lead', 'magnet', 'ebook', 'download'],
  },
  Render: ({ props }) => <LeadMagnetView {...props} />,
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
        <div className="flex items-center justify-between gap-4 py-1">
          <Field label="Demander aussi le nom" className="flex-1">
            <span className="sr-only">Collecter le nom</span>
          </Field>
          <Switch
            checked={props.collectName ?? false}
            onCheckedChange={(v) => onChange({ collectName: v })}
          />
        </div>
        <Field label="Texte du bouton">
          <Input
            value={props.buttonText ?? ''}
            onChange={(e) => onChange({ buttonText: e.target.value })}
          />
        </Field>
      </Group>
      <Group title="Fichier à offrir" defaultOpen>
        <Field label="Fichier (URL)">
          <LinkInput
            value={props.fileUrl ?? ''}
            onChange={(fileUrl) => onChange({ fileUrl })}
            placeholder="/uploads/guide.pdf"
          />
        </Field>
        <Field label="Nom de fichier (optionnel)">
          <Input
            value={props.fileName ?? ''}
            onChange={(e) => onChange({ fileName: e.target.value })}
            placeholder="guide.pdf"
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
    </>
  ),
})
