import { prisma, withDbRetry } from '@/lib/prisma'

export type AnomalyType =
  | 'duplicate_code'        // Même code dans la table avec validFrom différents (peut être normal)
  | 'duplicate_label'       // Codes différents avec le même labelFr (suspect)
  | 'missing_fr'            // Pas de labelFr
  | 'missing_nl'            // Pas de labelNl
  | 'expired'               // validUntil dépassé
  | 'empty_table'           // Table sans entrées

export interface Anomaly {
  type: AnomalyType
  severity: 'info' | 'warn' | 'error'
  tableId: string
  tableSlug: string
  tableLabelFr: string
  count: number
  details?: string
  examples?: { code: string; labelFr: string }[]
}

export interface AnomalyReport {
  generatedAt: Date
  totalEntries: number
  totalTables: number
  anomalies: Anomaly[]
  summary: {
    error: number
    warn: number
    info: number
  }
}

/**
 * Scanne tout le lookup à la recherche d'anomalies. Retourne un rapport
 * groupé par type + table.
 */
export async function detectLookupAnomalies(): Promise<AnomalyReport> {
  const tables = await withDbRetry(() =>
    prisma.lookupTable.findMany({
      select: { id: true, slug: true, labelFr: true, entriesCount: true },
    })
  )

  const anomalies: Anomaly[] = []
  const totalEntries = await withDbRetry(() => prisma.lookupEntry.count())
  const now = new Date()

  // 1. Tables vides
  for (const t of tables) {
    if (t.entriesCount === 0) {
      anomalies.push({
        type: 'empty_table',
        severity: 'info',
        tableId: t.id,
        tableSlug: t.slug,
        tableLabelFr: t.labelFr,
        count: 0,
        details: 'Aucune entrée importée pour cette table',
      })
    }
  }

  // 2. Scan par table : codes dupliqués, labels dupliqués, langues manquantes, expirées
  for (const t of tables) {
    if (t.entriesCount === 0) continue
    const entries = await withDbRetry(() =>
      prisma.lookupEntry.findMany({
        where: { tableId: t.id },
        select: {
          code: true,
          labelFr: true,
          labelNl: true,
          validFrom: true,
          validUntil: true,
        },
      })
    )

    // Codes dupliqués (même code apparaît dans plusieurs entrées)
    const byCode = new Map<string, number>()
    for (const e of entries) {
      byCode.set(e.code, (byCode.get(e.code) ?? 0) + 1)
    }
    const duplicateCodes = [...byCode.entries()].filter(([, n]) => n > 1)
    if (duplicateCodes.length > 0) {
      anomalies.push({
        type: 'duplicate_code',
        severity: 'info', // Souvent normal (versions historiques)
        tableId: t.id,
        tableSlug: t.slug,
        tableLabelFr: t.labelFr,
        count: duplicateCodes.length,
        details: `${duplicateCodes.length} code(s) en plusieurs versions historiques`,
        examples: duplicateCodes.slice(0, 3).map(([code]) => ({
          code,
          labelFr: entries.find((e) => e.code === code)?.labelFr ?? '',
        })),
      })
    }

    // Labels dupliqués (même labelFr pour codes différents — suspect)
    const byLabel = new Map<string, string[]>()
    for (const e of entries) {
      if (!e.labelFr) continue
      const list = byLabel.get(e.labelFr) ?? []
      list.push(e.code)
      byLabel.set(e.labelFr, list)
    }
    const duplicateLabels = [...byLabel.entries()].filter(
      ([, codes]) => new Set(codes).size > 1
    )
    if (duplicateLabels.length > 0) {
      anomalies.push({
        type: 'duplicate_label',
        severity: 'warn',
        tableId: t.id,
        tableSlug: t.slug,
        tableLabelFr: t.labelFr,
        count: duplicateLabels.length,
        details: `${duplicateLabels.length} libellé(s) FR partagé(s) par plusieurs codes`,
        examples: duplicateLabels.slice(0, 3).map(([labelFr, codes]) => ({
          code: codes.join(', '),
          labelFr,
        })),
      })
    }

    // Langues manquantes
    const missingFr = entries.filter((e) => !e.labelFr).length
    const missingNl = entries.filter((e) => !e.labelNl).length
    if (missingFr > 0) {
      anomalies.push({
        type: 'missing_fr',
        severity: missingFr > entries.length * 0.5 ? 'warn' : 'info',
        tableId: t.id,
        tableSlug: t.slug,
        tableLabelFr: t.labelFr,
        count: missingFr,
        details: `${missingFr} / ${entries.length} entrées sans label FR`,
      })
    }
    if (missingNl > 0 && missingNl < entries.length) {
      // Si TOUT est missing en NL, c'est probablement une table FR-only normale
      anomalies.push({
        type: 'missing_nl',
        severity: 'info',
        tableId: t.id,
        tableSlug: t.slug,
        tableLabelFr: t.labelFr,
        count: missingNl,
        details: `${missingNl} / ${entries.length} entrées sans label NL`,
      })
    }

    // Entrées expirées
    const expired = entries.filter((e) => e.validUntil && e.validUntil < now).length
    if (expired > 0) {
      anomalies.push({
        type: 'expired',
        severity: 'info',
        tableId: t.id,
        tableSlug: t.slug,
        tableLabelFr: t.labelFr,
        count: expired,
        details: `${expired} entrée(s) avec validUntil dépassée (historique)`,
      })
    }
  }

  const summary = { error: 0, warn: 0, info: 0 }
  for (const a of anomalies) summary[a.severity]++

  return {
    generatedAt: new Date(),
    totalEntries,
    totalTables: tables.length,
    anomalies,
    summary,
  }
}
