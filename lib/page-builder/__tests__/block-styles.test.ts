import { describe, it, expect } from 'vitest'
import {
  blockToCSS,
  blockToClassName,
  blockAttrs,
  blockScopedCss,
  interactionStateToStyle,
  mergeForDevice,
  SHADOW_MAP,
  ANIMATION_CLASS,
} from '../block-styles'
import type { BlockProps } from '../types'

function block(partial: Partial<BlockProps>): BlockProps {
  return { id: 'b1', type: 'text', props: {}, ...partial } as BlockProps
}

describe('mergeForDevice — cascade des surcharges responsive', () => {
  it('renvoie le style de base sur desktop', () => {
    const b = block({ style: { fontSize: 16 }, layout: { paddingTop: 8 } })
    const { style, layout } = mergeForDevice(b, 'desktop')
    expect(style.fontSize).toBe(16)
    expect(layout.paddingTop).toBe(8)
  })

  it('applique la surcharge mobile par-dessus la base', () => {
    const b = block({
      style: { fontSize: 16, textColor: '#111' },
      responsive: { mobile: { style: { fontSize: 13 } } },
    })
    const { style } = mergeForDevice(b, 'mobile')
    expect(style.fontSize).toBe(13) // surchargé
    expect(style.textColor).toBe('#111') // hérité
  })

  it('n’applique pas la surcharge tablet quand on rend en mobile', () => {
    const b = block({
      style: { fontSize: 16 },
      responsive: { tablet: { style: { fontSize: 20 } } },
    })
    expect(mergeForDevice(b, 'mobile').style.fontSize).toBe(16)
    expect(mergeForDevice(b, 'tablet').style.fontSize).toBe(20)
  })
})

describe('blockToCSS', () => {
  it('masque le bloc caché sur le device courant', () => {
    const b = block({ layout: { hideOnMobile: true } })
    expect(blockToCSS(b, 'mobile').display).toBe('none')
    expect(blockToCSS(b, 'desktop').display).toBeUndefined()
  })

  it('convertit padding/margin numériques en px', () => {
    const css = blockToCSS(block({ layout: { paddingTop: 12, marginBottom: 4 } }))
    expect(css.paddingTop).toBe('12px')
    expect(css.marginBottom).toBe('4px')
  })

  it('produit un gradient de fond quand from+to sont définis', () => {
    const css = blockToCSS(block({ style: { bgGradientFrom: '#000', bgGradientTo: '#fff' } }))
    expect(css.backgroundImage).toContain('linear-gradient')
    expect(css.backgroundImage).toContain('#000')
  })

  it('sticky pose position + top + zIndex par défaut', () => {
    const css = blockToCSS(block({ layout: { sticky: true, stickyOffset: 20 } }))
    expect(css.position).toBe('sticky')
    expect(css.top).toBe('20px')
    expect(css.zIndex).toBe(10)
  })

  it('neutralise les caractères dangereux dans une url de fond', () => {
    const css = blockToCSS(block({ style: { bgImage: 'x")");background:url(evil' } }))
    // Guillemets / parenthèses / backslash retirés → une seule url(...) bien formée,
    // impossible de sortir de la déclaration.
    expect(css.backgroundImage).toBe('url("x;background:urlevil")')
  })

  it('applique une ombre depuis SHADOW_MAP', () => {
    const css = blockToCSS(block({ style: { shadow: 'lg' } }))
    expect(css.boxShadow).toBe(SHADOW_MAP.lg)
  })
})

describe('interactionStateToStyle', () => {
  it('convertit couleurs, opacité et transform (scale + lift)', () => {
    const out = interactionStateToStyle({
      textColor: '#f00',
      bgColor: '#0f0',
      opacity: 0.8,
      scale: 1.05,
      lift: 4,
    })
    expect(out.color).toBe('#f00')
    expect(out.backgroundColor).toBe('#0f0')
    expect(out.opacity).toBe(0.8)
    expect(out.transform).toContain('scale(1.05)')
    expect(out.transform).toContain('translateY(-4px)')
  })

  it('ignore une ombre "none"', () => {
    expect(interactionStateToStyle({ shadow: 'none' }).boxShadow).toBeUndefined()
  })
})

describe('blockScopedCss', () => {
  it('émet une règle :hover scopée sur [data-pb-id]', () => {
    const css = blockScopedCss(block({ id: 'abc', style: { hoverState: { bgColor: '#123456' } } }))
    expect(css).toContain('[data-pb-id="abc"]:hover')
    expect(css).toContain('background-color:#123456')
  })

  it('réécrit .self en sélecteur du bloc dans le CSS custom', () => {
    const css = blockScopedCss(block({ id: 'z9', advanced: { customCss: '.self { color: red }' } }))
    expect(css).toContain('[data-pb-id="z9"]')
    expect(css).not.toContain('.self')
  })

  it('neutralise une tentative de sortie du <style> dans le CSS custom', () => {
    const css = blockScopedCss(
      block({ id: 'z', advanced: { customCss: '</style><script>alert(1)</script>' } })
    )
    expect(css).not.toContain('</style>')
    expect(css).not.toContain('<script>')
  })

  it('renvoie null sans état d’interaction ni CSS custom', () => {
    expect(blockScopedCss(block({}))).toBeNull()
  })
})

describe('blockToClassName / blockAttrs', () => {
  it('assemble className custom + classe d’animation', () => {
    const cls = blockToClassName(block({ advanced: { className: 'ma-classe', animation: 'fade-up' } }))
    expect(cls).toContain('ma-classe')
    expect(cls).toContain(ANIMATION_CLASS['fade-up'])
  })

  it('ignore l’animation "none"', () => {
    expect(blockToClassName(block({ advanced: { animation: 'none' } }))).toBe('')
  })

  it('expose id html et data-anchor', () => {
    const attrs = blockAttrs(block({ advanced: { htmlId: 'mon-id', anchor: 'section-1' } }))
    expect(attrs.id).toBe('mon-id')
    expect(attrs['data-anchor']).toBe('section-1')
  })
})
