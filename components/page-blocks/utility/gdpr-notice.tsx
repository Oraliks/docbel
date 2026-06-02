'use client'

import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, Group } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { safeHref } from '@/lib/page-builder/url-utils'
import { gdprNoticeSchema as schema } from './schemas'

const KEY = 'docbel-gdpr-consent'

export const gdprNotice = defineBlock({
  type: 'gdprNotice',
  schema,
  defaults: {
    message:
      'Nous utilisons des cookies pour améliorer votre expérience. En continuant, vous acceptez notre politique.',
    acceptText: 'Accepter',
    declineText: 'Refuser',
    linkText: 'En savoir plus',
    link: '/mentions-legales',
  },
  meta: {
    name: 'Bannière GDPR',
    description: 'Bandeau cookies RGPD',
    category: 'utility',
    icon: 'shield',
    shortcuts: ['gdpr', 'rgpd', 'cookies'],
  },
  Render: ({ props }) => {
    const { message, acceptText, declineText, link, linkText } = props
    const [visible, setVisible] = useState(false)
    useEffect(() => {
      if (typeof window === 'undefined') return
      if (!localStorage.getItem(KEY)) setVisible(true)
    }, [])
    if (!visible) return null
    const accept = () => {
      localStorage.setItem(KEY, 'accepted')
      setVisible(false)
    }
    const decline = () => {
      localStorage.setItem(KEY, 'declined')
      setVisible(false)
    }
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-xl w-[calc(100%-2rem)] rounded-2xl border bg-card shadow-2xl p-5 animate-in slide-in-from-bottom-4 duration-300">
        <p className="text-sm leading-relaxed">{message}</p>
        {link && linkText && (
          <a href={safeHref(link)} className="text-xs text-primary hover:underline mt-2 inline-block">
            {linkText}
          </a>
        )}
        <div className="mt-4 flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={accept}
            className="flex-1 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
          >
            {acceptText}
          </button>
          {declineText && (
            <button
              type="button"
              onClick={decline}
              className="flex-1 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              {declineText}
            </button>
          )}
        </div>
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Message">
        <Textarea
          value={props.message}
          onChange={(e) => onChange({ message: e.target.value })}
          rows={3}
          className="resize-y"
        />
      </Field>
      <Field label="Texte Accepter">
        <Input
          value={props.acceptText}
          onChange={(e) => onChange({ acceptText: e.target.value })}
        />
      </Field>
      <Field label="Texte Refuser">
        <Input
          value={props.declineText ?? ''}
          onChange={(e) => onChange({ declineText: e.target.value })}
        />
      </Field>
      <Field label="Lien (politique)">
        <Input
          value={props.link ?? ''}
          onChange={(e) => onChange({ link: e.target.value })}
        />
      </Field>
      <Field label="Texte du lien">
        <Input
          value={props.linkText ?? ''}
          onChange={(e) => onChange({ linkText: e.target.value })}
        />
      </Field>
    </Group>
  ),
})
