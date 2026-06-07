// =====================================================================
//  Page Builder — Type System
// =====================================================================
//  Each block carries 4 layers of properties:
//   • props      → block-specific content (title, link, image, items…)
//   • style      → visual design (typography, color, background, border, shadow)
//   • layout     → boxing (padding, margin, alignment, sizing, visibility)
//   • advanced   → id, classes, anchor, animation
//   • responsive → optional overrides for tablet/mobile
// =====================================================================

import type { BlockType, BlockPropsMap } from './registry'
export type { BlockType, BlockPropsMap }

export type BlockCategory = 'text' | 'media' | 'layout' | 'marketing' | 'ui' | 'charts' | 'engagement' | 'navigation' | 'editorial' | 'docbel' | 'utility' | 'decorative' | 'education'

export type DeviceType = 'desktop' | 'tablet' | 'mobile'

// ──────────────────────────── Style / Layout / Advanced ────────────────────────────

export interface BlockStyle {
  // Typography
  fontFamily?: string
  fontSize?: number // px
  fontWeight?: 300 | 400 | 500 | 600 | 700 | 800
  lineHeight?: number
  letterSpacing?: number
  textAlign?: 'left' | 'center' | 'right' | 'justify'
  textColor?: string
  // Background
  bgColor?: string
  bgGradientFrom?: string
  bgGradientTo?: string
  bgGradientAngle?: number // deg
  bgImage?: string // url
  bgImageSize?: 'cover' | 'contain' | 'auto'
  bgImagePosition?: 'center' | 'top' | 'bottom' | 'left' | 'right'
  bgOverlay?: string // hex overlay composited over the image
  bgOverlayOpacity?: number // 0–1
  // Border
  borderWidth?: number
  borderColor?: string
  borderStyle?: 'solid' | 'dashed' | 'dotted'
  borderRadius?: number
  // Shadow
  shadow?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
  // Effects
  opacity?: number
  textEffect?: 'none' | 'gradient' | 'shadow' | 'glow' | 'outline'
  /** Styles appliqués au survol (rendus via un <style> scopé [data-pb-id]). */
  hoverState?: {
    textColor?: string
    bgColor?: string
    borderColor?: string
    opacity?: number
    scale?: number
    lift?: number
    shadow?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
  }
  // Border gradient + advanced visual effects
  borderGradientFrom?: string
  borderGradientTo?: string
  borderGradientAngle?: number
  shadowColor?: string
  shadowInset?: boolean
  clipPath?: string
  mixBlendMode?:
    | 'normal'
    | 'multiply'
    | 'screen'
    | 'overlay'
    | 'darken'
    | 'lighten'
    | 'color-dodge'
    | 'soft-light'
    | 'difference'
    | 'luminosity'
  backdropBlur?: number
}

export interface BlockLayout {
  // Sizing
  width?: string // any CSS value: 'auto', '100%', '320px'
  maxWidth?: string
  height?: string
  minHeight?: string
  /** When this block is a child of a grid container: how many columns it spans. */
  gridColumnSpan?: number
  // Position
  sticky?: boolean
  stickyOffset?: number
  zIndex?: number
  /** Free positioning inside a `freeLayout` container (px from the container's top-left). */
  absolute?: boolean
  left?: number
  top?: number
  // Spacing (px). undefined = inherit / default
  paddingTop?: number
  paddingRight?: number
  paddingBottom?: number
  paddingLeft?: number
  marginTop?: number
  marginRight?: number
  marginBottom?: number
  marginLeft?: number
  // Alignment of the block within its parent
  align?: 'left' | 'center' | 'right' | 'stretch'
  // Visibility per device
  hideOnDesktop?: boolean
  hideOnTablet?: boolean
  hideOnMobile?: boolean
}

export interface AudienceCondition {
  /** What to test: a URL query param, or the visitor's browser language. */
  type: 'param' | 'lang'
  /** Param name (only for type 'param'). */
  key?: string
  op: 'eq' | 'neq' | 'contains' | 'exists'
  value?: string
}

export interface BlockAdvanced {
  htmlId?: string
  className?: string
  anchor?: string // for in-page anchor links
  animation?:
    | 'none'
    | 'fade-in'
    | 'fade-up'
    | 'fade-down'
    | 'slide-left'
    | 'slide-right'
    | 'zoom-in'
    | 'zoom-out'
    | 'pulse'
    | 'bounce'
  animationDelay?: number // ms
  /** Trigger animation when entering viewport (IntersectionObserver) instead of on mount. */
  animateOnScroll?: boolean
  /** Conditional rendering. */
  showIf?: 'always' | 'loggedIn' | 'loggedOut'
  /** Audience conditions (ALL must pass) — evaluated client-side after mount. */
  conditions?: AudienceCondition[]
  /** CSS libre scopé à ce bloc — `.self` est réécrit en [data-pb-id="..."]. */
  customCss?: string
  /** Planification d'affichage (public uniquement) — datetime-local. */
  scheduleStart?: string
  scheduleEnd?: string
}

/** Editor-only flags. Saved with the block but ignored by the public renderer's logic. */
export interface BlockMeta {
  locked?: boolean
  hidden?: boolean
}

export type ResponsiveOverride = {
  style?: Partial<BlockStyle>
  layout?: Partial<BlockLayout>
}

export type Block<T extends BlockType = BlockType> = {
  [K in BlockType]: {
    id: string
    type: K
    props: BlockPropsMap[K]
    style?: BlockStyle
    layout?: BlockLayout
    advanced?: BlockAdvanced
    meta?: BlockMeta
    responsive?: {
      tablet?: ResponsiveOverride
      mobile?: ResponsiveOverride
    }
    parentId?: string | null // null/undefined = top-level
    /** Slot index inside the parent. Only meaningful for `columns` parents (0..N-1). */
    slotIndex?: number
  }
}[T]

export type BlockProps = Block

// ──────────────────────────── Page ────────────────────────────

export interface PageData {
  id: string
  title: string
  slug: string
  status: string
  blocks?: BlockProps[]
  /** Block count for list views — server returns this instead of the full `blocks` tree. */
  blockCount?: number
  metaTitle?: string | null
  metaDesc?: string | null
  ogImage?: string | null
  themeTokens?: ThemeTokens | null
  createdAt: Date
  updatedAt: Date
}

/** Per-page theme tokens — override the default DocBel palette for this page. */
export interface ThemeTokens {
  primary?: string
  secondary?: string
  accent?: string
  background?: string
  foreground?: string
  muted?: string
  border?: string
  fontFamily?: string
  radius?: number
}

/**
 * A reusable, page-level variable. Define once in the page settings, then
 * reference anywhere in text props via `{{key}}` — resolved at render time on
 * the public page (see interpolate.ts `vars`).
 */
export interface PageVariable {
  key: string
  value: string
}
