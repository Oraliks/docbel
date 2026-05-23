import { NextResponse } from 'next/server'
import { prisma, withDbRetry } from '@/lib/prisma'

export const runtime = 'nodejs'
const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' }

/**
 * Liste toutes les tables de lookup avec leur catégorie + métadonnées.
 * Pas d'auth requise (lecture publique).
 */
export async function GET() {
  const categories = await withDbRetry(() =>
    prisma.lookupCategory.findMany({
      orderBy: { order: 'asc' },
      include: {
        tables: {
          orderBy: [{ group: 'asc' }, { labelFr: 'asc' }],
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
          },
        },
      },
    })
  )

  return NextResponse.json({ categories }, { headers: jsonHeaders })
}
