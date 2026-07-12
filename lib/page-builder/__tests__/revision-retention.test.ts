import { describe, it, expect } from 'vitest'
import { planRetention, type RevisionRef } from '../revision-retention'

// Fabrique une révision à J-`daysAgo`, `hour`h (UTC).
function rev(id: string, daysAgo: number, hour = 12): RevisionRef {
  const d = new Date('2026-07-10T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - daysAgo)
  d.setUTCHours(hour)
  return { id, createdAt: d }
}

describe('planRetention', () => {
  it('garde tout quand le total est sous le seuil récent', () => {
    const revs = Array.from({ length: 10 }, (_, i) => rev(`r${i}`, i))
    const plan = planRetention(revs, { keepRecent: 30 })
    expect(plan.delete).toEqual([])
    expect(plan.keep).toHaveLength(10)
  })

  it('conserve les N plus récentes intactes', () => {
    const revs = Array.from({ length: 50 }, (_, i) => rev(`r${i}`, i))
    const plan = planRetention(revs, { keepRecent: 30 })
    // r0..r29 (les plus récentes) doivent toutes être gardées.
    for (let i = 0; i < 30; i++) expect(plan.keep).toContain(`r${i}`)
  })

  it('au-delà du seuil, ne garde qu’une révision par jour', () => {
    // 5 révisions le même vieux jour (J-40), toutes hors fenêtre récente.
    const recent = Array.from({ length: 30 }, (_, i) => rev(`recent${i}`, i))
    const oldSameDay = [0, 1, 2, 3, 4].map((h) => rev(`old${h}`, 40, h))
    const plan = planRetention([...recent, ...oldSameDay], { keepRecent: 30 })
    // Une seule des 5 révisions du jour J-40 est conservée.
    const keptOld = plan.keep.filter((id) => id.startsWith('old'))
    expect(keptOld).toHaveLength(1)
    // Et c'est la plus récente du jour (heure la plus grande).
    expect(keptOld[0]).toBe('old4')
    expect(plan.delete.sort()).toEqual(['old0', 'old1', 'old2', 'old3'])
  })

  it('garde une révision par jour distinct dans la traîne', () => {
    const recent = Array.from({ length: 30 }, (_, i) => rev(`recent${i}`, i))
    const tail = [40, 41, 42].map((d) => rev(`day${d}`, d))
    const plan = planRetention([...recent, ...tail], { keepRecent: 30 })
    expect(plan.keep).toContain('day40')
    expect(plan.keep).toContain('day41')
    expect(plan.keep).toContain('day42')
    expect(plan.delete).toEqual([])
  })

  it('trie les entrées non ordonnées avant de décider', () => {
    const revs = [rev('b', 1), rev('a', 0), rev('c', 2)]
    const plan = planRetention(revs, { keepRecent: 2 })
    // Les 2 plus récentes (a=J0, b=J1) gardées ; c (J2, jour distinct) gardé aussi (1/jour).
    expect(plan.keep).toContain('a')
    expect(plan.keep).toContain('b')
    expect(plan.keep).toContain('c')
  })

  it('gère une liste vide', () => {
    expect(planRetention([])).toEqual({ keep: [], delete: [] })
  })
})
