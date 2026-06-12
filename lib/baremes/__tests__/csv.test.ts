import { describe, expect, it } from 'vitest'
import { buildCsv, csvEscape, csvSafeCell } from '../csv'

describe('csvSafeCell — protection injection de formule', () => {
  it("préfixe les valeurs commençant par = + @ avec une apostrophe", () => {
    expect(csvSafeCell('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)")
    expect(csvSafeCell('+33123456789')).toBe("'+33123456789")
    expect(csvSafeCell('@import')).toBe("'@import")
    expect(csvSafeCell('\t=cmd')).toBe("'\t=cmd")
    expect(csvSafeCell('\r=x')).toBe("'\r=x")
  })

  it('ne touche pas aux nombres négatifs légitimes', () => {
    expect(csvSafeCell('-12.5')).toBe('-12.5')
    expect(csvSafeCell(-12.5)).toBe('-12.5')
  })

  it('préfixe un tiret suivi de texte (vecteur -=cmd)', () => {
    expect(csvSafeCell('-=1+1')).toBe("'-=1+1")
  })

  it('laisse les valeurs sûres intactes', () => {
    expect(csvSafeCell('AA1')).toBe('AA1')
    expect(csvSafeCell('art. 114, § 5')).toBe('art. 114, § 5')
    expect(csvSafeCell(76.55)).toBe('76.55')
    expect(csvSafeCell(null)).toBe('')
    expect(csvSafeCell(undefined)).toBe('')
  })
})

describe('csvEscape', () => {
  it('met entre quotes les valeurs avec virgule/quote/retour ligne', () => {
    expect(csvEscape('a,b')).toBe('"a,b"')
    expect(csvEscape('dit "x"')).toBe('"dit ""x"""')
    expect(csvEscape('l1\nl2')).toBe('"l1\nl2"')
  })

  it('neutralise puis échappe (injection + virgule)', () => {
    expect(csvEscape('=1+1,2')).toBe('"\'=1+1,2"')
  })
})

describe('buildCsv', () => {
  it('assemble en-tête + lignes avec valeurs neutralisées', () => {
    const csv = buildCsv(
      ['code', 'montant'],
      [
        ['AA1', 76.55],
        ['=evil()', 10],
      ]
    )
    expect(csv).toBe(`code,montant\nAA1,76.55\n'=evil(),10`)
  })
})
