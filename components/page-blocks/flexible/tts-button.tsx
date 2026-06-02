'use client'

import { useState } from 'react'
import { Volume2 } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, Group } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'
import { ttsButtonSchema as schema } from './schemas'

export const ttsButton = defineBlock({
  type: 'ttsButton',
  schema,
  defaults: { label: 'Lire l\'article', voice: 'fr-FR' },
  meta: {
    name: 'Lire à voix haute',
    description: 'Synthèse vocale du contenu',
    category: 'education',
    icon: 'mic',
    shortcuts: ['tts', 'voix'],
  },
  Render: ({ props }) => {
    const { text, label = 'Lire à voix haute', voice = 'fr-FR' } = props
    const [speaking, setSpeaking] = useState(false)

    const speak = () => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        toast.error('Synthèse vocale non disponible sur ce navigateur')
        return
      }
      if (speaking) {
        window.speechSynthesis.cancel()
        setSpeaking(false)
        return
      }
      const content =
        text ||
        document.querySelector('.page-content')?.textContent?.trim() ||
        'Aucun contenu à lire.'
      const utter = new SpeechSynthesisUtterance(content)
      utter.lang = voice
      utter.onend = () => setSpeaking(false)
      utter.onerror = () => setSpeaking(false)
      window.speechSynthesis.speak(utter)
      setSpeaking(true)
    }

    return (
      <button
        type="button"
        onClick={speak}
        className={cn(
          'inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition my-1',
          speaking ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'
        )}
      >
        <Volume2 className={cn('size-4', speaking && 'animate-pulse')} />
        {speaking ? 'Arrêter' : label}
      </button>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Texte à lire (vide = page entière)">
        <Textarea
          value={props.text ?? ''}
          onChange={(e) => onChange({ text: e.target.value })}
          rows={3}
          className="resize-y"
        />
      </Field>
      <Field label="Libellé du bouton">
        <Input
          value={props.label ?? ''}
          onChange={(e) => onChange({ label: e.target.value })}
        />
      </Field>
      <Field label="Voix (BCP 47)">
        <Input
          value={props.voice ?? ''}
          onChange={(e) => onChange({ voice: e.target.value })}
          placeholder="fr-FR, nl-BE, en-US…"
          className="font-mono text-xs"
        />
      </Field>
    </Group>
  ),
})
