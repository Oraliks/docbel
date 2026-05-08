'use client'

import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Field, Group } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'

const schema = z.object({
  sponsor: z.string().max(200).optional(),
})

export const sponsoredDisclosure = defineBlock({
  type: 'sponsoredDisclosure',
  schema,
  defaults: { sponsor: '' },
  meta: {
    name: 'Mention sponsorisée',
    description: 'Disclosure contenu sponsorisé',
    category: 'editorial',
    icon: 'shield',
    shortcuts: ['sponsored'],
  },
  Render: ({ props }) => (
    <div className="rounded-md border-l-4 border-amber-500 bg-amber-500/10 px-4 py-2 text-xs text-amber-900 dark:text-amber-200 my-2">
      <span className="font-semibold uppercase tracking-wider">Contenu sponsorisé</span>
      {props.sponsor && <span className="ml-2">— en partenariat avec {props.sponsor}</span>}
    </div>
  ),
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Sponsor">
        <Input
          value={props.sponsor ?? ''}
          onChange={(e) => onChange({ sponsor: e.target.value })}
        />
      </Field>
    </Group>
  ),
})
