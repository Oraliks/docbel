import type { BaremeComparisonFileRef, BaremeComparisonSnapshot } from './types'

/** Identité complète et ordonnée du contexte affiché, sans référence de stockage. */
export function sameComparisonSnapshot(a: BaremeComparisonSnapshot, b: BaremeComparisonSnapshot): boolean {
  const ref = (value: BaremeComparisonFileRef | null) => value === null ? null : {
    id: value.id, name: value.name, fileType: value.fileType, status: value.status,
    validFrom: value.validFrom, dataRevision: value.dataRevision,
  }
  const identity = (snapshot: BaremeComparisonSnapshot) => ({
    version: snapshot.version, state: snapshot.state, computedAt: snapshot.computedAt,
    candidate: ref(snapshot.candidate), reference: ref(snapshot.reference),
  })
  return JSON.stringify(identity(a)) === JSON.stringify(identity(b))
}
