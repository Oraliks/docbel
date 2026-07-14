import { describe, it, expect } from 'vitest'
import { clusterPoints, type ClusterPoint } from '../map-clustering'
const P = (id: string, x: number, y: number): ClusterPoint => ({ id, x, y })
describe('clusterPoints', () => {
  it('regroupe les points dans le rayon', () => {
    const c = clusterPoints([P('a', 0, 0), P('b', 3, 4), P('z', 200, 200)], 10)
    // a,b (dist 5 <=10) groupés ; z seul
    const grouped = c.find((cl) => cl.count === 2)
    expect(grouped?.ids.sort()).toEqual(['a', 'b'])
    expect(grouped?.x).toBeCloseTo(1.5); expect(grouped?.y).toBeCloseTo(2)
    expect(c.find((cl) => cl.ids.includes('z'))?.count).toBe(1)
  })
  it('rayon 0 → tous singletons', () => {
    expect(clusterPoints([P('a',0,0),P('b',0,0)], 0).every((c) => c.count === 1)).toBe(true)
  })
  it('vide → vide ; déterministe (indépendant de l’ordre d’entrée)', () => {
    expect(clusterPoints([], 10)).toEqual([])
    const a = clusterPoints([P('a',0,0),P('b',1,1),P('c',2,2)], 5)
    const b = clusterPoints([P('c',2,2),P('a',0,0),P('b',1,1)], 5)
    expect(a).toEqual(b)
  })
})
