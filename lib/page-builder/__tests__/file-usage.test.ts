import { describe, it, expect } from 'vitest'
import { extractFileIds } from '../file-usage'

describe('extractFileIds — collecte des fileId référencés', () => {
  it('collecte les props directes fileId', () => {
    const ids = extractFileIds({ type: 'image', props: { fileId: 'abc123' } })
    expect(ids).toEqual(['abc123'])
  })

  it('collecte les ids depuis les URLs /api/files/<id>/download', () => {
    const ids = extractFileIds({ src: '/api/files/xyz789/download' })
    expect(ids).toEqual(['xyz789'])
  })

  it('collecte aussi la variante /usage', () => {
    const ids = extractFileIds({ href: '/api/files/doc42/usage' })
    expect(ids).toEqual(['doc42'])
  })

  it('déduplique les ids répétés', () => {
    const ids = extractFileIds([
      { fileId: 'same' },
      { url: '/api/files/same/download' },
      { fileId: 'other' },
    ])
    expect(ids.sort()).toEqual(['other', 'same'])
  })

  it('descend dans les tableaux et objets imbriqués', () => {
    const content = {
      blocks: [
        { props: { items: [{ fileId: 'deep1' }, { img: '/api/files/deep2/download' }] } },
      ],
    }
    expect(extractFileIds(content).sort()).toEqual(['deep1', 'deep2'])
  })

  it('ignore les fileId non-chaîne ou vides', () => {
    expect(extractFileIds({ fileId: '' })).toEqual([])
    expect(extractFileIds({ fileId: 123 })).toEqual([])
    expect(extractFileIds({ fileId: null })).toEqual([])
  })

  it('renvoie [] pour un contenu sans référence', () => {
    expect(extractFileIds({ text: 'aucune référence de fichier ici' })).toEqual([])
    expect(extractFileIds(null)).toEqual([])
  })
})
