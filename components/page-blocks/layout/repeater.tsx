'use client'

import React from 'react'
import { z } from 'zod'
import { toast } from 'sonner'
import { Sparkles } from 'lucide-react'
import { Field, Group } from '@/components/page-builder/inspector/controls'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { repeaterSchema as schema } from './schemas'
import { ChildLayoutFields } from './child-layout-fields'

type Props = z.infer<typeof schema>

/** JSON editor for the repeater rows. Keeps a local raw buffer so a half-typed
 *  document doesn't blow away `items`; only valid arrays are committed. */
function ItemsEditor({
  props,
  onChange,
}: {
  props: Props
  onChange: (patch: Partial<Props>) => void
}) {
  const items = Array.isArray(props.items) ? props.items : []
  const [raw, setRaw] = React.useState(() => JSON.stringify(items, null, 2))
  const [err, setErr] = React.useState<string | null>(null)

  const keys = Array.from(new Set(items.flatMap((it) => Object.keys(it || {}))))

  const apply = (text: string) => {
    setRaw(text)
    try {
      const parsed = JSON.parse(text)
      if (!Array.isArray(parsed)) throw new Error('Le JSON doit être un tableau [ … ]')
      onChange({ items: parsed as Props['items'] })
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'JSON invalide')
    }
  }

  // ── Génération IA des éléments (ancrée KB chômage) ───────────────────────
  const [topic, setTopic] = React.useState('')
  const [aiLoading, setAiLoading] = React.useState(false)

  const generate = async () => {
    if (aiLoading) return
    if (!topic.trim()) {
      toast.error('Indiquez un sujet')
      return
    }
    setAiLoading(true)
    try {
      const res = await fetch('/api/page-builder/ai-repeater', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          // Si des clés existent déjà, on demande à l'IA de les réutiliser
          // pour rester compatible avec le modèle du répéteur.
          ...(keys.length > 0 ? { keys } : {}),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (data.aiDisabled) {
        toast.error(data.error || 'Assistant IA non configuré')
        return
      }
      if (!res.ok || !Array.isArray(data.items) || data.items.length === 0) {
        toast.error(data.error || "Échec de la génération")
        return
      }
      const next = data.items as NonNullable<Props['items']>
      onChange({ items: next })
      setRaw(JSON.stringify(next, null, 2))
      setErr(null)
      toast.success(`${next.length} élément${next.length > 1 ? 's' : ''} généré${next.length > 1 ? 's' : ''}`)
    } catch {
      toast.error("Échec de l'appel IA")
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <Group title="Données" defaultOpen>
      <Field label="Éléments (JSON)" hint="Un objet par élément ; chaque clé devient un token">
        <textarea
          value={raw}
          onChange={(e) => apply(e.target.value)}
          spellCheck={false}
          rows={8}
          className="w-full rounded-md border bg-background px-2 py-1.5 font-mono text-xs leading-relaxed"
          placeholder='[{ "titre": "A", "desc": "…" }, { "titre": "B" }]'
        />
      </Field>
      {err && <p className="text-xs text-destructive">⚠ {err}</p>}
      {keys.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Dans les blocs du modèle :{' '}
          {keys.map((k) => (
            <code key={k} className="mr-1 rounded bg-muted px-1 py-0.5 font-mono">
              {`{{item.${k}}}`}
            </code>
          ))}
        </p>
      )}
      <Field
        label="Générer les éléments (IA)"
        hint={
          keys.length > 0
            ? 'Réutilise les clés actuelles, ancré dans la base chômage.'
            : 'Choisit des clés pertinentes, ancré dans la base chômage.'
        }
      >
        <div className="flex items-center gap-2">
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void generate()
              }
            }}
            disabled={aiLoading}
            placeholder="Sujet (ex. allocations de chômage)"
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => void generate()}
            disabled={aiLoading || !topic.trim()}
            className="shrink-0 gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {aiLoading ? '…' : 'Générer'}
          </Button>
        </div>
      </Field>
      <Field label="Texte si aucun élément">
        <Input
          value={props.emptyText ?? ''}
          onChange={(e) => onChange({ emptyText: e.target.value || undefined })}
          placeholder="(rien)"
        />
      </Field>
    </Group>
  )
}

export const repeater = defineBlock({
  type: 'repeater',
  schema,
  defaults: {
    items: [{ titre: 'Élément 1' }, { titre: 'Élément 2' }, { titre: 'Élément 3' }],
    layoutMode: 'grid',
    layoutCols: 3,
    layoutGap: 'md',
  },
  meta: {
    name: 'Répéteur',
    description: 'Répète un modèle de blocs pour chaque élément ({{item.champ}})',
    category: 'layout',
    icon: 'repeat',
    shortcuts: ['repeater', 'repeteur', 'liste', 'loop', 'boucle'],
    canHaveChildren: true,
  },
  // On the public page `slot` is the expanded grid (built by public-renderer);
  // in the editor it's the single editable template (built by block-wrapper).
  Render: ({ slot }) => <div className="w-full">{slot}</div>,
  Fields: ({ props, onChange }) => (
    <>
      <ItemsEditor props={props} onChange={onChange} />
      <ChildLayoutFields props={props} onChange={onChange} />
    </>
  ),
})
