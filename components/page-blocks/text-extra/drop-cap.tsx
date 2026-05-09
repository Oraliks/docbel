'use client'

import { z } from 'zod'
import { Textarea } from '@/components/ui/textarea'
import { ColorControl, Field, Group } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'

const schema = z.object({
  html: z.string().max(20000).default(''),
  capColor: z.string().optional(),
})

export const dropCap = defineBlock({
  type: 'dropCap',
  schema,
  defaults: {
    html: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec eget mauris sed lectus dapibus tincidunt.',
    capColor: '#7C3AED',
  },
  meta: {
    name: 'Lettrine',
    description: 'Première lettre stylisée',
    category: 'text',
    icon: 'type',
    shortcuts: ['dropcap', 'lettrine'],
  },
  Render: ({ props }) => {
    const stripped = props.html.replace(/<[^>]+>/g, '').trim()
    const first = stripped.charAt(0)
    const rest = stripped.slice(1)
    return (
      <div className="prose-tight max-w-none my-3">
        <p className="text-base leading-relaxed">
          <span
            className="float-left text-6xl md:text-7xl font-bold leading-none mr-3 mt-1"
            style={{ color: props.capColor || 'currentColor', lineHeight: '0.85' }}
          >
            {first}
          </span>
          {rest}
        </p>
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Texte (la première lettre sera stylée)">
        <Textarea value={props.html} onChange={(e) => onChange({ html: e.target.value })} rows={5} />
      </Field>
      <Field label="Couleur de la lettrine">
        <ColorControl value={props.capColor} onChange={(v) => onChange({ capColor: v })} />
      </Field>
    </Group>
  ),
})
