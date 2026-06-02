'use client'

import React from 'react'
import { Boxes } from 'lucide-react'
import type { BlockProps } from '@/lib/page-builder/types'
import { Field, Group, Pills } from './controls'
import { getBlockDef } from '@/lib/page-builder/registry'
import { usePageBuilderStore } from '@/lib/page-builder/store'

function PropsHeader({ block }: { block: BlockProps }) {
  const def = getBlockDef(block.type)
  if (!def) return null
  return (
    <div className="px-4 py-3 border-b">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {def.meta.name}
      </div>
      <div className="text-[11px] text-muted-foreground/70">{def.meta.description}</div>
    </div>
  )
}

function VariantPicker({
  block,
  onPropChange,
}: {
  block: BlockProps
  onPropChange: (props: Record<string, unknown>) => void
}) {
  const def = getBlockDef(block.type)
  if (!def?.meta.variants || def.meta.variants.length === 0) return null
  const props = block.props as { variant?: string }
  return (
    <Group title="Style" defaultOpen>
      <Field label="Variante">
        <Pills
          value={props.variant ?? def.meta.variants[0].id}
          onChange={(v) => onPropChange({ variant: v })}
          options={def.meta.variants.map((v) => ({ value: v.id, label: v.name }))}
        />
      </Field>
    </Group>
  )
}

// ─────────────────────────────────────────────────────────────────────
//  Édition centrale d'un bloc global.
//  On n'édite PAS le `globalRef` lui-même : on édite le bloc RÉSOLU. Chaque
//  changement (a) met à jour la map du store en live (le canvas se met à jour
//  partout) et (b) PATCH débouncé l'API pour persister.
// ─────────────────────────────────────────────────────────────────────
function GlobalRefEditor({ block }: { block: BlockProps }) {
  const globalBlockId = (block.props as { globalBlockId?: string }).globalBlockId ?? ''
  const resolved = usePageBuilderStore((s) => s.globalBlocks[globalBlockId])
  const updateGlobalBlockProps = usePageBuilderStore((s) => s.updateGlobalBlockProps)

  // PATCH débouncé (~600ms). On garde la dernière version résolue dans une ref
  // pour envoyer le bloc complet { ...resolved, props: { ...resolved.props, ...partial } }.
  const resolvedRef = React.useRef(resolved)
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    resolvedRef.current = resolved
  }, [resolved])

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const handleChange = React.useCallback(
    (partial: Record<string, unknown>) => {
      // (a) mise à jour live de la map → résolution immédiate dans le canvas.
      updateGlobalBlockProps(globalBlockId, partial)
      // (b) PATCH débouncé.
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        const current = resolvedRef.current
        if (!current) return
        const merged = {
          ...current,
          props: { ...current.props, ...partial },
        }
        void fetch(`/api/page-builder/global-blocks/${globalBlockId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ block: merged }),
        }).catch(() => {
          /* persistance best-effort : la mise à jour live a déjà eu lieu */
        })
      }, 600)
    },
    [globalBlockId, updateGlobalBlockProps]
  )

  const banner = (
    <div className="flex items-start gap-2 border-b bg-primary/5 px-4 py-3 text-xs text-primary">
      <Boxes className="mt-0.5 size-4 shrink-0" />
      <span>
        <span className="font-medium">Bloc global</span> — les modifications
        s’appliquent partout où ce bloc est utilisé.
      </span>
    </div>
  )

  if (!resolved) {
    return (
      <div>
        {banner}
        <div className="px-4 py-6 text-sm text-muted-foreground">
          Bloc global introuvable. Il a peut-être été supprimé.
        </div>
      </div>
    )
  }

  const def = getBlockDef(resolved.type)
  if (!def) {
    return (
      <div>
        {banner}
        <div className="px-4 py-6 text-sm text-muted-foreground">
          Aucune définition de bloc trouvée pour <code>{resolved.type}</code>.
        </div>
      </div>
    )
  }

  const Fields = def.Fields as React.FC<{
    props: unknown
    onChange: (partial: Record<string, unknown>) => void
  }>

  return (
    <div>
      {banner}
      <PropsHeader block={resolved} />
      <VariantPicker block={resolved} onPropChange={handleChange} />
      <Fields props={resolved.props} onChange={handleChange} />
    </div>
  )
}

interface ContentTabProps {
  block: BlockProps
  onPropChange: (props: Record<string, unknown>) => void
}

export function ContentTab({ block, onPropChange }: ContentTabProps) {
  // Bloc global : on édite le bloc résolu (live + PATCH débouncé), pas le ref.
  if (block.type === 'globalRef') {
    return <GlobalRefEditor block={block} />
  }

  const def = getBlockDef(block.type)
  if (!def) {
    return (
      <div className="px-4 py-6 text-sm text-muted-foreground">
        Aucune définition de bloc trouvée pour <code>{block.type}</code>.
      </div>
    )
  }
  const Fields = def.Fields as React.FC<{
    props: unknown
    onChange: (partial: Record<string, unknown>) => void
  }>
  return (
    <div>
      <PropsHeader block={block} />
      <VariantPicker block={block} onPropChange={onPropChange} />
      <Fields props={block.props} onChange={onPropChange} />
    </div>
  )
}
