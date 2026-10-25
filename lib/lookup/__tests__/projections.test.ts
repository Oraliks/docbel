import { describe, expect, it } from 'vitest'
import { privateLookupError, projectPublicLookupSearch, toLookupEntryProjection, toLookupTableProjection } from '../projections'

describe('Lookup response projections', () => {
  it('keeps notes, arbitrary metadata and approvals out of partner entry data', () => {
    const result = toLookupEntryProjection({
      id: 'entry-1', code: '01', labelFr: 'Libellé', labelNl: 'Label',
      labelDe: null, labelEn: null, validFrom: null, validUntil: null,
      notes: 'interne', metadata: { iban: 'BE00' }, approvals: [{ approverEmail: 'admin@example.test' }],
    })
    expect(result).toEqual({
      id: 'entry-1', code: '01', labelFr: 'Libellé', labelNl: 'Label',
      labelDe: null, labelEn: null, validFrom: null, validUntil: null,
    })
  })

  it('keeps internal table fields out of partner table data', () => {
    const result = toLookupTableProjection({
      id: 'table-1', slug: 'table', prefix: 'T', labelFr: 'Table', labelNl: 'Tabel',
      group: null, sourcePath: null, entriesCount: 1, updatedLabel: null,
      notes: 'interne', requiresApproval: true, lastImportedBy: 'admin',
      category: { slug: 'category', labelFr: 'Catégorie', labelNl: 'Categorie' },
    })
    expect(result).not.toHaveProperty('notes')
    expect(result).not.toHaveProperty('requiresApproval')
    expect(result).not.toHaveProperty('lastImportedBy')
  })

  it('marks authorization failures private and uncached', () => {
    const response = new Response(null, { status: 401 })
    privateLookupError(response)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(response.headers.get('Vary')).toBe('Cookie, Authorization')
  })

  it('removes internal filenames and entry metadata from public search results', () => {
    const projected = projectPublicLookupSearch({
      results: [{
        notes: 'internal note',
        metadata: { x: 'y' },
        table: { slug: 'code-rue', importSource: 'C:\\private\\export.csv' },
      }],
    })

    expect(projected.results).toEqual([{ table: { slug: 'code-rue' } }])
  })
})
