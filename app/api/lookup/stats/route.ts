import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/auth-check'
import { prisma, withDbRetry } from '@/lib/prisma'

export const runtime = 'nodejs'
const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' }

/**
 * Stats globales du lookup : volumes, couverture multilingue, tendances.
 */
export async function GET() {
  const auth = await requireAdminAuth()
  if (!auth.isAuthorized) return auth.error

  const [
    totalCategories,
    totalTables,
    totalEntries,
    fedTables,
    withFr,
    withNl,
    withDe,
    withEn,
    recentImports,
    topTables,
  ] = await Promise.all([
    withDbRetry(() => prisma.lookupCategory.count()),
    withDbRetry(() => prisma.lookupTable.count()),
    withDbRetry(() => prisma.lookupEntry.count()),
    withDbRetry(() => prisma.lookupTable.count({ where: { entriesCount: { gt: 0 } } })),
    withDbRetry(() => prisma.lookupEntry.count({ where: { labelFr: { not: '' } } })),
    withDbRetry(() => prisma.lookupEntry.count({ where: { labelNl: { not: '' } } })),
    withDbRetry(() => prisma.lookupEntry.count({ where: { labelDe: { not: null } } })),
    withDbRetry(() => prisma.lookupEntry.count({ where: { labelEn: { not: null } } })),
    withDbRetry(() =>
      prisma.lookupTable.findMany({
        where: { lastImportedAt: { not: null } },
        orderBy: { lastImportedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          labelFr: true,
          lastImportedAt: true,
          lastImportedBy: true,
          entriesCount: true,
          category: { select: { labelFr: true } },
        },
      })
    ),
    withDbRetry(() =>
      prisma.lookupTable.findMany({
        orderBy: { entriesCount: 'desc' },
        take: 10,
        select: {
          id: true,
          labelFr: true,
          entriesCount: true,
          category: { select: { labelFr: true } },
        },
      })
    ),
  ])

  // Couverture par catégorie
  const categories = await withDbRetry(() =>
    prisma.lookupCategory.findMany({
      include: {
        tables: {
          select: { entriesCount: true },
        },
      },
      orderBy: { order: 'asc' },
    })
  )
  const coverageByCategory = categories.map((cat) => ({
    slug: cat.slug,
    labelFr: cat.labelFr,
    totalTables: cat.tables.length,
    fedTables: cat.tables.filter((t) => t.entriesCount > 0).length,
    totalEntries: cat.tables.reduce((sum, t) => sum + t.entriesCount, 0),
  }))

  return NextResponse.json(
    {
      generatedAt: new Date(),
      counts: {
        categories: totalCategories,
        tables: totalTables,
        entries: totalEntries,
        fedTables,
        emptyTables: totalTables - fedTables,
      },
      languageCoverage: {
        fr: { count: withFr, percent: totalEntries > 0 ? (withFr / totalEntries) * 100 : 0 },
        nl: { count: withNl, percent: totalEntries > 0 ? (withNl / totalEntries) * 100 : 0 },
        de: { count: withDe, percent: totalEntries > 0 ? (withDe / totalEntries) * 100 : 0 },
        en: { count: withEn, percent: totalEntries > 0 ? (withEn / totalEntries) * 100 : 0 },
      },
      coverageByCategory,
      recentImports,
      topTables,
    },
    { headers: jsonHeaders }
  )
}
