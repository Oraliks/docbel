import { describe, it, expect } from 'vitest'
import { interpolateBlock, type InterpolationContext } from '../interpolate'
import type { BlockProps } from '../types'

// Petit constructeur de bloc « texte » minimal pour les tests d'interpolation.
function textBlock(props: Record<string, unknown>): BlockProps {
  return { id: 'b1', type: 'text', props } as unknown as BlockProps
}

describe('interpolateBlock — remplacement des tokens {{...}}', () => {
  it('résout site / page depuis le contexte', () => {
    const ctx: InterpolationContext = {
      site: { name: 'DocBel', url: 'https://docbel.be' },
      page: { title: 'Chômage', slug: 'chomage' },
    }
    const out = interpolateBlock(
      textBlock({ html: 'Bienvenue sur {{site.name}} — page {{page.title}}' }),
      ctx
    )
    expect((out.props as { html: string }).html).toBe('Bienvenue sur DocBel — page Chômage')
  })

  it('résout les variables de page par nom nu {{clé}}', () => {
    const ctx: InterpolationContext = { vars: { montant: '1.500 €', annee: 2026 } }
    const out = interpolateBlock(
      textBlock({ title: 'Jusqu’à {{montant}} en {{annee}}' }),
      ctx
    )
    expect((out.props as { title: string }).title).toBe('Jusqu’à 1.500 € en 2026')
  })

  it('résout {{item.field}} dans un contexte de repeater', () => {
    const ctx: InterpolationContext = { item: { name: 'Marie', city: 'Namur' } }
    const out = interpolateBlock(
      textBlock({ text: '{{item.name}} habite {{item.city}}' }),
      ctx
    )
    expect((out.props as { text: string }).text).toBe('Marie habite Namur')
  })

  it('conserve le token intact quand la valeur est absente', () => {
    const out = interpolateBlock(textBlock({ text: 'Salut {{inconnu}}' }), {})
    expect((out.props as { text: string }).text).toBe('Salut {{inconnu}}')
  })

  it('résout le token intégré {{year}} avec l’année courante', () => {
    const year = new Date().getFullYear()
    const out = interpolateBlock(textBlock({ text: '© {{year}}' }), {})
    expect((out.props as { text: string }).text).toBe(`© ${year}`)
  })

  it('descend récursivement dans les tableaux et objets imbriqués', () => {
    const ctx: InterpolationContext = { vars: { v: 'X' } }
    const out = interpolateBlock(
      textBlock({
        items: [
          { label: 'a-{{v}}', nested: { deep: 'b-{{v}}' } },
          { label: 'c-{{v}}' },
        ],
      }),
      ctx
    )
    const items = (out.props as { items: Array<{ label: string; nested?: { deep: string } }> }).items
    expect(items[0].label).toBe('a-X')
    expect(items[0].nested?.deep).toBe('b-X')
    expect(items[1].label).toBe('c-X')
  })

  it('laisse intacts les nombres, booléens et null', () => {
    const out = interpolateBlock(
      textBlock({ count: 3, active: true, empty: null, ratio: 0.5 }),
      { vars: { v: 'X' } }
    )
    const p = out.props as Record<string, unknown>
    expect(p.count).toBe(3)
    expect(p.active).toBe(true)
    expect(p.empty).toBeNull()
    expect(p.ratio).toBe(0.5)
  })

  it('ne mute pas le bloc source (retourne une copie)', () => {
    const src = textBlock({ text: 'Salut {{site.name}}' })
    const out = interpolateBlock(src, { site: { name: 'DocBel' } })
    expect((src.props as { text: string }).text).toBe('Salut {{site.name}}')
    expect(out).not.toBe(src)
  })

  it('gère les tokens avec espaces internes {{ site.name }}', () => {
    const out = interpolateBlock(
      textBlock({ text: 'Sur {{ site.name }} !' }),
      { site: { name: 'DocBel' } }
    )
    expect((out.props as { text: string }).text).toBe('Sur DocBel !')
  })

  it('résout une var nulle/undefined en gardant le token', () => {
    const out = interpolateBlock(
      textBlock({ text: 'X={{v}}' }),
      { vars: { v: null } }
    )
    // v est présent mais null → lookup renvoie undefined → token conservé.
    expect((out.props as { text: string }).text).toBe('X={{v}}')
  })
})
