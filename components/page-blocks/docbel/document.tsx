'use client'

import type { ElementType } from 'react'
import { z } from 'zod'
import {
  FileText,
  FileImage,
  FileSpreadsheet,
  FileArchive,
  File as FileIcon,
  Download,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Field, Group } from '@/components/page-builder/inspector/controls'
import { DocumentUpload } from '@/components/page-builder/inspector/document-upload'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'

const schema = z.object({
  fileId: z.string().max(64).optional(),
  url: z.string().max(4096).optional(),
  title: z.string().max(500).default(''),
  description: z.string().max(2000).optional(),
  fileType: z.enum(['pdf', 'docx', 'xlsx', 'image', 'archive', 'other']).optional(),
  size: z.string().max(40).optional(),
  date: z.string().max(120).optional(),
  variant: z.enum(['card', 'inline', 'list']).optional(),
})

type Props = z.infer<typeof schema>

const ICONS: Record<NonNullable<Props['fileType']>, ElementType> = {
  pdf: FileText,
  docx: FileText,
  xlsx: FileSpreadsheet,
  image: FileImage,
  archive: FileArchive,
  other: FileIcon,
}

const COLORS: Record<NonNullable<Props['fileType']>, string> = {
  pdf: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  docx: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  xlsx: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  image: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  archive: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  other: 'bg-muted text-muted-foreground',
}

export const document = defineBlock({
  type: 'document',
  schema,
  defaults: {
    title: 'Nom du document',
    description: 'Description ou contexte du document.',
    fileType: 'pdf',
    size: '',
    date: '',
    variant: 'card',
  },
  meta: {
    name: 'Document',
    description: 'Fichier téléchargeable lié au file manager',
    category: 'docbel',
    icon: 'file-text',
    shortcuts: ['document', 'doc', 'pdf'],
    variants: [
      { id: 'card', name: 'Carte' },
      { id: 'inline', name: 'En ligne' },
      { id: 'list', name: 'Liste compacte' },
    ],
  },
  Render: ({ props }) => {
    const { fileId, url, title, description, fileType = 'pdf', size, date, variant = 'card' } = props
    const Icon = ICONS[fileType]
    const iconColor = COLORS[fileType]
    const downloadUrl = fileId ? `/api/files/${fileId}/download` : url || '#'

    if (variant === 'inline') {
      return (
        <a
          href={downloadUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm hover:border-primary hover:bg-primary/5 transition"
        >
          <Icon className="size-4 text-primary" />
          <span className="font-medium">{title}</span>
          {size && <span className="text-xs text-muted-foreground">· {size}</span>}
          <Download className="size-3.5 text-muted-foreground ml-1" />
        </a>
      )
    }
    if (variant === 'list') {
      return (
        <a
          href={downloadUrl}
          target="_blank"
          rel="noreferrer"
          className="group/doc flex items-center gap-3 rounded-md border bg-card px-4 py-3 hover:border-primary hover:bg-primary/5 transition"
        >
          <div className={cn('flex size-9 items-center justify-center rounded-md shrink-0', iconColor)}>
            <Icon className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium truncate">{title}</div>
            {(size || date) && (
              <div className="text-xs text-muted-foreground">
                {[fileType.toUpperCase(), size, date].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
          <Download className="size-4 text-muted-foreground group-hover/doc:text-primary shrink-0" />
        </a>
      )
    }
    return (
      <a
        href={downloadUrl}
        target="_blank"
        rel="noreferrer"
        className="group/doc flex gap-4 rounded-2xl border bg-card p-5 hover:border-primary hover:shadow-md transition"
      >
        <div className={cn('flex size-12 items-center justify-center rounded-xl shrink-0', iconColor)}>
          <Icon className="size-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{title}</div>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{description}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
            <span className="font-medium uppercase">{fileType}</span>
            {size && <span>{size}</span>}
            {date && <span>{date}</span>}
          </div>
        </div>
        <Download className="size-5 text-muted-foreground group-hover/doc:text-primary shrink-0 self-center" />
      </a>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Fichier">
        <DocumentUpload
          fileId={props.fileId}
          url={props.url}
          onChange={(next) => onChange(next)}
        />
      </Field>
      <Field label="Titre">
        <Input value={props.title} onChange={(e) => onChange({ title: e.target.value })} />
      </Field>
      <Field label="Description">
        <Textarea
          value={props.description ?? ''}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={2}
          className="resize-y"
        />
      </Field>
      <Field label="Type" hint="Détermine l'icône">
        <Select
          value={props.fileType ?? 'pdf'}
          onValueChange={(v) => onChange({ fileType: v as Props['fileType'] })}
        >
          <SelectTrigger className="h-8 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pdf">PDF</SelectItem>
            <SelectItem value="docx">Word (DOCX)</SelectItem>
            <SelectItem value="xlsx">Excel (XLSX)</SelectItem>
            <SelectItem value="image">Image</SelectItem>
            <SelectItem value="archive">Archive (ZIP, RAR)</SelectItem>
            <SelectItem value="other">Autre</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Taille (affichée)">
        <Input
          value={props.size ?? ''}
          onChange={(e) => onChange({ size: e.target.value })}
          placeholder="Ex: 1.2 MB"
        />
      </Field>
      <Field label="Date (affichée)">
        <Input
          value={props.date ?? ''}
          onChange={(e) => onChange({ date: e.target.value })}
          placeholder="Ex: Mis à jour le 15/03/2026"
        />
      </Field>
    </Group>
  ),
})
