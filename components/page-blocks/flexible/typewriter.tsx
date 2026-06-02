'use client'

import { useEffect, useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Field, Group, SliderControl } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { typewriterSchema as schema } from './schemas'

export const typewriter = defineBlock({
  type: 'typewriter',
  schema,
  defaults: {
    texts: ['Bienvenue', 'Sur Docbel', 'Documents administratifs simplifiés'],
    speed: 80,
    loop: true,
    cursor: true,
  },
  meta: {
    name: 'Texte tape-écran',
    description: 'Animation typewriter',
    category: 'decorative',
    icon: 'type',
    shortcuts: ['typewriter'],
  },
  Render: ({ props }) => {
    const { texts, speed = 80, loop = true, cursor = true } = props
    const [textIdx, setTextIdx] = useState(0)
    const [displayed, setDisplayed] = useState('')
    const [phase, setPhase] = useState<'typing' | 'pause' | 'erasing'>('typing')

    useEffect(() => {
      if (texts.length === 0) return
      const current = texts[textIdx]
      let timer: ReturnType<typeof setTimeout>
      if (phase === 'typing') {
        if (displayed.length < current.length) {
          timer = setTimeout(() => setDisplayed(current.slice(0, displayed.length + 1)), speed)
        } else {
          timer = setTimeout(() => setPhase('pause'), 1500)
        }
      } else if (phase === 'pause') {
        timer = setTimeout(() => setPhase('erasing'), 800)
      } else {
        if (displayed.length > 0) {
          timer = setTimeout(() => setDisplayed(displayed.slice(0, -1)), speed / 2)
        } else {
          const nextIdx = (textIdx + 1) % texts.length
          if (loop || nextIdx !== 0) {
            setTextIdx(nextIdx)
            setPhase('typing')
          }
        }
      }
      return () => clearTimeout(timer)
    }, [displayed, phase, textIdx, texts, speed, loop])

    return (
      <span className="font-medium">
        {displayed}
        {cursor && (
          <span className="inline-block w-0.5 h-[1em] bg-current ml-0.5 align-middle animate-pulse" />
        )}
      </span>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Textes (un par ligne)">
        <Textarea
          value={props.texts.join('\n')}
          onChange={(e) =>
            onChange({ texts: e.target.value.split('\n').filter(Boolean) })
          }
          rows={4}
          className="text-xs resize-y"
        />
      </Field>
      <Field label="Vitesse (ms par caractère)">
        <SliderControl
          value={props.speed ?? 80}
          onChange={(v) => onChange({ speed: v })}
          min={20}
          max={300}
          step={10}
          suffix="ms"
        />
      </Field>
      <div className="flex items-center justify-between gap-4 py-1">
        <Field label="Boucler" className="flex-1">
          <span className="sr-only">loop</span>
        </Field>
        <Switch
          checked={props.loop ?? true}
          onCheckedChange={(v) => onChange({ loop: v })}
        />
      </div>
      <div className="flex items-center justify-between gap-4 py-1">
        <Field label="Curseur" className="flex-1">
          <span className="sr-only">cursor</span>
        </Field>
        <Switch
          checked={props.cursor ?? true}
          onCheckedChange={(v) => onChange({ cursor: v })}
        />
      </div>
    </Group>
  ),
})
