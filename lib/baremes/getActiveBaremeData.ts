import type { BaremeAmount, BaremeFile } from '@prisma/client'
import { prisma, withDbRetry } from '@/lib/prisma'
import type { BaremeCategory } from './types'
import { resolveLabelFr } from './labels'
import { brusselsCalendarDay, parseCalendarDate } from './calendar-date'

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
  /** Taux d'indemnisation (0.65 / 0.60) si présent — pour les colonnes à variantes. */
  rate: number | null
}

export interface ActiveBaremeData {
  fileId: string
  fileName: string
  validFrom: Date | null
  publishedAt: Date | null
  /** Multiplicateur (index) du fichier — affiché sur les pages de consultation. */
  multiplicateur: number | null
  amountsByCategory: Partial<Record<BaremeCategory, ActiveBaremeAmount[]>>
  allAmounts: ActiveBaremeAmount[]
}

interface CacheEntry {
  data: ActiveBaremeData
  revision: string
  cachedAt: number
}

const CACHE_TTL_MS = 5 * 60 * 1000
const MAX_CACHED_DATES = 32
const AMOUNTS_PAGE_SIZE = 1000
const FILES_PAGE_SIZE = 32
const cacheByDate = new Map<string, CacheEntry>()
let cacheGeneration = 0
const ONEM_RATES_FILE_TYPE = 'onem-rates'

function cacheAmounts(day: string, entry: CacheEntry): void {
  for (const [key, cached] of cacheByDate) {
    if (entry.cachedAt - cached.cachedAt >= CACHE_TTL_MS) cacheByDate.delete(key)
  }
  cacheByDate.delete(day)
  cacheByDate.set(day, entry)
  while (cacheByDate.size > MAX_CACHED_DATES) {
    const oldest = cacheByDate.keys().next().value
    if (oldest === undefined) break
    cacheByDate.delete(oldest)
  }
}


type PublicationCoordinate = Pick<BaremeFile, 'id' | 'validFrom' | 'publishedAt'>
interface RollbackBoundary {
  target: PublicationCoordinate
  occurredAt: Date
}
interface RollbackHistory {
  boundaries: RollbackBoundary[]
  restoredAt: Map<string, number>
}

/**
 * Les anciens rollbacks n'archivaient que le courant : les archives intermédiaires
 * restent marquées "replaced_by". La trace du retour vers la cible leur donne la
 * même frontière de retrait que le workflow actuel, sans réécrire l'historique.
 */
async function readRollbackHistory(readAt: Date): Promise<RollbackHistory | null> {
  const boundaries: RollbackBoundary[] = []
  const restoredAt = new Map<string, number>()
  let cursor: string | undefined
  for (;;) {
    const page = await withDbRetry(() =>
      prisma.baremePublicationLog.findMany({
        where: {
          file: { fileType: ONEM_RATES_FILE_TYPE },
          createdAt: { lte: readAt },
          OR: [
            { action: 'rollback' },
            { action: 'archived', details: { path: ['reason'], equals: 'rolled_back_to' } },
          ],
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: FILES_PAGE_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
          id: true,
          action: true,
          createdAt: true,
          details: true,
          file: { select: { id: true, validFrom: true, publishedAt: true } },
        },
      })
    )
    const targetIds = [...new Set(page.flatMap((event) => {
      if (event.action === 'rollback') return []
      const details = event.details as { rolledBackToId?: unknown } | null
      return typeof details?.rolledBackToId === 'string' ? [details.rolledBackToId] : []
    }))]
    const targets = targetIds.length === 0 ? [] : await withDbRetry(() =>
      prisma.baremeFile.findMany({
        where: { id: { in: targetIds }, fileType: ONEM_RATES_FILE_TYPE },
        take: FILES_PAGE_SIZE,
        select: { id: true, validFrom: true, publishedAt: true },
      })
    )
    for (const event of page) {
      const details = event.details as { rolledBackToId?: unknown } | null
      const target = event.action === 'rollback'
        ? event.file
        : targets.find((candidate) => candidate.id === details?.rolledBackToId)
      // Une trace explicite mais inexploitable ne permet pas de choisir un
      // intermédiaire au hasard. L'admin doit rendre cette provenance vérifiable.
      if (!target?.validFrom || !target.publishedAt || target.publishedAt > readAt) return null
      boundaries.push({ target, occurredAt: event.createdAt })
      restoredAt.set(target.id, Math.max(restoredAt.get(target.id) ?? 0, event.createdAt.getTime()))
    }
    if (page.length < FILES_PAGE_SIZE) break
    cursor = page[page.length - 1].id
  }
  return { boundaries, restoredAt }
}

