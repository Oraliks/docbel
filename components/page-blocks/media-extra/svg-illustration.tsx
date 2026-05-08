'use client'

import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, Group } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'

const schema = z.object({
  svg: z.string().max(50000).default(''),
  width: z.string().max(40).optional(),
  height: z.string().max(40).optional(),
})

export const svgIllustration = defineBlock({
  type: 'svgIllustration',
  schema,
  defaults: {
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>',
    width: '100px',
    height: '100px',
  },
  meta: {
    name: 'SVG illustration',
    description: 'Code SVG inline',
    category: 'media',
    icon: 'image',
    shortcuts: ['svg'],
  },
  Render: ({ props }) => (
    <div
      className="my-2 inline-flex items-center justify-center"
      style={{ width: props.width, height: props.height }}
      dangerouslySetInnerHTML={{ __html: props.svg }}
    />
  ),
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Code SVG" hint="⚠️ HTML brut · sources de confiance uniquement">
        <Textarea
          value={props.svg}
          onChange={(e) => onChange({ svg: e.target.value })}
          rows={6}
          className="font-mono text-xs resize-y"
        />
      </Field>
      <Field label="Largeur">
        <Input
          value={props.width ?? ''}
          onChange={(e) => onChange({ width: e.target.value })}
          placeholder="100px ou 100%"
        />
      </Field>
      <Field label="Hauteur">
        <Input
          value={props.height ?? ''}
          onChange={(e) => onChange({ height: e.target.value })}
          placeholder="100px ou auto"
        />
      </Field>
    </Group>
  ),
})
