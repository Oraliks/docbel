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

// Géométrie d'ombre sans couleur (pour ombre custom : couleur / intérieure).
const SHADOW_GEOM: Record<NonNullable<BlockStyle['shadow']>, string> = {
  none: 'none',
  sm: '0 1px 2px 0',
  md: '0 4px 12px 0',
  lg: '0 12px 32px 0',
  xl: '0 24px 60px 0',
}

function hexToRgba(hex: string, alpha: number): string {
  const m = hex.replace('#', '')
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return hex
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
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
  if (layout.gridColumnSpan) css.gridColumn = `span ${layout.gridColumnSpan}`
  if (layout.sticky) {
    css.position = 'sticky'
    css.top = `${layout.stickyOffset ?? 0}px`
    if (layout.zIndex === undefined) css.zIndex = 10
  }
  if (layout.absolute) {
    css.position = 'absolute'
    if (layout.left !== undefined) css.left = `${layout.left}px`
    if (layout.top !== undefined) css.top = `${layout.top}px`
  }
  if (layout.zIndex !== undefined) css.zIndex = layout.zIndex

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

  // Background — color (base) → gradient → image (image wins)
  if (style.bgColor) css.backgroundColor = style.bgColor
  if (style.bgImage) {
    const safeUrl = style.bgImage.replace(/["()\\]/g, '')
    const overlay =
      style.bgOverlay !== undefined
        ? hexToRgba(style.bgOverlay, style.bgOverlayOpacity ?? 0.4)
        : null
    css.backgroundImage = overlay
      ? `linear-gradient(${overlay}, ${overlay}), url("${safeUrl}")`
      : `url("${safeUrl}")`
    css.backgroundSize = style.bgImageSize ?? 'cover'
    css.backgroundPosition = style.bgImagePosition ?? 'center'
    css.backgroundRepeat = 'no-repeat'
  } else if (style.bgGradientFrom && style.bgGradientTo) {
    css.backgroundImage = `linear-gradient(${style.bgGradientAngle ?? 135}deg, ${style.bgGradientFrom}, ${style.bgGradientTo})`
  }

  // Border
  if (style.borderWidth !== undefined) css.borderWidth = `${style.borderWidth}px`
  if (style.borderColor) css.borderColor = style.borderColor
  if (style.borderStyle) css.borderStyle = style.borderStyle
  if (style.borderRadius !== undefined) css.borderRadius = `${style.borderRadius}px`
  if (style.borderGradientFrom && style.borderGradientTo) {
    if (css.borderStyle === undefined) css.borderStyle = 'solid'
    if (css.borderWidth === undefined) css.borderWidth = '2px'
    css.borderImage = `linear-gradient(${style.borderGradientAngle ?? 90}deg, ${style.borderGradientFrom}, ${style.borderGradientTo}) 1`
  }

  // Shadow (couleur custom / intérieure si définies, sinon le preset)
  if (style.shadow && style.shadow !== 'none') {
    if (style.shadowColor || style.shadowInset) {
      const color = style.shadowColor ? hexToRgba(style.shadowColor, 0.45) : 'rgba(0,0,0,.15)'
      css.boxShadow = `${style.shadowInset ? 'inset ' : ''}${SHADOW_GEOM[style.shadow]} ${color}`
    } else {
      css.boxShadow = SHADOW_MAP[style.shadow]
    }
  }

  // Opacity
  if (style.opacity !== undefined) css.opacity = style.opacity

  // Advanced visual effects
  if (style.clipPath) css.clipPath = style.clipPath
  if (style.mixBlendMode && style.mixBlendMode !== 'normal') {
    css.mixBlendMode = style.mixBlendMode
  }
  if (style.backdropBlur) {
    css.backdropFilter = `blur(${style.backdropBlur}px)`
    Object.assign(css, { WebkitBackdropFilter: `blur(${style.backdropBlur}px)` })
  }

  // Text effects (applied last so they take precedence over background)
  if (style.textEffect === 'gradient') {
    const from = style.bgGradientFrom || '#7C3AED'
    const to = style.bgGradientTo || '#EC4899'
    css.backgroundImage = `linear-gradient(${style.bgGradientAngle ?? 90}deg, ${from}, ${to})`
    css.color = 'transparent'
    Object.assign(css, {
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
    })
  } else if (style.textEffect === 'shadow') {
    css.textShadow = '0 2px 8px rgba(0,0,0,0.25)'
  } else if (style.textEffect === 'glow') {
    css.textShadow = '0 0 14px rgba(124,58,237,0.6)'
  } else if (style.textEffect === 'outline') {
    css.color = 'transparent'
    Object.assign(css, { WebkitTextStroke: `1px ${style.textColor || '#111827'}` })
  }

  return css
}

function sanitizeCustomCss(css: string): string {
  return css
    .replace(/<\/?\s*style/gi, '')
    .replace(/@import[^;]*;?/gi, '')
    .replace(/expression\s*\(/gi, '(')
    .replace(/javascript:/gi, '')
    .slice(0, 4000)
}

/**
 * CSS scopé à un seul bloc via [data-pb-id="..."] : états au survol (hoverState)
 * + CSS personnalisé (`.self` → sélecteur du bloc). Renvoie le contenu d'un
 * <style> ou null. Émis par block-renderer à côté du bloc.
 */
export function blockScopedCss(
  block: BlockProps,
  device: DeviceType = 'desktop'
): string | null {
  const { style } = mergeForDevice(block, device)
  const sel = `[data-pb-id="${block.id}"]`
  const rules: string[] = []

  const h = style.hoverState
  if (h) {
    const decls: string[] = []
    if (h.textColor) decls.push(`color:${h.textColor}`)
    if (h.bgColor) decls.push(`background-color:${h.bgColor}`)
    if (h.borderColor) decls.push(`border-color:${h.borderColor}`)
    if (h.opacity !== undefined) decls.push(`opacity:${h.opacity}`)
    if (h.shadow && h.shadow !== 'none') decls.push(`box-shadow:${SHADOW_MAP[h.shadow]}`)
    const tf: string[] = []
    if (h.scale !== undefined) tf.push(`scale(${h.scale})`)
    if (h.lift) tf.push(`translateY(-${h.lift}px)`)
    if (tf.length) decls.push(`transform:${tf.join(' ')}`)
    if (decls.length) {
      rules.push(`${sel}{transition:all .25s ease}`)
      rules.push(`${sel}:hover{${decls.join(';')}}`)
    }
  }

  if (block.advanced?.customCss) {
    const safe = sanitizeCustomCss(block.advanced.customCss)
    if (safe.trim()) rules.push(safe.replace(/\.self\b/g, sel))
  }

  return rules.length ? rules.join('\n') : null
}

const ANIMATION_CLASS: Record<NonNullable<BlockAdvanced['animation']>, string> = {
  none: '',
  'fade-in': 'animate-in fade-in duration-700',
  'fade-up': 'animate-in fade-in slide-in-from-bottom-4 duration-700',
  'fade-down': 'animate-in fade-in slide-in-from-top-4 duration-700',
  'slide-left': 'animate-in slide-in-from-right-8 fade-in duration-700',
  'slide-right': 'animate-in slide-in-from-left-8 fade-in duration-700',
  'zoom-in': 'animate-in zoom-in-95 fade-in duration-500',
  'zoom-out': 'animate-in zoom-in-125 fade-in duration-500',
  pulse: 'animate-pulse',
  bounce: 'animate-bounce',
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
