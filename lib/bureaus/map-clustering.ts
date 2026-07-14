// lib/bureaus/map-clustering.ts
export interface ClusterPoint { id: string; x: number; y: number }
export interface Cluster { x: number; y: number; ids: string[]; count: number }

/** Regroupe les points proches (distance écran < radiusPx) en clusters
 * déterministes (tri par id). x/y = centroïde des membres. count 1 = singleton. */
export function clusterPoints(points: ClusterPoint[], radiusPx: number): Cluster[] {
  const sorted = [...points].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const taken = new Set<string>()
  const r2 = radiusPx * radiusPx
  const clusters: Cluster[] = []
  for (const seed of sorted) {
    if (taken.has(seed.id)) continue
    taken.add(seed.id)
    const members = [seed]
    if (radiusPx > 0) {
      for (const p of sorted) {
        if (taken.has(p.id)) continue
        const dx = p.x - seed.x, dy = p.y - seed.y
        if (dx * dx + dy * dy <= r2) { taken.add(p.id); members.push(p) }
      }
    }
    const n = members.length
    clusters.push({
      x: members.reduce((s, m) => s + m.x, 0) / n,
      y: members.reduce((s, m) => s + m.y, 0) / n,
      ids: members.map((m) => m.id),
      count: n,
    })
  }
  return clusters
}
