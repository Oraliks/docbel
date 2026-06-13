import { prisma, withDbRetry } from '@/lib/prisma'
import type { BaremeAlert, BaremeDiff, BaremeDiffChange } from './types'

// Seuil de variation déclenchant une alerte "anomalie" (en %).
// Abaissé de 20→8 % (hardening adversarial) : l'indexation ONEM est ~2 %/an, donc
// toute variation > 8 % sur une comparisonKey est suspecte (swap de colonnes, valeur
// fausse, mauvaise échelle) et mérite une revue admin.
const ANOMALY_THRESHOLD_PCT = 8

// Variation au-dessus de ce seuil → erreur (bloque la publication sauf force)
const ANOMALY_ERROR_THRESHOLD_PCT = 50

/**
 * Compare les BaremeAmount d'un nouveau draft (newFileId) avec ceux du
 * dernier import publié antérieur (auto-résolu si previousFileId omis).
 *
 * Retourne la liste des changements groupés par type.
 * Si aucun import publié précédent n'existe, tous les montants sont en `new_entry`.
 */
export async function compareBaremeVersions(
  newFileId: string,
  previousFileId?: string | null
): Promise<BaremeDiff> {
  // Résolution du previous : dernier published avec validFrom le plus récent
  let resolvedPreviousId: string | null = previousFileId ?? null
  if (resolvedPreviousId === null) {
    const previous = await withDbRetry(() =>
      prisma.baremeFile.findFirst({
        where: { status: 'published', NOT: { id: newFileId } },
        orderBy: [{ validFrom: 'desc' }, { publishedAt: 'desc' }],
        select: { id: true },
      })
    )
    resolvedPreviousId = previous?.id ?? null
  }

  // Charger les amounts des deux versions
  const [newAmounts, oldAmounts] = await Promise.all([
    withDbRetry(() =>
      prisma.baremeAmount.findMany({
        where: { fileId: newFileId },
        select: { comparisonKey: true, amount: true, category: true, sourceSheet: true },
      })
    ),
    resolvedPreviousId
      ? withDbRetry(() =>
          prisma.baremeAmount.findMany({
            where: { fileId: resolvedPreviousId! },
            select: { comparisonKey: true, amount: true, category: true, sourceSheet: true },
          })
        )
      : Promise.resolve([] as { comparisonKey: string; amount: { toNumber(): number } | number; category: string; sourceSheet: string }[]),
  ])

  const newMap = new Map<string, { amount: number; category: string; sourceSheet: string }>()
  for (const a of newAmounts) {
    newMap.set(a.comparisonKey, {
      amount: toNumber(a.amount),
      category: a.category,
      sourceSheet: a.sourceSheet,
    })
  }

  const oldMap = new Map<string, { amount: number; category: string; sourceSheet: string }>()
  for (const a of oldAmounts) {
    oldMap.set(a.comparisonKey, {
      amount: toNumber(a.amount),
      category: a.category,
      sourceSheet: a.sourceSheet,
    })
  }

  const changes: BaremeDiffChange[] = []

  // amount_changed + new_entry
  for (const [key, current] of newMap) {
    const previous = oldMap.get(key)
    if (previous === undefined) {
      changes.push({
        type: 'new_entry',
        key,
        newValue: current.amount,
        category: current.category,
        sourceSheet: current.sourceSheet,
      })
    } else if (!areAmountsEqual(previous.amount, current.amount)) {
      changes.push({
        type: 'amount_changed',
        key,
        oldValue: previous.amount,
        newValue: current.amount,
        category: current.category,
        sourceSheet: current.sourceSheet,
      })
    }
  }

  // removed_entry
  for (const [key, previous] of oldMap) {
    if (!newMap.has(key)) {
      changes.push({
        type: 'removed_entry',
        key,
        oldValue: previous.amount,
        category: previous.category,
        sourceSheet: previous.sourceSheet,
      })
    }
  }

  const countsByType = {
    amount_changed: 0,
    new_entry: 0,
    removed_entry: 0,
  }
  for (const c of changes) countsByType[c.type]++

  return {
    changes,
    previousFileId: resolvedPreviousId,
    newFileId,
    countsByType,
  }
}

function toNumber(decimal: unknown): number {
  if (typeof decimal === 'number') return decimal
  if (decimal && typeof decimal === 'object' && 'toNumber' in decimal) {
    return (decimal as { toNumber(): number }).toNumber()
  }
  return Number(decimal)
}

type AmountChange = Extract<BaremeDiffChange, { type: 'amount_changed' }>

/**
 * Détecte les variations anormales dans un diff (changements >ANOMALY_THRESHOLD_PCT).
 *
 * Indexation typique : 2-3% / an. Au-delà de 20%, c'est suspect.
 * Au-delà de 50%, c'est probablement une erreur de parsing.
 *
 * Retourne des alertes prêtes à être ajoutées à BaremeFile.alerts.
 */
export function detectAnomaliesFromDiff(diff: BaremeDiff): BaremeAlert[] {
  const alerts: BaremeAlert[] = []
  const suspects: AmountChange[] = []
  const critical: AmountChange[] = []

  for (const change of diff.changes) {
    if (change.type !== 'amount_changed') continue
    if (change.oldValue === 0) continue
    const pct = Math.abs((change.newValue - change.oldValue) / change.oldValue) * 100
    if (pct >= ANOMALY_ERROR_THRESHOLD_PCT) {
      critical.push(change)
    } else if (pct >= ANOMALY_THRESHOLD_PCT) {
      suspects.push(change)
    }
  }

  if (critical.length > 0) {
    alerts.push({
      level: 'error',
      message: `${critical.length} variation(s) >${ANOMALY_ERROR_THRESHOLD_PCT}% détectée(s) — ${critical
        .slice(0, 5)
        .map((c) => `${c.key} (${c.oldValue.toFixed(2)} → ${c.newValue.toFixed(2)})`)
        .join(', ')}${critical.length > 5 ? '…' : ''}`,
    })
  }

  if (suspects.length > 0) {
    alerts.push({
      level: 'warn',
      message: `${suspects.length} variation(s) >${ANOMALY_THRESHOLD_PCT}% à vérifier — ${suspects
        .slice(0, 5)
        .map(
          (c) =>
            `${c.key} (${c.oldValue.toFixed(2)} → ${c.newValue.toFixed(2)}, ${pctDelta(c).toFixed(1)}%)`
        )
        .join(', ')}${suspects.length > 5 ? '…' : ''}`,
    })
  }

  return alerts
}

function pctDelta(c: AmountChange): number {
  if (c.oldValue === 0) return 0
  return ((c.newValue - c.oldValue) / c.oldValue) * 100
}

export const ANOMALY_THRESHOLDS = {
  warn: ANOMALY_THRESHOLD_PCT,
  error: ANOMALY_ERROR_THRESHOLD_PCT,
}

function areAmountsEqual(a: number, b: number): boolean {
  // Comparaison au centime près (4 décimales en DB)
  return Math.abs(a - b) < 0.00005
}
