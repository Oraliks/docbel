import { describe, it, expect } from 'vitest'
import { DEMARCHE_ORDER, DEMARCHE_META, demarcheToOfficeTypes, type Demarche } from '../demarche-map'
import { TYPE_ORDER, type OfficeType } from '../finder-model'

describe('DEMARCHE_META', () => {
  it('couvre exactement DEMARCHE_ORDER, avec labelKey/icon/officeTypes', () => {
    expect(new Set(Object.keys(DEMARCHE_META))).toEqual(new Set(DEMARCHE_ORDER))
    for (const d of DEMARCHE_ORDER) {
      expect(DEMARCHE_META[d].labelKey).toBeTruthy()
      expect(DEMARCHE_META[d].icon).toBeTruthy()
    }
  })
  it('n’expose PAS pension ni mutuelle comme démarche', () => {
    expect(DEMARCHE_ORDER).not.toContain('pension' as Demarche)
    expect(DEMARCHE_ORDER).not.toContain('mutuelle' as Demarche)
  })
  it('ne référence que des OfficeType connus (ou "all")', () => {
    const known = new Set<OfficeType>(TYPE_ORDER)
    for (const d of DEMARCHE_ORDER) {
      const t = DEMARCHE_META[d].officeTypes
      if (t !== 'all') for (const ot of t) expect(known.has(ot)).toBe(true)
    }
  })
})

describe('demarcheToOfficeTypes', () => {
  it('chomage → ONEM + PAIEMENT', () => {
    expect(demarcheToOfficeTypes('chomage')).toEqual(expect.arrayContaining(['ONEM', 'PAIEMENT']))
  })
  it('aide_sociale → CPAS ; documents_communaux → COMMUNE ; emploi → SRE ; sante → MUTUELLE', () => {
    expect(demarcheToOfficeTypes('aide_sociale')).toEqual(['CPAS'])
    expect(demarcheToOfficeTypes('documents_communaux')).toEqual(['COMMUNE'])
    expect(demarcheToOfficeTypes('emploi')).toEqual(['SRE'])
    expect(demarcheToOfficeTypes('sante')).toEqual(['MUTUELLE'])
  })
  it('inconnu → "all"', () => {
    expect(demarcheToOfficeTypes('inconnu')).toBe('all')
  })
})
