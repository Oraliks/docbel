import { describe, it, expect } from 'vitest'
import { rankOffices, getRecommendedOffice } from '../office-ranking'
import { computeOpenStatus } from '../types'
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
  it('priorise le statut ouvert avant fermé (à compétence/distance égales)', () => {
    // Lundi 13/07/2026 10h00 — pas un jour férié belge (cf. lib/bureaus/holidays.ts).
    const at = new Date('2026-07-13T10:00:00')
    expect(at.getDay()).toBe(1) // garde-fou : doit rester un lundi pour matcher `openHours` ci-dessous
    const openHours = [{ day: at.getDay(), slots: [{ open: '09:00', close: '17:00' }] }]
    const items = [
      mkItem('closed', 'CPAS', { hours: [] }),
      mkItem('open', 'CPAS', { hours: openHours }),
    ]
    // Garde-fou de fixture : si `openHours` ne rend pas réellement le bureau
    // "open" à `at`, ce test masquerait un bug de tri au lieu de le détecter.
    const openItem = items.find((i) => i.id === 'open')!
    expect(computeOpenStatus(openItem.bureau.hours, at).state).toBe('open')

    const r = rankOffices(items, { demarche: 'aide_sociale', at })
    expect(r[0].id).toBe('open')
    expect(r[0].number).toBe(1)
    expect(r[0].isRecommended).toBe(true)
    expect(r[1].id).toBe('closed')
  })
  it('départage par TYPE_ORDER quand compétence, ouverture et distance sont à égalité', () => {
    // Les deux items sont à égalité sur les 3 premiers niveaux (compétent par
    // défaut, hours:[] → no_data des deux côtés, distance null des deux côtés) :
    // seul le niveau 4 (TYPE_ORDER) doit départager, ONEM avant MUTUELLE.
    const items = [mkItem('mutuelle', 'MUTUELLE'), mkItem('onem', 'ONEM')]
    const r = rankOffices(items, { demarche: 'inconnu' })
    expect(r.map((x) => x.id)).toEqual(['onem', 'mutuelle'])
  })
})
