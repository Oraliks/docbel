// Seed des catégories + tables du lookup ONEM (sans les entrées).
// Idempotent : upsert par slug. Préserve les LookupEntry existantes.
// Usage: pnpm exec tsx scripts/seed-lookup-onem.ts

import { prisma } from '@/lib/prisma'
import seedData from '@/lib/data/lookup-onem-seed.json'
import autoSeedData from '@/lib/data/lookup-onem-auto-seed.json'

interface SeedTable {
  group?: string
  prefix: string
  slug: string
  labelFr: string
  labelNl: string
  sourcePath?: string
  exportName?: string
}

interface SeedCategory {
  slug: string
  labelFr: string
  labelNl: string
  order: number
  tables: SeedTable[]
}

async function main() {
  const categories = (seedData as { categories: SeedCategory[] }).categories
  const autoAdditions = (autoSeedData as { additions?: Record<string, SeedTable[]> }).additions ?? {}

  // Fusionner les tables auto-générées dans les catégories existantes
  for (const cat of categories) {
    const extra = autoAdditions[cat.slug] ?? []
    if (extra.length > 0) {
      // On préserve l'ordre : tables existantes en premier, auto-générées ensuite
      cat.tables = [...cat.tables, ...extra]
    }
  }

  let createdCats = 0
  let updatedCats = 0
  let createdTables = 0
  let updatedTables = 0

  for (const cat of categories) {
    const existing = await prisma.lookupCategory.findUnique({ where: { slug: cat.slug } })
    const upsertedCat = await prisma.lookupCategory.upsert({
      where: { slug: cat.slug },
      update: { labelFr: cat.labelFr, labelNl: cat.labelNl, order: cat.order },
      create: {
        slug: cat.slug,
        labelFr: cat.labelFr,
        labelNl: cat.labelNl,
        order: cat.order,
      },
    })
    if (existing) updatedCats++
    else createdCats++

    for (const table of cat.tables) {
      const existingT = await prisma.lookupTable.findUnique({
        where: {
          categoryId_slug: { categoryId: upsertedCat.id, slug: table.slug },
        },
      })
      await prisma.lookupTable.upsert({
        where: {
          categoryId_slug: { categoryId: upsertedCat.id, slug: table.slug },
        },
        update: {
          prefix: table.prefix,
          labelFr: table.labelFr,
          labelNl: table.labelNl,
          group: table.group ?? null,
          sourcePath: table.sourcePath ?? null,
          exportName: table.exportName ?? null,
        },
        create: {
          categoryId: upsertedCat.id,
          slug: table.slug,
          prefix: table.prefix,
          labelFr: table.labelFr,
          labelNl: table.labelNl,
          group: table.group ?? null,
          sourcePath: table.sourcePath ?? null,
          exportName: table.exportName ?? null,
        },
      })
      if (existingT) updatedTables++
      else createdTables++
    }
  }

  console.log(
    `Seed lookup ONEM terminé.\n` +
      `  Catégories: ${createdCats} créées, ${updatedCats} mises à jour\n` +
      `  Tables: ${createdTables} créées, ${updatedTables} mises à jour`
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
