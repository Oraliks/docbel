import { describe, expect, it } from 'vitest'
import type { BaremeAlert, BaremeComparisonSnapshot } from '../types'
import { missingBaremeChangeConfirmations } from '../changeConfirmation'

const snapshot: BaremeComparisonSnapshot = {
  version: 1, state: 'computed', computedAt: '2026-10-24T12:00:00.000Z',
  candidate: { id: 'draft', name: 'draft.xlsx', status: 'draft', fileType: 'test', validFrom: null, dataRevision: 'candidate-r1' },
  reference: { id: 'published', name: 'published.xlsx', status: 'published', fileType: 'test', validFrom: null, dataRevision: 'reference-r1' },
}
const alert: BaremeAlert = { level: 'warn', kind: 'anomaly', message: 'Variation à vérifier', problem: {
  id: 'problem-1', groupId: 'anomaly:50', category: 'anomaly', severity: 'warning', publicationEffect: 'review',
  resolutionState: 'open', affectedCount: 2, owner: 'admin', allowedActions: ['confirm_change'],
  affectedKeys: ['a', 'b'], evidence: [],
} }
const log = (overrides: Record<string, unknown> = {}) => ({ action: 'comparison_change_confirmed', actorEmail: 'admin@example.test', details: {
  version: 1, problemId: 'problem-1', reason: 'Les sources officielles concordent pour ces deux variations.',
  reviewedKeys: ['b', 'a'], comparison: snapshot, candidateDataRevision: 'candidate-r1', referenceDataRevision: 'reference-r1',
  ...overrides,
} })

describe('contrôle serveur des confirmations de variation à la publication', () => {
  it('bloque si aucune décision n’existe', () => {
    expect(missingBaremeChangeConfirmations([alert], snapshot, [])).toEqual(['problem-1'])
  })

  it('accepte uniquement une décision exacte, justifiée et attribuée', () => {
    expect(missingBaremeChangeConfirmations([alert], snapshot, [log()])).toEqual([])
  })

  it.each([
    { candidateDataRevision: 'candidate-r2' },
    { reason: 'trop court' },
    { reviewedKeys: ['a'] },
    { comparison: { ...snapshot, computedAt: '2026-10-24T12:01:00.000Z' } },
  ])('rejette une décision devenue obsolète ou incomplète', (details) => {
    expect(missingBaremeChangeConfirmations([alert], snapshot, [log(details)])).toEqual(['problem-1'])
  })
})
