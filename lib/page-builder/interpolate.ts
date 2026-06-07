// =====================================================================
//  Variable interpolation: {{site.name}}, {{page.title}}, {{today}}, etc.
//  Walks block props recursively and replaces tokens at render time.
// =====================================================================

import type { BlockProps } from './types'

export interface InterpolationContext {
  site?: {
    name?: string
    url?: string
  }
  page?: {
    title?: string
    slug?: string
    description?: string
  }
  user?: {
    name?: string
    email?: string
    isLoggedIn?: boolean
  }
  /** Arbitrary additional variables. */
  custom?: Record<string, string | number | boolean | undefined | null>
  /** User-defined page variables, referenced as {{key}}. */
  vars?: Record<string, string | number | null | undefined>
}

const TOKEN_REGEX = /\{\{\s*([\w.]+)\s*\}\}/g

function lookup(path: string, ctx: InterpolationContext): string | undefined {
  const parts = path.split('.')

  // Built-in tokens
  if (path === 'today') {
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(new Date())
  }
  if (path === 'today.short') {
    return new Intl.DateTimeFormat('fr-FR').format(new Date())
  }
  if (path === 'year') {
    return String(new Date().getFullYear())
  }
  if (path === 'month') {
    return new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(new Date())
  }

  // User-defined page variables (bare name): {{maVariable}}
  if (ctx.vars && Object.prototype.hasOwnProperty.call(ctx.vars, path)) {
    const v = ctx.vars[path]
    return v === undefined || v === null ? undefined : String(v)
  }

  // Walk the context
  let cur: unknown = ctx
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p]
    } else {
      return undefined
    }
  }
  if (cur === undefined || cur === null) return undefined
  if (typeof cur === 'string' || typeof cur === 'number' || typeof cur === 'boolean') {
    return String(cur)
  }
  return undefined
}

export function interpolateString(input: string, ctx: InterpolationContext): string {
  if (!input || !input.includes('{{')) return input
  return input.replace(TOKEN_REGEX, (match, path: string) => {
    const value = lookup(path, ctx)
    return value !== undefined ? value : match // keep token if not resolved
  })
}

/** Recursively walks a value, replacing strings via interpolation. */
export function interpolateDeep<T>(value: T, ctx: InterpolationContext): T {
  if (typeof value === 'string') {
    return interpolateString(value, ctx) as T
  }
  if (Array.isArray(value)) {
    return value.map((v) => interpolateDeep(v, ctx)) as T
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = interpolateDeep(v, ctx)
    }
    return out as T
  }
  return value
}

export function interpolateBlock<T extends BlockProps>(block: T, ctx: InterpolationContext): T {
  return { ...block, props: interpolateDeep(block.props, ctx) }
}
