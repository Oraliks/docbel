import { describe, it, expect } from 'vitest'
import {
  flattenResolveToOffices,
  buildOffices,
  filterOffices,
  estimateTravel,
  officeTypeOfBureau,
  TYPE_META,
  TYPE_ORDER,
  type OfficeType,
} from '../finder-model'
import type { ResolveResponse, BureauResult } from '@/app/outils/bureaux/_components/types'

function mkBureau(over: Partial<BureauResult> = {}): BureauResult {
  return {
    id: over.id ?? 'b1', type: over.type ?? 'ONEM', name: over.name ?? 'Bureau',
    street: 'Rue X', streetNum: '1', postalCode: '1000', city: 'Bruxelles',
    phone: null, email: null, website: null, appointmentUrl: null,
    hours: [], hoursNotes: null,
    lat: over.lat ?? null, lng: over.lng ?? null,
    organismeCode: null, organismeName: null, organismeColor: null,
    ...over,
  }
}

function mkResolve(over: Partial<ResolveResponse['attitre']> = {}): ResolveResponse {
  return {
    commune: { id: 'c1', insCode: '21004', nameFr: 'Bruxelles', nameNl: 'Brussel', region: 'brussels', province: null, lat: 50.85, lng: 4.35 },
    attitre: {
      cpas: null, commune: null, onem: null, organismePaiement: null,
      organismesPaiement: [], mutuelle: null, emploiRegional: null, ...over,
    },
    warnings: [],
  }
}

describe('flattenResolveToOffices', () => {
  it('aplatit chaque slot rempli en un item typé, un item par OP', () => {
    const data = mkResolve({
      onem: mkBureau({ id: 'onem' }),
      cpas: mkBureau({ id: 'cpas' }),
      commune: mkBureau({ id: 'com' }),
      emploiRegional: mkBureau({ id: 'sre' }),
      mutuelle: mkBureau({ id: 'mut' }),
      organismesPaiement: [mkBureau({ id: 'capac' }), mkBureau({ id: 'fgtb' })],
    })
    const flat = flattenResolveToOffices(data)
    expect(flat.map((f) => f.type)).toEqual(['ONEM', 'CPAS', 'COMMUNE', 'SRE', 'PAIEMENT', 'PAIEMENT', 'MUTUELLE'])
    expect(flat.map((f) => f.bureau.id)).toEqual(['onem', 'cpas', 'com', 'sre', 'capac', 'fgtb', 'mut'])
  })

  it('ignore les slots vides', () => {
    expect(flattenResolveToOffices(mkResolve())).toEqual([])
  })
})

describe('buildOffices', () => {
  it('trie par distance croissante, bureaux sans coords en dernier', () => {
    const near = mkBureau({ id: 'near', lat: 50.851, lng: 4.351 })
    const far = mkBureau({ id: 'far', lat: 51.2, lng: 4.4 })
    const noco = mkBureau({ id: 'noco', lat: null, lng: null })
    const data = mkResolve({ onem: far, cpas: near, commune: noco })
    const items = buildOffices(data, { lat: 50.85, lng: 4.35 })
    expect(items.map((i) => i.bureau.id)).toEqual(['near', 'far', 'noco'])
    expect(items[2].distanceKm).toBeNull()
  })

  it('sans ref de distance, garde l’ordre TYPE_ORDER et distanceKm null', () => {
    const data = mkResolve({ commune: mkBureau({ id: 'com' }), onem: mkBureau({ id: 'onem' }) })
    const items = buildOffices(data, null)
    expect(items.map((i) => i.type)).toEqual(['ONEM', 'COMMUNE'])
    expect(items.every((i) => i.distanceKm === null)).toBe(true)
  })
})

describe('filterOffices', () => {
  const items = buildOffices(
    mkResolve({ onem: mkBureau({ id: 'onem', name: 'ONEM Bruxelles' }), cpas: mkBureau({ id: 'cpas', name: 'CPAS Ixelles' }) }),
    null,
  )
  it('filtre par types actifs', () => {
    const out = filterOffices(items, new Set<OfficeType>(['CPAS']), '')
    expect(out.map((i) => i.bureau.id)).toEqual(['cpas'])
  })
  it('filtre par texte libre (nom, insensible casse)', () => {
    const out = filterOffices(items, new Set<OfficeType>(['ONEM', 'CPAS']), 'ixel')
    expect(out.map((i) => i.bureau.id)).toEqual(['cpas'])
  })
})

describe('estimateTravel', () => {
  it('estime marche et voiture', () => {
    expect(estimateTravel(1)).toEqual({ walkMin: 12, driveMin: 2 })
    expect(estimateTravel(0.1)).toEqual({ walkMin: 1, driveMin: 1 })
  })
})

describe('TYPE_META', () => {
  it('couvre exactement TYPE_ORDER, labelKey + color + icon définis', () => {
    expect(new Set(Object.keys(TYPE_META))).toEqual(new Set(TYPE_ORDER))
    for (const t of TYPE_ORDER) {
      expect(TYPE_META[t].labelKey).toBeTruthy()
      expect(TYPE_META[t].color).toMatch(/^#/)
      expect(TYPE_META[t].icon).toBeTruthy()
    }
  })
})

describe('officeTypeOfBureau', () => {
  it('priorise le code organisme (type DB grossier)', () => {
    expect(officeTypeOfBureau({ type: 'AUTRE', organismeCode: 'forem' })).toBe('SRE')
    expect(officeTypeOfBureau({ type: 'AUTRE', organismeCode: 'Solidaris' })).toBe('MUTUELLE')
    expect(officeTypeOfBureau({ type: 'SYNDICAT', organismeCode: 'capac' })).toBe('PAIEMENT')
  })
  it('retombe sur le type DB quand le code est absent/inconnu', () => {
    expect(officeTypeOfBureau({ type: 'ONEM', organismeCode: null })).toBe('ONEM')
    expect(officeTypeOfBureau({ type: 'CPAS', organismeCode: null })).toBe('CPAS')
    expect(officeTypeOfBureau({ type: 'COMMUNE', organismeCode: 'inconnu' })).toBe('COMMUNE')
    expect(officeTypeOfBureau({ type: 'SYNDICAT', organismeCode: null })).toBe('PAIEMENT')
    expect(officeTypeOfBureau({ type: 'PERMANENCE', organismeCode: null })).toBe('PAIEMENT')
    expect(officeTypeOfBureau({ type: 'AUTRE', organismeCode: null })).toBe('COMMUNE')
  })
  it('ne renvoie que des OfficeType connus', () => {
    const known = new Set<OfficeType>(TYPE_ORDER)
    expect(known.has(officeTypeOfBureau({ type: 'AUTRE', organismeCode: null }))).toBe(true)
  })
})
