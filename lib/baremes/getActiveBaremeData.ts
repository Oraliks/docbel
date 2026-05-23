import { prisma, withDbRetry } from '@/lib/prisma'
import type { BaremeCategory } from './types'
import { resolveLabelFr } from './labels'

export interface ActiveBaremeAmount {
  id: string
  sourceSheet: string
  category: BaremeCategory
  allocationCode: string | null
  salaryCode: string | null
  article: string | null
  labelFr: string | null
  labelNl: string | null
  unit: string | null
  amount: number
  minDailySalary: number | null
  maxDailySalary: number | null
  validFrom: Date | null
  comparisonKey: string
}

export interface ActiveBaremeData {
  fileId: string
  fileName: string
  validFrom: Date | null
  publishedAt: Date | null
  amountsByCategory: Partial<Record<BaremeCategory, ActiveBaremeAmount[]>>
  allAmounts: ActiveBaremeAmount[]
}

interface CacheEntry {
  data: ActiveBaremeData | null
  cachedAt: number
}

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
let cache: CacheEntry | null = null

/**
 * Récupère les BaremeAmount du dernier import publié (status="published"),
 * triés par validFrom desc. Les calculateurs et pages info doivent utiliser
 * cette fonction comme source de vérité.
 *
 * Mise en cache mémoire (5 min, invalidé à chaque publish/reject via
 * invalidateActiveBaremeCache). En cas de besoin temps réel, passer force=true.
 */
export async function getActiveBaremeData(
  options: { force?: boolean } = {}
): Promise<ActiveBaremeData | null> {
  if (!options.force && cache && Date.now() - cache.cachedAt < CACHE_TTL_MS) {
    return cache.data
  }

  const file = await withDbRetry(() =>
    prisma.baremeFile.findFirst({
      where: { status: 'published' },
      orderBy: [{ validFrom: 'desc' }, { publishedAt: 'desc' }],
      select: {
        id: true,
        name: true,
        validFrom: true,
        publishedAt: true,
      },
    })
  )

  if (!file) {
    cache = { data: null, cachedAt: Date.now() }
    return null
  }

  const amounts = await withDbRetry(() =>
    prisma.baremeAmount.findMany({
      where: { fileId: file.id },
      orderBy: [{ category: 'asc' }, { allocationCode: 'asc' }, { salaryCode: 'asc' }],
    })
  )

  const allAmounts: ActiveBaremeAmount[] = amounts.map((a) => ({
    id: a.id,
    sourceSheet: a.sourceSheet,
    category: a.category as BaremeCategory,
    allocationCode: a.allocationCode,
    salaryCode: a.salaryCode,
    article: a.article,
    // Enrichissement labelFr depuis le mapping statique (lib/data/baremes-labels-fr.json)
    // si le fichier source n'a pas de label FR (typique pour Basisbedragen NL-only).
    labelFr: resolveLabelFr({
      comparisonKey: a.comparisonKey,
      article: a.article,
      category: a.category,
      existingLabelFr: a.labelFr,
    }),
    labelNl: a.labelNl,
    unit: a.unit,
    amount: a.amount.toNumber(),
    minDailySalary: a.minDailySalary ? a.minDailySalary.toNumber() : null,
    maxDailySalary: a.maxDailySalary ? a.maxDailySalary.toNumber() : null,
    validFrom: a.validFrom,
    comparisonKey: a.comparisonKey,
  }))

  const amountsByCategory: Partial<Record<BaremeCategory, ActiveBaremeAmount[]>> = {}
  for (const amount of allAmounts) {
    const list = amountsByCategory[amount.category] ?? []
    list.push(amount)
    amountsByCategory[amount.category] = list
  }

  const data: ActiveBaremeData = {
    fileId: file.id,
    fileName: file.name,
    validFrom: file.validFrom,
    publishedAt: file.publishedAt,
    amountsByCategory,
    allAmounts,
  }

  cache = { data, cachedAt: Date.now() }
  return data
}

/**
 * Vide le cache mémoire. À appeler après chaque publish/reject pour que
 * la fonction renvoie immédiatement la version à jour.
 */
export function invalidateActiveBaremeCache(): void {
  cache = null
}

/**
 * Lookup ciblé : retrouve un montant d'allocation chômage plein temps par
 * code allocation + code tranche salariale. Utilisé par les calculateurs.
 *
 * Retourne null si aucun import publié ou code non trouvé.
 */
export async function lookupAllocationAmount(
  allocationCode: string,
  salaryCode: string
): Promise<ActiveBaremeAmount | null> {
  const data = await getActiveBaremeData()
  if (!data) return null
  const list = data.amountsByCategory.full_unemployment ?? []
  return (
    list.find(
      (a) => a.allocationCode === allocationCode && a.salaryCode === salaryCode.toUpperCase()
    ) ?? null
  )
}

/**
 * Lookup ciblé : retrouve une tranche salariale par code numérique.
 */
export async function lookupSalaryBracket(
  salaryCode: number | string
): Promise<ActiveBaremeAmount | null> {
  const data = await getActiveBaremeData()
  if (!data) return null
  const code = String(salaryCode)
  const list = data.amountsByCategory.salary_bracket ?? []
  return list.find((a) => a.salaryCode === code) ?? null
}
