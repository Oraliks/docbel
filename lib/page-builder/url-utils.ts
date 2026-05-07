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
