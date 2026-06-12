import { describe, expect, it } from 'vitest'
import { buildAnbMatrix } from '../allocationMatrix'
import type { ActiveBaremeAmount } from '../getActiveBaremeData'

// Mini-jeu de données conforme à la capture ONEM (A_N_B_vol_plein, MIN + 42/43).
const GROUND: Record<string, Record<string, number>> = {
  MIN: {
    AA1: 76.55, AA2: 76.55, AA3: 69.59, AB: 69.59, AX: 69.59,
    NA1: 62.05, NA2: 62.05, NA3: 56.40, NB: 56.40, NX: 56.40,
    BA1: 59.72, BA2: 55.12, BA3: 50.11, BX: 41.54, BB: 29.27,
  },
  '42': { AA1: 76.55, AA3: 69.59, AB: 69.59, AX: 69.59, NA3: 56.40, NB: 56.40, NX: 56.40, BA3: 50.11, BX: 41.54, BB: 29.27 },
  '43': { BA3: 50.58, NA3: 56.40 },
}

function makeAmounts(): ActiveBaremeAmount[] {
  const out: ActiveBaremeAmount[] = []
  for (const [tranche, codes] of Object.entries(GROUND)) {
    for (const [code, amount] of Object.entries(codes)) {
      out.push({
        id: `${code}-${tranche}`,
        sourceSheet: 'A_N_B_vol_plein',
        category: 'full_unemployment',
        allocationCode: code,
        salaryCode: tranche,
        article: null,
        labelFr: null,
        labelNl: null,
        unit: 'daily',
        amount,
        minDailySalary: null,
        maxDailySalary: null,
        validFrom: new Date('2026-03-01T00:00:00.000Z'),
        comparisonKey: `full_unemployment:${code}:${tranche}`,
      })
    }
  }
  return out
}

describe('buildAnbMatrix', () => {
  const matrix = buildAnbMatrix(makeAmounts(), 'full_unemployment', 1.7758)!

  it('produit une matrice non nulle avec métadonnées', () => {
    expect(matrix).not.toBeNull()
    expect(matrix.validFrom).toBe('2026-03-01')
    expect(matrix.multiplicateur).toBe(1.7758)
    expect(matrix.titleAccent).toBe('entière')
  })

  it('regroupe en 4 groupes (A, N, B 1ʳᵉ, 2ᵉ période)', () => {
    expect(matrix.groups.map((g) => g.key)).toEqual(['A', 'N', 'B', 'B2'])
    expect(matrix.groups[0].label).toBe('Charge de famille')
    expect(matrix.groups[3].label).toBe('2ᵉ période')
  })

  it('fusionne AB/AX et NB/NX en une colonne, garde BX et BB distincts', () => {
    const colLabels = matrix.groups.flatMap((g) => g.columns.map((c) => c.label))
    expect(colLabels).toContain('AB / AX')
    expect(colLabels).toContain('NB / NX')
    expect(colLabels).toContain('BX')
    expect(colLabels).toContain('BB')
    // 4 + 4 + 3 + 2 = 13 colonnes (15 codes dont 2 paires fusionnées)
    expect(colLabels).toHaveLength(13)
  })

  it('résout les taux depuis le glossaire (65 % / 60 % / —)', () => {
    const aGroup = matrix.groups[0]
    expect(aGroup.columns[0].rate).toBe('65 %') // AA1
    expect(aGroup.columns[1].rate).toBe('60 %') // AA2
    expect(aGroup.columns[3].rate).toBeNull() // AB/AX 2ᵉ période
  })

  it('ajoute les sous-libellés BV+/BV- sur la 2ᵉ période cohabitant', () => {
    const b2 = matrix.groups[3]
    expect(b2.columns[0].sub).toBe('BV+ / PP+')
    expect(b2.columns[1].sub).toBe('BV- / PP-')
  })

  it('ordonne les lignes MIN puis tranches numériques croissantes', () => {
    expect(matrix.rows[0].tranche).toBe('MIN')
    expect(matrix.rows[0].isMin).toBe(true)
    expect(matrix.trancheCodes).toEqual(['MIN', '42', '43'])
  })

  it('aligne les valeurs MIN sur les bonnes colonnes (conforme à la capture)', () => {
    const minRow = matrix.rows.find((r) => r.tranche === 'MIN')!
    const idx = (label: string) =>
      matrix.groups.flatMap((g) => g.columns).findIndex((c) => c.label === label)
    expect(minRow.values[idx('AA1')]).toBe(76.55)
    expect(minRow.values[idx('AA3')]).toBe(69.59)
    expect(minRow.values[idx('AB / AX')]).toBe(69.59) // colonne fusionnée → valeur de AB
    expect(minRow.values[idx('NA3')]).toBe(56.4)
    expect(minRow.values[idx('BA3')]).toBe(50.11)
    expect(minRow.values[idx('BX')]).toBe(41.54)
    expect(minRow.values[idx('BB')]).toBe(29.27)
  })

  it('retourne null si aucun montant', () => {
    expect(buildAnbMatrix([], 'full_unemployment', null)).toBeNull()
  })
})
