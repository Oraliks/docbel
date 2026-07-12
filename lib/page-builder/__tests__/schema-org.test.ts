import { describe, it, expect } from 'vitest'
import { buildPageJsonLd } from '../schema-org'
import type { BlockProps } from '../types'

function b(type: string, props: Record<string, unknown>): BlockProps {
  return { id: Math.random().toString(36).slice(2), type, props } as unknown as BlockProps
}

const meta = {
  title: 'Guide chômage',
  slug: 'guide-chomage',
  metaTitle: 'Guide chômage — DocBel',
  metaDesc: 'Tout comprendre',
  ogImage: 'https://docbel.be/og.png',
  updatedAt: new Date('2026-07-01T00:00:00Z'),
  publishedAt: new Date('2026-06-01T00:00:00Z'),
}

describe('buildPageJsonLd', () => {
  it('génère un FAQPage depuis un bloc faq', () => {
    const out = buildPageJsonLd(
      [b('faq', { items: [{ question: 'Q1 ?', answer: 'R1' }] })],
      meta
    )
    const faq = out.find((o) => o['@type'] === 'FAQPage')
    expect(faq).toBeDefined()
    expect((faq as { mainEntity: unknown[] }).mainEntity).toHaveLength(1)
  })

  it('ignore une faq sans items', () => {
    const out = buildPageJsonLd([b('faq', { items: [] })], meta)
    expect(out.some((o) => o['@type'] === 'FAQPage')).toBe(false)
  })

  it('génère un HowTo depuis un bloc steps', () => {
    const out = buildPageJsonLd(
      [b('steps', { title: 'Comment faire', items: [{ title: 'Étape 1', description: 'Faire X' }] })],
      meta
    )
    const howto = out.find((o) => o['@type'] === 'HowTo')
    expect(howto).toBeDefined()
    expect((howto as { step: Array<{ position: number }> }).step[0].position).toBe(1)
  })

  it('génère un Article quand il y a un titre H≤2 + du texte', () => {
    const out = buildPageJsonLd(
      [b('heading', { text: 'Titre', level: 1 }), b('text', { html: '<p>Contenu</p>' })],
      meta
    )
    const article = out.find((o) => o['@type'] === 'Article')
    expect(article).toBeDefined()
    expect((article as { headline: string }).headline).toBe(meta.metaTitle)
    expect((article as { datePublished?: string }).datePublished).toBe(
      meta.publishedAt.toISOString()
    )
  })

  it('ne génère pas d’Article sans texte', () => {
    const out = buildPageJsonLd([b('heading', { text: 'Titre', level: 1 })], meta)
    expect(out.some((o) => o['@type'] === 'Article')).toBe(false)
  })

  it('ne génère pas d’Article si le seul titre est H3', () => {
    const out = buildPageJsonLd(
      [b('heading', { text: 'Titre', level: 3 }), b('text', { html: '<p>x</p>' })],
      meta
    )
    expect(out.some((o) => o['@type'] === 'Article')).toBe(false)
  })

  it('renvoie un tableau vide pour une page sans bloc pertinent', () => {
    expect(buildPageJsonLd([b('image', { alt: 'x' })], meta)).toEqual([])
  })
})
