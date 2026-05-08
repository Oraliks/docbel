'use client'

import React from 'react'
import type { BlockProps, DeviceType } from '@/lib/page-builder/types'
import {
  blockToCSS,
  blockToClassName,
  blockAttrs,
} from '@/lib/page-builder/block-styles'
import { interpolateBlock, type InterpolationContext } from '@/lib/page-builder/interpolate'
import { getBlockDef } from '@/lib/page-builder/registry'
import { cn } from '@/lib/utils'

interface BlockRendererProps {
  block: BlockProps
  device?: DeviceType
  /** Children for `section` and `container`. */
  slot?: React.ReactNode
  /** For `columns`: returns children for a given column index. */
  slotByIndex?: (idx: number) => React.ReactNode
  /** When true (in editor), conditional rendering / hidden flag are ignored so the user can still edit. */
  editorMode?: boolean
  /** Active session info, for conditional rendering on the public side. */
  loggedIn?: boolean
  /** Variable interpolation context — `{{page.title}}`, `{{today}}`, etc. */
  interpolationContext?: InterpolationContext
}

function BlockContent({
  block,
  slot,
  slotByIndex,
}: {
  block: BlockProps
  slot?: React.ReactNode
  slotByIndex?: (idx: number) => React.ReactNode
}) {
  const def = getBlockDef(block.type)
  if (!def) return null
  const Render = def.Render as React.FC<{
    props: unknown
    slot?: React.ReactNode
    slotByIndex?: (idx: number) => React.ReactNode
  }>
  return <Render props={block.props} slot={slot} slotByIndex={slotByIndex} />
}

class BlockBoundary extends React.Component<
  { children: React.ReactNode; type: string },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode; type: string }) {
    super(props)
    this.state = { hasError: false, message: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Erreur de rendu ({this.props.type}): {this.state.message}
        </div>
      )
    }
    return this.props.children
  }
}

/** Hook that returns true once the element has scrolled into view. */
function useEnterViewport(enabled: boolean) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [seen, setSeen] = React.useState(false)
  React.useEffect(() => {
    if (!enabled || seen) return
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setSeen(true)
      return
    }
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true)
          obs.disconnect()
        }
      },
      { threshold: 0.15 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [enabled, seen])
  return { ref, visible: !enabled || seen }
}

export function BlockRenderer({
  block,
  device = 'desktop',
  slot,
  slotByIndex,
  editorMode = false,
  loggedIn = false,
  interpolationContext,
}: BlockRendererProps) {
  const resolvedBlock = React.useMemo(() => {
    if (!interpolationContext) return block
    return interpolateBlock(block, interpolationContext)
  }, [block, interpolationContext])
  const css = blockToCSS(resolvedBlock, device)
  const className = blockToClassName(resolvedBlock)
  const attrs = blockAttrs(resolvedBlock)
  const animOnScroll = !!resolvedBlock.advanced?.animateOnScroll
  const { ref, visible } = useEnterViewport(animOnScroll && !editorMode)

  if (!editorMode) {
    if (resolvedBlock.meta?.hidden) return null
    const cond = resolvedBlock.advanced?.showIf
    if (cond === 'loggedIn' && !loggedIn) return null
    if (cond === 'loggedOut' && loggedIn) return null
  }

  return (
    <div
      ref={ref}
      className={cn(
        'block-renderer',
        className,
        animOnScroll && !visible && 'opacity-0',
        animOnScroll && visible && 'opacity-100'
      )}
      style={{
        ...css,
        animationDelay:
          resolvedBlock.advanced?.animationDelay !== undefined
            ? `${resolvedBlock.advanced.animationDelay}ms`
            : undefined,
        transition: animOnScroll ? 'opacity 0.7s ease-out' : undefined,
      }}
      {...attrs}
    >
      <BlockBoundary type={resolvedBlock.type}>
        <BlockContent block={resolvedBlock} slot={slot} slotByIndex={slotByIndex} />
      </BlockBoundary>
    </div>
  )
}
