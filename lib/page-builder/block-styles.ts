// =====================================================================
//  Helpers that turn BlockStyle / BlockLayout / Advanced into runtime
//  CSS / className strings, taking the active device into account for
//  responsive overrides.
// =====================================================================

import type {
  BlockProps,
  BlockStyle,
  BlockLayout,
  BlockAdvanced,
  DeviceType,
} from './types'

const SHADOW_MAP: Record<NonNullable<BlockStyle['shadow']>, string> = {
  none: 'none',
  sm: '0 1px 2px rgba(0,0,0,.06)',
  md: '0 4px 12px rgba(0,0,0,.08)',
  lg: '0 12px 32px rgba(0,0,0,.12)',
  xl: '0 24px 60px rgba(0,0,0,.18)',
}

export function mergeForDevice(block: BlockProps, device: DeviceType) {
  const style: BlockStyle = { ...(block.style ?? {}) }
  const layout: BlockLayout = { ...(block.layout ?? {}) }

  if (device === 'tablet' && block.responsive?.tablet) {
    Object.assign(style, block.responsive.tablet.style ?? {})
    Object.assign(layout, block.responsive.tablet.layout ?? {})
  }
  if (device === 'mobile' && block.responsive?.mobile) {
    Object.assign(style, block.responsive.mobile.style ?? {})
    Object.assign(layout, block.responsive.mobile.layout ?? {})
  }

  return { style, layout }
}

export function blockToCSS(
  block: BlockProps,
  device: DeviceType = 'desktop'
): React.CSSProperties {
  const { style, layout } = mergeForDevice(block, device)
  const css: React.CSSProperties = {}

  // Visibility
  if (
    (device === 'desktop' && layout.hideOnDesktop) ||
    (device === 'tablet' && layout.hideOnTablet) ||
    (device === 'mobile' && layout.hideOnMobile)
  ) {
    css.display = 'none'
  }

  // Sizing
  if (layout.width) css.width = layout.width
  if (layout.maxWidth) css.maxWidth = layout.maxWidth
  if (layout.height) css.height = layout.height
  if (layout.minHeight) css.minHeight = layout.minHeight

  // Padding
  const ptop = layout.paddingTop
  const pright = layout.paddingRight
  const pbottom = layout.paddingBottom
  const pleft = layout.paddingLeft
  if (ptop !== undefined) css.paddingTop = `${ptop}px`
  if (pright !== undefined) css.paddingRight = `${pright}px`
  if (pbottom !== undefined) css.paddingBottom = `${pbottom}px`
  if (pleft !== undefined) css.paddingLeft = `${pleft}px`

  // Margin
  if (layout.marginTop !== undefined) css.marginTop = `${layout.marginTop}px`
  if (layout.marginRight !== undefined) css.marginRight = `${layout.marginRight}px`
  if (layout.marginBottom !== undefined) css.marginBottom = `${layout.marginBottom}px`
  if (layout.marginLeft !== undefined) css.marginLeft = `${layout.marginLeft}px`

  // Alignment of self
  if (layout.align === 'center') css.marginInline = 'auto'
  if (layout.align === 'right') css.marginLeft = 'auto'

  // Typography
  if (style.fontFamily) css.fontFamily = style.fontFamily
  if (style.fontSize !== undefined) css.fontSize = `${style.fontSize}px`
  if (style.fontWeight !== undefined) css.fontWeight = style.fontWeight
  if (style.lineHeight !== undefined) css.lineHeight = style.lineHeight
  if (style.letterSpacing !== undefined) css.letterSpacing = `${style.letterSpacing}px`
  if (style.textAlign) css.textAlign = style.textAlign
  if (style.textColor) css.color = style.textColor

  // Background
  if (style.bgColor) css.backgroundColor = style.bgColor

  // Border
  if (style.borderWidth !== undefined) css.borderWidth = `${style.borderWidth}px`
  if (style.borderColor) css.borderColor = style.borderColor
  if (style.borderStyle) css.borderStyle = style.borderStyle
  if (style.borderRadius !== undefined) css.borderRadius = `${style.borderRadius}px`

  // Shadow
  if (style.shadow && style.shadow !== 'none') css.boxShadow = SHADOW_MAP[style.shadow]

  // Opacity
  if (style.opacity !== undefined) css.opacity = style.opacity

  return css
}

const ANIMATION_CLASS: Record<NonNullable<BlockAdvanced['animation']>, string> = {
  none: '',
  'fade-in': 'animate-in fade-in duration-700',
  'fade-up': 'animate-in fade-in slide-in-from-bottom-4 duration-700',
  'fade-down': 'animate-in fade-in slide-in-from-top-4 duration-700',
  'slide-left': 'animate-in slide-in-from-right-8 fade-in duration-700',
  'slide-right': 'animate-in slide-in-from-left-8 fade-in duration-700',
  'zoom-in': 'animate-in zoom-in-95 fade-in duration-500',
}

export function blockToClassName(block: BlockProps): string {
  const parts: string[] = []
  if (block.advanced?.className) parts.push(block.advanced.className)
  if (block.advanced?.animation && block.advanced.animation !== 'none') {
    parts.push(ANIMATION_CLASS[block.advanced.animation])
  }
  return parts.join(' ').trim()
}

export function blockAttrs(block: BlockProps): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {}
  if (block.advanced?.htmlId) out.id = block.advanced.htmlId
  if (block.advanced?.anchor) out['data-anchor'] = block.advanced.anchor
  return out
}
