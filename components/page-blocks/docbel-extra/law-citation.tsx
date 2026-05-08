'use client'

import { z } from 'zod'
import { Scale } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, Group } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'

const schema = z.object({
  reference: z.string().max(500).default(''),
  text: z.string().max(5000).default(''),
  source: z.string().max(200).optional(),
  link: z.string().max(4096).optional(),
})

export const lawCitation = defineBlock({
  type: 'lawCitation',
  schema,
  defaults: {
    reference: 'Art. 23 — LOI du 26 mai 2002',
    text: 'Toute personne a droit à l\'intégration sociale. Ce droit peut, dans les conditions fixées par la présente loi, prendre la forme d\'un emploi et/ou d\'un revenu d\'intégration.',
    source: 'Moniteur belge',
    link: '',
  },
  meta: {
    name: 'Citation de loi',
    description: 'Article de loi formaté',
    category: 'docbel',
    icon: 'file-text',
    shortcuts: ['law', 'loi', 'article'],
  },
  Render: ({ props }) => {
    const { reference, text, source, link } = props
    return (
      <figure className="rounded-2xl border-l-4 border-primary bg-primary/5 px-5 py-4 my-2">
        <div className="flex items-center gap-2 mb-2">
          <Scale className="size-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            {reference}
          </span>
        </div>
        <blockquote className="text-sm leading-relaxed italic">« {text} »</blockquote>
        {(source || link) && (
          <figcaption className="mt-2 text-xs text-muted-foreground">
            {source && <span>— {source}</span>}
            {link && (
              <>
                {source && ' · '}
                <a
                  href={link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  Voir la source
                </a>
              </>
            )}
          </figcaption>
        )}
      </figure>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Référence">
        <Input
          value={props.reference}
          onChange={(e) => onChange({ reference: e.target.value })}
          placeholder="Art. 23 — LOI du 26 mai 2002"
        />
      </Field>
      <Field label="Texte cité">
        <Textarea
          value={props.text}
          onChange={(e) => onChange({ text: e.target.value })}
          rows={4}
          className="resize-y"
        />
      </Field>
      <Field label="Source">
        <Input
          value={props.source ?? ''}
          onChange={(e) => onChange({ source: e.target.value })}
          placeholder="Moniteur belge"
        />
      </Field>
      <Field label="Lien">
        <Input
          value={props.link ?? ''}
          onChange={(e) => onChange({ link: e.target.value })}
        />
      </Field>
    </Group>
  ),
})
