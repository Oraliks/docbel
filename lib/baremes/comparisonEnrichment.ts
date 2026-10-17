import { comparisonSnapshot, detectAnomaliesFromDiff } from './compareBaremeVersions'
import type { BaremeAlert, BaremeDiff } from './types'

/** Snapshot, alertes et compteurs doivent toujours être conservés ensemble. */
export function comparisonEnrichment(diff: BaremeDiff, file: { diagnostics: unknown; summary: unknown; alerts: unknown }, previousAlerts: BaremeAlert[] = []) {
  const diagnostics = { ...(file.diagnostics as Record<string, unknown> | null) }
  const savedStructural = diagnostics.structuralAlerts
  const structural = Array.isArray(savedStructural) ? savedStructural as BaremeAlert[]
    : ((file.alerts ?? []) as BaremeAlert[]).filter((alert) => alert.kind !== 'anomaly'
      && !previousAlerts.some((old) => old.level === alert.level && old.message === alert.message))
  const anomalies = detectAnomaliesFromDiff(diff)
  delete diagnostics.comparisonPending
  return {
    diagnostics: { ...diagnostics, comparison: comparisonSnapshot(diff), structuralAlerts: structural, comparisonAlerts: anomalies },
    summary: { ...(file.summary as Record<string, unknown> | null), newEntries: diff.countsByType.added, modifiedEntries: diff.countsByType.modified, removedEntries: diff.countsByType.disappeared },
    alerts: [...anomalies, ...structural],
  }
}