function wasWithdrawnByRollback(candidate: PublicationCoordinate, history: RollbackHistory): boolean {
  if (!candidate.validFrom || !candidate.publishedAt) return true
  const releasedAt = Math.max(candidate.publishedAt.getTime(), history.restoredAt.get(candidate.id) ?? 0)
  return history.boundaries.some(({ target, occurredAt }) => {
    if (candidate.id === target.id || releasedAt > occurredAt.getTime()) return false
    // Le workflow ancien écrasait publishedAt à chaque restauration. Si la cible
    // a été restaurée plus tard, sa date actuelle ne doit pas déplacer ce retrait.
    const targetPublishedAt = Math.min(target.publishedAt!.getTime(), occurredAt.getTime())
    const validityOrder = candidate.validFrom!.getTime() - target.validFrom!.getTime()
    return validityOrder > 0 || (validityOrder === 0 && (
      candidate.publishedAt!.getTime() > targetPublishedAt
      || (candidate.publishedAt!.getTime() === targetPublishedAt && candidate.id > target.id)
    ))
  })
}

/**
 * Restitue la version ONEM applicable au jour civil demandé parmi les publications
 * actuellement connues. Une publication rétrospective peut donc corriger l'historique :
 * `asOf` ne simule pas ce que DocBel connaissait à cette époque.
 *
 * Les versions remplacées restent admissibles ; brouillons, rejets, retraits et
 * archives sans preuve de publication sont exclus. Sans couverture, retourne null.
 * Le schéma n'a pas de validTo : une version vaut jusqu'à la date d'effet suivante.
 *
 * La petite sélection de métadonnées est relue à chaque appel pour propager les
 * publications/rollbacks entre instances. Seuls les montants sont mis en cache,
 * par jour et révision, 5 minutes et 32 jours au maximum. force renouvelle ce cache.
 */
