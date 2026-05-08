'use client'

import { useEffect, useState } from 'react'
import { z } from 'zod'
import { ChevronUp } from 'lucide-react'
import { Field, Group, SliderControl } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'

const schema = z.object({
  threshold: z.number().min(0).max(10000).optional(),
})

export const backToTop = defineBlock({
  type: 'backToTop',
  schema,
  defaults: { threshold: 400 },
  meta: {
    name: 'Retour en haut',
    description: 'Bouton remontée flottant',
    category: 'navigation',
    icon: 'arrow-up-right',
    shortcuts: ['top', 'totop'],
  },
  Render: ({ props }) => {
    const { threshold = 400 } = props
    const [show, setShow] = useState(false)
    useEffect(() => {
      const onScroll = () => setShow(window.scrollY > threshold)
      onScroll()
      window.addEventListener('scroll', onScroll, { passive: true })
      return () => window.removeEventListener('scroll', onScroll)
    }, [threshold])
    if (!show) return null
    return (
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-6 right-6 z-40 flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-110 transition-transform"
        title="Remonter en haut"
      >
        <ChevronUp className="size-5" />
      </button>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Seuil d'affichage (px scrollés)">
        <SliderControl
          value={props.threshold ?? 400}
          onChange={(v) => onChange({ threshold: v })}
          min={100}
          max={2000}
          step={50}
          suffix="px"
        />
      </Field>
    </Group>
  ),
})
