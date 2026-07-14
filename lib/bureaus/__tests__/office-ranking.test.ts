import { describe, it, expect } from 'vitest'
import { rankOffices, getRecommendedOffice } from '../office-ranking'
import type { OfficeItem, OfficeType } from '../finder-model'
import type { BureauResult } from '@/app/outils/bureaux/_components/types'

function mkItem(id: string, type: OfficeType, over: Partial<BureauResult> = {}, distanceKm: number | null = null): OfficeItem {
  const bureau: BureauResult = {
    id, type, name: id, street: 'R', streetNum: '1', postalCode: '1000', city: 'Bxl',
    phone: null, email: null, website: null, appointmentUrl: null, hours: [], hoursNotes: null,
    lat: null, lng: null, organismeCode: null, organismeName: null, organismeColor: null, ...over,
  }
  return { id, type, bureau, distanceKm, isCompetent: true }
}

describe('rankOffices', () => {
  it('filtre par démarche (chomage → ONEM/PAIEMENT), exclut les autres', () => {
    const items = [mkItem('onem', 'ONEM'), mkItem('cpas', 'CPAS'), mkItem('capac', 'PAIEMENT')]
    const r = rankOffices(items, { demarche: 'chomage' })
    expect(r.map((x) => x.id).sort()).toEqual(['capac', 'onem'])
  })
  it('inconnu → garde tout', () => {
    const items = [mkItem('onem', 'ONEM'), mkItem('cpas', 'CPAS')]
    expect(rankOffices(items, { demarche: 'inconnu' })).toHaveLength(2)
  })
  it('numérote 1..N et marque isRecommended sur le premier', () => {
    const items = [mkItem('a', 'CPAS', {}, 5), mkItem('b', 'CPAS', {}, 1)]
    const r = rankOffices(items, { demarche: 'aide_sociale' })
    expect(r[0].number).toBe(1)
    expect(r[0].isRecommended).toBe(true)
    expect(r[0].id).toBe('b') // plus proche d'abord (à compétence/ouverture égales)
    expect(r[1].number).toBe(2)
    expect(r[1].isRecommended).toBe(false)
  })
  it('recommandé = premier', () => {
    const r = rankOffices([mkItem('a', 'CPAS', {}, 3)], { demarche: 'inconnu' })
    expect(getRecommendedOffice(r)?.id).toBe('a')
  })
  it('liste vide → recommandé null', () => {
    expect(getRecommendedOffice([])).toBeNull()
  })
  it('priorise la compétence territoriale avant la distance', () => {
    const items = [
      { ...mkItem('far-competent', 'CPAS', {}, 10), isCompetent: true },
      { ...mkItem('near-incompetent', 'CPAS', {}, 1), isCompetent: false },
    ]
    const r = rankOffices(items, { demarche: 'aide_sociale' })
    expect(r.map((x) => x.id)).toEqual(['far-competent', 'near-incompetent'])
  })
})
