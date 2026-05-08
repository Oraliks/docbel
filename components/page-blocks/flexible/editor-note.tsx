'use client'

import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, Group } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'

const schema = z.object({
  content: z.string().max(2000).default(''),
  signedBy: z.string().max(200).optional(),
})

export const editorNote = defineBlock({
  type: 'editorNote',
  schema,
  defaults: {
    content: 'Mise à jour : précisions ajoutées suite aux retours de nos lecteurs.',
    signedBy: 'La rédaction',
  },
  meta: {
    name: 'Note de l\'éditeur',
    description: 'Encadré "Note de la rédaction"',
    category: 'text',
    icon: 'file-text',
    shortcuts: ['editor', 'note'],
  },
  Render: ({ props }) => (
    <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-3 my-2 italic text-sm">
      <span className="font-semibold not-italic uppercase tracking-wider text-xs text-primary mr-2">
        Note de la rédaction
      </span>
      {props.content}
      {props.signedBy && (
        <div className="mt-1 text-xs text-muted-foreground not-italic">— {props.signedBy}</div>
      )}
    </div>
  ),
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Contenu">
        <Textarea
          value={props.content}
          onChange={(e) => onChange({ content: e.target.value })}
          rows={3}
          className="resize-y"
        />
      </Field>
      <Field label="Signé par">
        <Input
          value={props.signedBy ?? ''}
          onChange={(e) => onChange({ signedBy: e.target.value })}
        />
      </Field>
    </Group>
  ),
})
