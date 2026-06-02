'use client'

import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Field, Group } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { codeBlockSchema as schema } from './schemas'

export const codeBlock = defineBlock({
  type: 'codeBlock',
  schema,
  defaults: {
    code: '// Votre code ici\nconsole.log("Hello world")',
    language: 'javascript',
    filename: '',
    showLineNumbers: true,
  },
  meta: {
    name: 'Code',
    description: 'Bloc de code formaté',
    category: 'text',
    icon: 'code',
    shortcuts: ['code', 'pre'],
  },
  Render: ({ props }) => {
    const { code, language, filename, showLineNumbers } = props
    const lines = code.split('\n')
    const handleCopy = () => {
      navigator.clipboard?.writeText(code).then(
        () => toast.success('Code copié'),
        () => toast.error('Erreur copie')
      )
    }
    return (
      <div className="rounded-lg overflow-hidden border bg-zinc-950 text-zinc-200 my-2">
        {(filename || language) && (
          <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-zinc-900/50 text-xs">
            <div className="flex items-center gap-2">
              {filename && <span className="font-mono text-zinc-300">{filename}</span>}
              {language && <span className="text-zinc-500">{language}</span>}
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="rounded px-2 py-1 hover:bg-zinc-800 transition flex items-center gap-1.5"
            >
              <Copy className="size-3" />
              Copier
            </button>
          </div>
        )}
        <pre className="overflow-x-auto p-4 text-sm leading-relaxed">
          <code className="font-mono">
            {lines.map((line, i) => (
              <div key={i} className="flex">
                {showLineNumbers && (
                  <span className="select-none pr-4 text-zinc-600 text-right w-8 shrink-0">
                    {i + 1}
                  </span>
                )}
                <span className="flex-1">{line || ' '}</span>
              </div>
            ))}
          </code>
        </pre>
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Code">
        <Textarea
          value={props.code}
          onChange={(e) => onChange({ code: e.target.value })}
          rows={10}
          className="font-mono text-xs resize-y"
        />
      </Field>
      <Field label="Langage">
        <Input
          value={props.language ?? ''}
          onChange={(e) => onChange({ language: e.target.value })}
          placeholder="javascript, python, typescript…"
        />
      </Field>
      <Field label="Nom de fichier (optionnel)">
        <Input
          value={props.filename ?? ''}
          onChange={(e) => onChange({ filename: e.target.value })}
        />
      </Field>
      <div className="flex items-center justify-between gap-4 py-1">
        <Field label="Numéros de ligne" className="flex-1">
          <span className="sr-only">Line numbers</span>
        </Field>
        <Switch
          checked={props.showLineNumbers ?? true}
          onCheckedChange={(v) => onChange({ showLineNumbers: v })}
        />
      </div>
    </Group>
  ),
})
