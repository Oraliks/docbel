'use client'

import { Music } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Field, Group } from '@/components/page-builder/inspector/controls'
import { DocumentUpload } from '@/components/page-builder/inspector/document-upload'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { audioSchema as schema } from './schemas'

export const audio = defineBlock({
  type: 'audio',
  schema,
  defaults: { url: '', title: '', artist: '', caption: '' },
  meta: {
    name: 'Audio',
    description: 'Lecteur audio',
    category: 'media',
    icon: 'video',
    shortcuts: ['audio', 'podcast', 'mp3'],
  },
  Render: ({ props }) => {
    const { url, fileId, title, artist, caption } = props
    const src = fileId ? `/api/files/${fileId}/download` : url
    if (!src) {
      return (
        <div className="rounded-lg border border-dashed bg-muted px-4 py-6 text-sm text-muted-foreground flex items-center gap-3">
          <Music className="size-5" />
          Audio non configuré
        </div>
      )
    }
    return (
      <div className="rounded-2xl border bg-card p-4 my-2">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
            <Music className="size-5" />
          </div>
          {(title || artist) && (
            <div className="min-w-0">
              {title && <div className="font-semibold truncate">{title}</div>}
              {artist && <div className="text-xs text-muted-foreground truncate">{artist}</div>}
            </div>
          )}
        </div>
        <audio controls className="w-full">
          <source src={src} />
          Votre navigateur ne supporte pas l’audio.
        </audio>
        {caption && <p className="mt-2 text-xs text-muted-foreground text-center">{caption}</p>}
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Fichier audio">
        <DocumentUpload fileId={props.fileId} url={props.url} onChange={(next) => onChange(next)} />
      </Field>
      <Field label="Titre">
        <Input value={props.title ?? ''} onChange={(e) => onChange({ title: e.target.value })} />
      </Field>
      <Field label="Artiste">
        <Input value={props.artist ?? ''} onChange={(e) => onChange({ artist: e.target.value })} />
      </Field>
      <Field label="Légende">
        <Input value={props.caption ?? ''} onChange={(e) => onChange({ caption: e.target.value })} />
      </Field>
    </Group>
  ),
})
