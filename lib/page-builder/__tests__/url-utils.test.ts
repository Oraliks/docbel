import { describe, it, expect } from 'vitest'
import { safeHref, isSafeUrl, sanitizeLink } from '../url-utils'

describe('safeHref — hardens public <a href> against stored XSS', () => {
  it('drops dangerous protocols (→ undefined, so React omits href)', () => {
    expect(safeHref('javascript:alert(1)')).toBeUndefined()
    expect(safeHref('JavaScript:alert(1)')).toBeUndefined()
    expect(safeHref('  javascript:alert(1)')).toBeUndefined() // leading whitespace
    expect(safeHref('vbscript:msgbox(1)')).toBeUndefined()
    expect(safeHref('data:text/html,<script>alert(1)</script>')).toBeUndefined()
    expect(safeHref('data:image/png;base64,AAAA')).toBeUndefined() // all data: rejected for href
  })

  it('returns safe link targets unchanged', () => {
    expect(safeHref('https://example.com/x')).toBe('https://example.com/x')
    expect(safeHref('http://example.com')).toBe('http://example.com')
    expect(safeHref('mailto:a@b.com')).toBe('mailto:a@b.com')
    expect(safeHref('tel:+3221234567')).toBe('tel:+3221234567')
    expect(safeHref('/actualites/slug')).toBe('/actualites/slug')
    expect(safeHref('#section')).toBe('#section')
  })

  it('treats empty / nullish as no link', () => {
    expect(safeHref('')).toBeUndefined()
    expect(safeHref('   ')).toBeUndefined()
    expect(safeHref(undefined)).toBeUndefined()
    expect(safeHref(null)).toBeUndefined()
  })

  it('stays consistent with the underlying isSafeUrl allowlist', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeUrl('https://example.com')).toBe(true)
    // sanitizeLink keeps its legacy '#' fallback contract
    expect(sanitizeLink('javascript:alert(1)')).toBe('#')
  })
})
