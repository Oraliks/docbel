// Active l'extension pg_trgm et crée les index GIN pour fuzzy search performant
// sur LookupEntry. À lancer une fois après le seed initial.
//
// Usage: pnpm exec dotenv -e .env.local -- tsx scripts/setup-lookup-trgm.ts

import { prisma } from '@/lib/prisma'

async function main() {
  console.log('Setup pg_trgm pour LookupEntry...')

  // 1. Activer l'extension pg_trgm si pas déjà fait
  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`)
  console.log('  ✓ Extension pg_trgm activée')

  // 2. Créer les index GIN sur les colonnes texte (code, labelFr, labelNl, labelDe, labelEn)
  //    Utilise gin_trgm_ops pour recherche fuzzy avec ILIKE %query% performante.
  const indexes = [
    {
      name: 'lookup_entry_code_trgm_idx',
      sql: `CREATE INDEX IF NOT EXISTS lookup_entry_code_trgm_idx ON "LookupEntry" USING gin (code gin_trgm_ops);`,
    },
    {
      name: 'lookup_entry_labelfr_trgm_idx',
      sql: `CREATE INDEX IF NOT EXISTS lookup_entry_labelfr_trgm_idx ON "LookupEntry" USING gin ("labelFr" gin_trgm_ops);`,
    },
    {
      name: 'lookup_entry_labelnl_trgm_idx',
      sql: `CREATE INDEX IF NOT EXISTS lookup_entry_labelnl_trgm_idx ON "LookupEntry" USING gin ("labelNl" gin_trgm_ops);`,
    },
    {
      name: 'lookup_entry_labelde_trgm_idx',
      sql: `CREATE INDEX IF NOT EXISTS lookup_entry_labelde_trgm_idx ON "LookupEntry" USING gin ("labelDe" gin_trgm_ops);`,
    },
    {
      name: 'lookup_entry_labelen_trgm_idx',
      sql: `CREATE INDEX IF NOT EXISTS lookup_entry_labelen_trgm_idx ON "LookupEntry" USING gin ("labelEn" gin_trgm_ops);`,
    },
  ]

  for (const idx of indexes) {
    await prisma.$executeRawUnsafe(idx.sql)
    console.log(`  ✓ Index ${idx.name}`)
  }

  console.log('\nTerminé. Recherche fuzzy via pg_trgm activée.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
