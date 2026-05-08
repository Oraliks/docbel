'use client'

import React from 'react'
import type { BlockProps } from '@/lib/page-builder/types'
import { Field, Group, Pills } from './controls'
import { getBlockDef } from '@/lib/page-builder/registry'

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

interface ContentTabProps {
  block: BlockProps
  onPropChange: (props: Record<string, unknown>) => void
}

export function ContentTab({ block, onPropChange }: ContentTabProps) {
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
