'use client'

import { z } from 'zod'
import { Textarea } from '@/components/ui/textarea'
import { Field, Group } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'

const schema = z.object({ html: z.string().max(50000).default('') })

export const htmlRaw = defineBlock({
  type: 'htmlRaw',
  schema,
  defaults: { html: '<div>Votre HTML ici</div>' },
  meta: {
    name: 'HTML brut',
    description: '⚠️ Code HTML injecté tel quel',
    category: 'utility',
    icon: 'code',
    shortcuts: ['html', 'raw'],
  },
  Render: ({ props }) => (
    <div className="my-2 prose-tight max-w-none" dangerouslySetInnerHTML={{ __html: props.html }} />
  ),
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="HTML brut" hint="⚠️ Code injecté tel quel · sources de confiance uniquement">
        <Textarea
          value={props.html}
          onChange={(e) => onChange({ html: e.target.value })}
          rows={8}
          className="font-mono text-xs resize-y"
        />
      </Field>
    </Group>
  ),
})
