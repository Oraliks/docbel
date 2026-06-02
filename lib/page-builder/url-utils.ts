const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:'])

export function isSafeUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (trimmed === '') return true
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) return true
  try {
    const parsed = new URL(trimmed)
    return ALLOWED_PROTOCOLS.has(parsed.protocol.toLowerCase())
  } catch {
    return false
  }
}

export function sanitizeUrl(value: unknown, fallback = ''): string {
  return isSafeUrl(value) ? (value as string).trim() : fallback
}

export function sanitizeLink(value: unknown): string {
  return sanitizeUrl(value, '#')
}

/**
 * Hardens a user-supplied block link before it reaches a public `<a href>`.
 * Returns the URL only when it is a safe target (http(s), mailto, tel,
 * site-relative `/…`, or in-page `#…`); otherwise `undefined` so React drops
 * the attribute and the element is simply not a link. Neutralises stored
 * `javascript:` / `data:` / `vbscript:` payloads. Reuses {@link isSafeUrl}.
 */
export function safeHref(value?: string | null): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (trimmed === '') return undefined
  return isSafeUrl(trimmed) ? trimmed : undefined
}
