import { NextResponse } from 'next/server'
import { prisma, withDbRetry } from '@/lib/prisma'
import { requirePartnerOrAdminAuth } from '@/lib/auth-check'
import { privateLookupError, toLookupTableProjection } from '@/lib/lookup/projections'

export const runtime = 'nodejs'
const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' }

/**
 * Liste toutes les tables de lookup avec leur catégorie + métadonnées.
 * Pas d'auth requise (lecture publique).
 */
export async function GET() {
  const auth = await requirePartnerOrAdminAuth()
  if (!auth.isAuthorized) return privateLookupError(auth.error)

  try {
  const categories = await withDbRetry(() =>
    prisma.lookupCategory.findMany({
      orderBy: { order: 'asc' },
      take: 100,
      include: {
        tables: {
          orderBy: [{ group: 'asc' }, { labelFr: 'asc' }],
          take: 500,
          select: {
            id: true,
            slug: true,
            prefix: true,
            labelFr: true,
            labelNl: true,
            group: true,
            sourcePath: true,
            entriesCount: true,
            lastImportedAt: true,
            updatedLabel: true,
          },
        },
      },
    })
  )

  const safeCategories = categories.map((category) => ({
    slug: category.slug,
    labelFr: category.labelFr,
    labelNl: category.labelNl,
    tables: category.tables.map((table) => ({
      ...toLookupTableProjection({
        ...table,
        category: { slug: category.slug, labelFr: category.labelFr, labelNl: category.labelNl },
      }),
      lastImportedAt: table.lastImportedAt,
    })),
  }))
  return NextResponse.json({ categories: safeCategories }, {
    headers: { ...jsonHeaders, 'Cache-Control': 'private, no-store' },
  })
  } catch (err) {
    console.error('[lookup/tables] error:', err)
    return NextResponse.json({ error: 'Erreur de chargement' }, {
      status: 500,
      headers: { ...jsonHeaders, 'Cache-Control': 'private, no-store' },
    })
  }
}
