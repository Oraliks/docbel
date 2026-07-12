import { describe, it, expect } from 'vitest'
import { detectIssues, type Issue } from '../page-health'
import type { BlockProps } from '../types'

function b(type: string, props: Record<string, unknown>, id = Math.random().toString(36).slice(2)): BlockProps {
  return { id, type, props } as unknown as BlockProps
}

function messages(issues: Issue[]): string[] {
  return issues.map((i) => i.message)
}

describe('detectIssues — accessibilité, structure, SEO', () => {
  it('signale une image sans texte alternatif', () => {
    const issues = detectIssues([b('heading', { text: 'T', level: 1 }), b('image', { alt: '' })])
    expect(messages(issues)).toContain('Image sans texte alternatif (alt)')
  })

  it('signale un H1 manquant', () => {
    const issues = detectIssues([b('heading', { text: 'Sous-titre', level: 2 })])
    expect(messages(issues).some((m) => m.includes('Aucun titre H1'))).toBe(true)
  })

  it('signale plusieurs H1 en erreur et pointe le doublon', () => {
    const issues = detectIssues([
      b('heading', { text: 'A', level: 1 }, 'first'),
      b('heading', { text: 'B', level: 1 }, 'second'),
    ])
    const dup = issues.find((i) => i.message.includes('titres H1'))
    expect(dup?.severity).toBe('error')
    expect(dup?.blockId).toBe('second')
  })

  it('signale un saut de niveau de titre (H2 → H4)', () => {
    const issues = detectIssues([
      b('heading', { text: 'A', level: 1 }),
      b('heading', { text: 'B', level: 2 }),
      b('heading', { text: 'C', level: 4 }),
    ])
    expect(messages(issues).some((m) => m.includes('Saut de niveau'))).toBe(true)
  })

  it('signale un bouton CTA sans lien', () => {
    const issues = detectIssues([
      b('heading', { text: 'T', level: 1 }),
      b('cta', { text: 'Cliquez', link: '' }),
    ])
    expect(messages(issues).some((m) => m.includes('sans lien'))).toBe(true)
  })

  it('ne signale pas un CTA correctement lié', () => {
    const issues = detectIssues([
      b('heading', { text: 'T', level: 1 }),
      b('cta', { text: 'Cliquez', link: 'https://x.be' }),
    ])
    expect(messages(issues).some((m) => m.includes('sans lien'))).toBe(false)
  })

  it('signale un bloc de texte vide (balises seulement)', () => {
    const issues = detectIssues([
      b('heading', { text: 'T', level: 1 }),
      b('text', { html: '<p>&nbsp;</p>' }),
    ])
    expect(messages(issues)).toContain('Bloc de texte vide')
  })

  it('signale une FAQ sans question', () => {
    const issues = detectIssues([b('heading', { text: 'T', level: 1 }), b('faq', { items: [] })])
    expect(messages(issues)).toContain('FAQ sans aucune question')
  })

  it('signale l’abus de blocs HTML/embed (≥3) en info SEO', () => {
    const issues = detectIssues([
      b('heading', { text: 'T', level: 1 }),
      b('embed', {}),
      b('embed', {}),
      b('htmlRaw', {}),
    ])
    const seo = issues.find((i) => i.message.includes('peu indexable'))
    expect(seo?.severity).toBe('info')
  })

  it('trie les problèmes error → warning → info', () => {
    const issues = detectIssues([
      b('heading', { text: 'A', level: 1 }, 'h1a'),
      b('heading', { text: 'B', level: 1 }, 'h1b'), // error (double H1)
      b('image', { alt: '' }), // warning
    ])
    const ranks = issues.map((i) => i.severity)
    const rankVal = { error: 0, warning: 1, info: 2 } as const
    const sorted = [...ranks].sort((x, y) => rankVal[x] - rankVal[y])
    expect(ranks).toEqual(sorted)
  })

  it('page vide → aucun problème bloquant de contenu', () => {
    // Pas de blocs → pas de H1 attendu, pas d'info « pas de titre visible ».
    const issues = detectIssues([])
    expect(issues.every((i) => i.severity !== 'error')).toBe(true)
  })
})
