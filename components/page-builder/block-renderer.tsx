'use client'

import React from 'react'
import type {
  AudienceCondition,
  BlockAdvanced,
  BlockInteractionState,
  BlockProps,
  DeviceType,
} from '@/lib/page-builder/types'
import {
  blockToCSS,
  blockToClassName,
  blockAttrs,
  blockScopedCss,
  ANIMATION_CLASS,
} from '@/lib/page-builder/block-styles'
import { interpolateBlock, type InterpolationContext } from '@/lib/page-builder/interpolate'
import { getBlockDef } from '@/lib/page-builder/registry'
import { useGlobalBlocks } from './global-blocks-context'
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
  /** In the editor, the wrapper handles absolute positioning → strip it from self. */
  skipSelfPosition?: boolean
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

/** Box-shadow presets — mirror of SHADOW_MAP in block-styles.ts (kept local to avoid a new export). */
const IN_VIEW_SHADOW: Record<NonNullable<BlockInteractionState['shadow']>, string> = {
  none: 'none',
  sm: '0 1px 2px rgba(0,0,0,.06)',
  md: '0 4px 12px rgba(0,0,0,.08)',
  lg: '0 12px 32px rgba(0,0,0,.12)',
  xl: '0 24px 60px rgba(0,0,0,.18)',
}

/**
 * Converts an interaction state into inline CSS — same mapping as the hoverState
 * conversion in block-styles.ts `blockScopedCss` (textColor→color, bgColor→
 * backgroundColor, borderColor, opacity, shadow→boxShadow, scale/lift→transform).
 * Used for `inViewState`, applied once the block enters the viewport.
 */
function interactionStateToCSS(state: BlockInteractionState): React.CSSProperties {
  const out: React.CSSProperties = {}
  if (state.textColor) out.color = state.textColor
  if (state.bgColor) out.backgroundColor = state.bgColor
  if (state.borderColor) out.borderColor = state.borderColor
  if (state.opacity !== undefined) out.opacity = state.opacity
  if (state.shadow && state.shadow !== 'none') out.boxShadow = IN_VIEW_SHADOW[state.shadow]
  const tf: string[] = []
  if (state.scale !== undefined) tf.push(`scale(${state.scale})`)
  if (state.lift) tf.push(`translateY(-${state.lift}px)`)
  if (tf.length) out.transform = tf.join(' ')
  return out
}

/** Listens for `beldoc:toggle-block` events matching this block's htmlId → flips visibility. */
function useToggleVisibility(htmlId?: string): boolean {
  const [hidden, setHidden] = React.useState(false)
  React.useEffect(() => {
    if (!htmlId) return
    const handler = (e: Event) => {
      if ((e as CustomEvent<{ id?: string }>).detail?.id === htmlId) {
        setHidden((v) => !v)
      }
    }
    window.addEventListener('beldoc:toggle-block', handler as EventListener)
    return () => window.removeEventListener('beldoc:toggle-block', handler as EventListener)
  }, [htmlId])
  return hidden
}

/** Hides a block outside its scheduled window (evaluated client-side after mount). */
function useScheduledHidden(start?: string, end?: string): boolean {
  const [hidden, setHidden] = React.useState(false)
  React.useEffect(() => {
    if (!start && !end) return
    const now = Date.now()
    const off = (!!start && now < Date.parse(start)) || (!!end && now > Date.parse(end))
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHidden(off)
  }, [start, end])
  return hidden
}

/** Evaluates one audience condition against the current request (browser-side). */
function evalAudienceCondition(
  c: AudienceCondition,
  params: URLSearchParams,
  lang: string
): boolean {
  if (c.type === 'param') {
    const v = params.get(c.key ?? '')
    switch (c.op) {
      case 'exists':
        return v !== null
      case 'eq':
        return v === (c.value ?? '')
      case 'neq':
        return v !== (c.value ?? '')
      case 'contains':
        return v !== null && v.includes(c.value ?? '')
      default:
        return true
    }
  }
  // type === 'lang' — match the start of the browser language (e.g. "fr" ⊃ "fr-BE").
  const l = lang.toLowerCase()
  const val = (c.value ?? '').toLowerCase()
  switch (c.op) {
    case 'eq':
      return l.startsWith(val)
    case 'neq':
      return !l.startsWith(val)
    case 'contains':
      return l.includes(val)
    case 'exists':
      return l.length > 0
    default:
      return true
  }
}

/** Hides a block when its audience conditions aren't all met (client-side after mount). */
function useAudienceHidden(conditions?: AudienceCondition[]): boolean {
  const [hidden, setHidden] = React.useState(false)
  React.useEffect(() => {
    if (!conditions || conditions.length === 0) return
    const params = new URLSearchParams(window.location.search)
    const lang = navigator.language || ''
    const fail = conditions.some((c) => !evalAudienceCondition(c, params, lang))
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHidden(fail)
  }, [conditions])
  return hidden
}

