'use client'

import { z } from 'zod'
import { Textarea } from '@/components/ui/textarea'
import { Field, Group } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'

const schema = z.object({ css: z.string().max(50000).default('') })

export const customCss = defineBlock({
  type: 'customCss',
  schema,
  defaults: { css: '/* Votre CSS ici */' },
  meta: {
    name: 'CSS custom',
    description: 'CSS appliqué à la page',
    category: 'utility',
    icon: 'code',
    shortcuts: ['css'],
  },
  Render: ({ props }) => <style dangerouslySetInnerHTML={{ __html: props.css }} />,
  Fields: ({ props, onChange }) => (
    <Group title="CSS" defaultOpen>
      <Field label="Code CSS" hint="Appliqué à toute la page">
        <Textarea
          value={props.css}
          onChange={(e) => onChange({ css: e.target.value })}
          rows={10}
          className="font-mono text-xs resize-y"
        />
      </Field>
    </Group>
  ),
})
