'use client'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, Group } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'
import { diffViewerSchema as schema } from './schemas'

export const diffViewer = defineBlock({
  type: 'diffViewer',
  schema,
  defaults: {
    before: 'Ancienne version\nLigne 2 inchangée',
    after: 'Nouvelle version\nLigne 2 inchangée',
    language: 'text',
  },
  meta: {
    name: 'Diff',
    description: 'Comparaison avant / après',
    category: 'text',
    icon: 'columns-3',
    shortcuts: ['diff'],
  },
  Render: ({ props }) => {
    const { before, after, language, filename } = props
    const beforeLines = before.split('\n')
    const afterLines = after.split('\n')
    const result: { type: 'add' | 'del' | 'eq'; text: string }[] = []
    const max = Math.max(beforeLines.length, afterLines.length)
    for (let i = 0; i < max; i++) {
      const b = beforeLines[i]
      const a = afterLines[i]
      if (b === a) {
        result.push({ type: 'eq', text: a ?? '' })
      } else {
        if (b !== undefined) result.push({ type: 'del', text: b })
        if (a !== undefined) result.push({ type: 'add', text: a })
      }
    }
    return (
      <div className="rounded-lg border bg-zinc-950 text-zinc-200 my-2 overflow-hidden">
        {(filename || language) && (
          <div className="border-b border-zinc-800 px-3 py-2 text-xs flex items-center gap-2">
            {filename && <span className="font-mono">{filename}</span>}
            {language && <span className="text-zinc-500">{language}</span>}
          </div>
        )}
        <pre className="overflow-x-auto p-3 text-sm font-mono leading-relaxed">
          {result.map((line, i) => (
            <div
              key={i}
              className={cn(
                'block',
                line.type === 'add' && 'bg-emerald-500/15 text-emerald-300',
                line.type === 'del' && 'bg-red-500/15 text-red-300'
              )}
            >
              <span className="select-none w-4 inline-block">
                {line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '}
              </span>
              {line.text || ' '}
            </div>
          ))}
        </pre>
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Nom de fichier">
        <Input
          value={props.filename ?? ''}
          onChange={(e) => onChange({ filename: e.target.value })}
        />
      </Field>
      <Field label="Langage">
        <Input
          value={props.language ?? ''}
          onChange={(e) => onChange({ language: e.target.value })}
        />
      </Field>
      <Field label="Avant">
        <Textarea
          value={props.before}
          onChange={(e) => onChange({ before: e.target.value })}
          rows={5}
          className="font-mono text-xs resize-y"
        />
      </Field>
      <Field label="Après">
        <Textarea
          value={props.after}
          onChange={(e) => onChange({ after: e.target.value })}
          rows={5}
          className="font-mono text-xs resize-y"
        />
      </Field>
    </Group>
  ),
})
