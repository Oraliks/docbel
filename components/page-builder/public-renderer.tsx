import React from 'react'
import type { BlockProps } from '@/lib/page-builder/types'
import { BlockRenderer } from './block-renderer'
import { childLayoutClass, type ChildLayout } from '@/components/page-blocks/layout/container-layout'
import type { InterpolationContext } from '@/lib/page-builder/interpolate'

interface PublicRendererProps {
  blocks: BlockProps[]
  /** Optional context — page metadata + site name + user — for {{...}} interpolation. */
  context?: InterpolationContext
}

function childrenOf(blocks: BlockProps[], parentId: string, slotIndex?: number) {
  return blocks.filter((b) => {
    if (b.parentId !== parentId) return false
    if (slotIndex == null) return true
    return (b.slotIndex ?? 0) === slotIndex
  })
}

function RenderBlock({
  block,
  allBlocks,
  context,
}: {
  block: BlockProps
  allBlocks: BlockProps[]
  context?: InterpolationContext
}) {
  if (block.type === 'section' || block.type === 'container') {
    const children = childrenOf(allBlocks, block.id)
    const layoutCls = childLayoutClass(block.props as ChildLayout)
    const rendered = children.map((c) => (
      <RenderBlock key={c.id} block={c} allBlocks={allBlocks} context={context} />
    ))
    return (
      <BlockRenderer
        block={block}
        interpolationContext={context}
        slot={
          children.length > 0 ? (
            layoutCls ? (
              <div className={layoutCls}>{rendered}</div>
            ) : (
              <>{rendered}</>
            )
          ) : null
        }
      />
    )
  }

  if (block.type === 'repeater') {
    const children = childrenOf(allBlocks, block.id)
    const rprops = block.props as {
      items?: Array<Record<string, string | number | boolean>>
      emptyText?: string
    }
    const items = Array.isArray(rprops.items) ? rprops.items : []
    const layoutCls = childLayoutClass(block.props as ChildLayout)
    const slot =
      items.length === 0 ? (
        rprops.emptyText ? (
          <p className="text-muted-foreground text-sm">{rprops.emptyText}</p>
        ) : null
      ) : (
        <div className={layoutCls || undefined}>
          {items.map((item, i) => (
            <div key={i}>
              {children.map((c) => (
                <RenderBlock
                  key={c.id}
                  block={c}
                  allBlocks={allBlocks}
                  context={{ ...context, item }}
                />
              ))}
            </div>
          ))}
        </div>
      )
    return <BlockRenderer block={block} interpolationContext={context} slot={slot} />
  }

  if (block.type === 'columns') {
    return (
      <BlockRenderer
        block={block}
        interpolationContext={context}
        slotByIndex={(idx) => {
          const children = childrenOf(allBlocks, block.id, idx)
          return children.length > 0 ? (
            <div className="space-y-4">
              {children.map((c) => (
                <RenderBlock key={c.id} block={c} allBlocks={allBlocks} context={context} />
              ))}
            </div>
          ) : null
        }}
      />
    )
  }

  return <BlockRenderer block={block} interpolationContext={context} />
}

export function PublicRenderer({ blocks, context }: PublicRendererProps) {
  if (!blocks || blocks.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-16">
        Cette page n’a pas encore de contenu.
      </div>
    )
  }
  const rootBlocks = blocks.filter((b) => !b.parentId)
  return (
    <div className="page-content">
      {rootBlocks.map((block) => (
        <RenderBlock key={block.id} block={block} allBlocks={blocks} context={context} />
      ))}
    </div>
  )
}