export async function getActiveBaremeData(
  options: { force?: boolean; asOf?: string; now?: Date } = {}
): Promise<ActiveBaremeData | null> {
  const readAt = new Date()
  const day = options.asOf ?? brusselsCalendarDay(options.now ?? readAt)
  const effectiveDate = parseCalendarDate(day)
  if (!effectiveDate || day > brusselsCalendarDay(readAt)) return null
  const generation = cacheGeneration
  const rollbackHistory = await readRollbackHistory(readAt)
  if (!rollbackHistory) {
    cacheByDate.delete(day)
    return null
  }

  // Lecture paginée des seules métadonnées. Les anciens rollbacks écrivaient
  // "archived" ; leur dernière trace d'archivage permet de reconnaître le retrait
  // sans modifier les données historiques.
  let file: Pick<BaremeFile, 'id' | 'name' | 'validFrom' | 'publishedAt' | 'updatedAt' | 'multiplicateur'> | null = null
  let fileCursor: string | undefined
  for (;;) {
    const page = await withDbRetry(() =>
      prisma.baremeFile.findMany({
        where: {
          status: { in: ['published', 'archived'] },
          fileType: ONEM_RATES_FILE_TYPE,
          validFrom: { lte: effectiveDate },
          // L'instant réel de publication est distinct de la date d'effet.
          publishedAt: { not: null, lte: readAt },
        },
        orderBy: [{ validFrom: 'desc' }, { publishedAt: 'desc' }, { id: 'desc' }],
        take: FILES_PAGE_SIZE,
        ...(fileCursor ? { cursor: { id: fileCursor }, skip: 1 } : {}),
        select: {
          id: true,
          status: true,
          name: true,
          validFrom: true,
          publishedAt: true,
          updatedAt: true,
          multiplicateur: true,
          publications: {
            where: { action: { in: ['archived', 'revoked'] } },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: 1,
            select: { action: true, details: true, createdAt: true },
          },
        },
      })
    )
    file = page.find((candidate) => {
      if (wasWithdrawnByRollback(candidate, rollbackHistory)) return false
      if (candidate.status === 'published') return true
      const archive = candidate.publications[0]
      const details = archive?.details as { reason?: string } | null | undefined
      const releasedAt = Math.max(candidate.publishedAt?.getTime() ?? 0, rollbackHistory.restoredAt.get(candidate.id) ?? 0)
      const withdrawal = archive?.action === 'revoked' || details?.reason === 'rolled_back_to'
      return !withdrawal || (archive?.createdAt?.getTime() ?? Number.POSITIVE_INFINITY) < releasedAt
    }) ?? null
    if (file || page.length < FILES_PAGE_SIZE) break
    fileCursor = page[page.length - 1].id
  }
  if (!file) {
    cacheByDate.delete(day)
    return null
  }

  const revision = `${file.id}:${file.updatedAt.toISOString()}`
  const cached = cacheByDate.get(day)
  if (!options.force && cached?.revision === revision
    && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    // L'ordre d'insertion sert de LRU, sans prolonger la durée de vie.
    cacheByDate.delete(day)
    cacheByDate.set(day, cached)
    return cached.data
  }

  const amounts: BaremeAmount[] = []
  let cursor: string | undefined
  for (;;) {
    const page: BaremeAmount[] = await withDbRetry(() =>
      prisma.baremeAmount.findMany({
        where: {
          fileId: file.id,
          OR: [{ validFrom: null }, { validFrom: { lte: effectiveDate } }],
        },
        orderBy: [{ category: 'asc' }, { allocationCode: 'asc' }, { salaryCode: 'asc' }, { id: 'asc' }],
        take: AMOUNTS_PAGE_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      })
    )
    amounts.push(...page)
    if (page.length < AMOUNTS_PAGE_SIZE) break
    cursor = page[page.length - 1].id
  }

  const allAmounts: ActiveBaremeAmount[] = amounts.map((amount) => {
    const raw = (amount.rawData ?? {}) as { trace?: { rate?: number | null } }
    return {
      id: amount.id,
      sourceSheet: amount.sourceSheet,
      category: amount.category as BaremeCategory,
      allocationCode: amount.allocationCode,
      salaryCode: amount.salaryCode,
      article: amount.article,
      labelFr: resolveLabelFr({
        comparisonKey: amount.comparisonKey,
        article: amount.article,
        category: amount.category,
        existingLabelFr: amount.labelFr,
      }),
      labelNl: amount.labelNl,
      unit: amount.unit,
      amount: amount.amount.toNumber(),
      minDailySalary: amount.minDailySalary?.toNumber() ?? null,
      maxDailySalary: amount.maxDailySalary?.toNumber() ?? null,
      validFrom: amount.validFrom,
      comparisonKey: amount.comparisonKey,
      rate: raw.trace?.rate ?? null,
    }
  })

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
    multiplicateur: file.multiplicateur,
    amountsByCategory,
    allAmounts,
  }

  // Une lecture commencée avant une invalidation ne doit pas remplir son cache.
  if (generation === cacheGeneration) {
    cacheAmounts(day, { data, revision, cachedAt: Date.now() })
  }
  return data
}

/** À appeler après publication ou rollback ; toutes les dates sont invalidées. */
export function invalidateActiveBaremeCache(): void {
  cacheGeneration++
  cacheByDate.clear()
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

/** Lookup ciblé : retrouve une tranche salariale par code numérique. */
export async function lookupSalaryBracket(
  salaryCode: number | string
): Promise<ActiveBaremeAmount | null> {
  const data = await getActiveBaremeData()
  if (!data) return null
  const code = String(salaryCode)
  const list = data.amountsByCategory.salary_bracket ?? []
  return list.find((a) => a.salaryCode === code) ?? null
}