/** Translates a block on scroll for a parallax effect (rAF-throttled, client-side). */
function useParallax(
  ref: React.RefObject<HTMLDivElement | null>,
  enabled: boolean,
  intensity: number
) {
  React.useEffect(() => {
    if (!enabled) return
    const el = ref.current
    if (!el) return
    let raf = 0
    const update = () => {
      raf = 0
      const rect = el.getBoundingClientRect()
      const vh = window.innerHeight || 1
      // progress ≈ -0.5 (entering bottom) → +0.5 (leaving top), 0 at center.
      const progress = (rect.top + rect.height / 2 - vh / 2) / vh
      el.style.transform = `translate3d(0, ${(-progress * intensity).toFixed(1)}px, 0)`
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [ref, enabled, intensity])
}

/** Replays the block's entrance animation when a matching beldoc:animate fires. */
function useAnimateOnCommand(
  ref: React.RefObject<HTMLDivElement | null>,
  htmlId?: string,
  animation?: BlockAdvanced['animation']
) {
  React.useEffect(() => {
    if (!htmlId || !animation || animation === 'none') return
    const handler = (e: Event) => {
      if ((e as CustomEvent<{ id?: string }>).detail?.id !== htmlId) return
      const el = ref.current
      if (!el) return
      const classes = ANIMATION_CLASS[animation].split(' ').filter(Boolean)
      if (!classes.length) return
      el.classList.remove(...classes)
      void el.offsetWidth // force reflow → restart the CSS animation
      el.classList.add(...classes)
    }
    window.addEventListener('beldoc:animate', handler as EventListener)
    return () => window.removeEventListener('beldoc:animate', handler as EventListener)
  }, [ref, htmlId, animation])
}

export function BlockRenderer(props: BlockRendererProps) {
  // `globalRef` blocks are live references — resolve their target from context
  // and render that instead. One unconditional hook here keeps hook order stable.
  const globalBlocks = useGlobalBlocks()
  if (props.block.type === 'globalRef') {
    const refProps = props.block.props as {
      globalBlockId?: string
      overrides?: Record<string, unknown>
    }
    const id = refProps.globalBlockId
    const resolved = id ? globalBlocks[id] : undefined
    if (resolved && resolved.type !== 'globalRef') {
      const ov = refProps.overrides
      const target =
        ov && Object.keys(ov).length > 0
          ? ({ ...resolved, props: { ...resolved.props, ...ov } } as BlockProps)
          : resolved
      return <RegularBlockRenderer {...props} block={target} />
    }
    if (!props.editorMode) return null
    return (
      <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        {resolved
          ? 'Bloc global imbriqué non supporté.'
          : 'Bloc global introuvable ou non sélectionné.'}
      </div>
    )
  }
  return <RegularBlockRenderer {...props} />
}

function RegularBlockRenderer({
  block,
  device = 'desktop',
  slot,
  slotByIndex,
  editorMode = false,
  loggedIn = false,
  interpolationContext,
  skipSelfPosition = false,
}: BlockRendererProps) {
  const resolvedBlock = React.useMemo(() => {
    if (!interpolationContext) return block
    return interpolateBlock(block, interpolationContext)
  }, [block, interpolationContext])
  const css = blockToCSS(resolvedBlock, device)
  if (skipSelfPosition) {
    const c = css as Record<string, unknown>
    delete c.position
    delete c.left
    delete c.top
  }
  const className = blockToClassName(resolvedBlock)
  const attrs = blockAttrs(resolvedBlock)
  const scoped = blockScopedCss(resolvedBlock, device)
  const animOnScroll = !!resolvedBlock.advanced?.animateOnScroll
  const inViewState = resolvedBlock.style?.inViewState
  const hasInView = !!inViewState && Object.keys(inViewState).length > 0
  const { ref, visible } = useEnterViewport((animOnScroll || hasInView) && !editorMode)
  const toggledOff = useToggleVisibility(resolvedBlock.advanced?.htmlId)
  const scheduledOff = useScheduledHidden(
    resolvedBlock.advanced?.scheduleStart,
    resolvedBlock.advanced?.scheduleEnd
  )
  const audienceOff = useAudienceHidden(resolvedBlock.advanced?.conditions)
  const parallaxIntensity = resolvedBlock.advanced?.parallax ?? 0
  useParallax(ref, !editorMode && parallaxIntensity !== 0, parallaxIntensity)
  useAnimateOnCommand(
    ref,
    !editorMode ? resolvedBlock.advanced?.htmlId : undefined,
    resolvedBlock.advanced?.animation
  )

  if (!editorMode) {
    if (resolvedBlock.meta?.hidden) return null
    if (toggledOff || scheduledOff || audienceOff) return null
    const cond = resolvedBlock.advanced?.showIf
    if (cond === 'loggedIn' && !loggedIn) return null
    if (cond === 'loggedOut' && loggedIn) return null
  }

  return (
    <>
    {scoped && <style dangerouslySetInnerHTML={{ __html: scoped }} />}
    <div
      ref={ref}
      data-pb-id={resolvedBlock.id}
      className={cn(
        'block-renderer',
        className,
        animOnScroll && !visible && 'opacity-0',
        animOnScroll && visible && 'opacity-100'
      )}
      style={{
        ...css,
        // Once the block enters the viewport, layer its in-view styles over the base
        // ones (override). Before entry → base styles only, so the change animates.
        ...(hasInView && visible ? interactionStateToCSS(inViewState!) : null),
        animationDelay:
          resolvedBlock.advanced?.animationDelay !== undefined
            ? `${resolvedBlock.advanced.animationDelay}ms`
            : undefined,
        transition: hasInView
          ? 'all .6s ease'
          : animOnScroll
            ? 'opacity 0.7s ease-out'
            : undefined,
      }}
      {...attrs}
    >
      <BlockBoundary type={resolvedBlock.type}>
        <BlockContent block={resolvedBlock} slot={slot} slotByIndex={slotByIndex} />
      </BlockBoundary>
    </div>
    </>
  )
}
