// Complète la table PostalCode en extrayant les paires (CP, insCode) depuis
// la lookup ONEM `code-rue` (déjà peuplée via import BeStAddress).
//
// Chaque entrée de code-rue a un metadata.Code postal + Code NIS commune.
// On agrège distinct, on upsert dans PostalCode en liant à Commune par insCode.
//
// Source unique de vérité : la table code-rue (BeStAddress / lookup ONEM).
// Couverture attendue : 100% des CP belges puisque toutes les rues belges
// sont dans BeStAddress.
//
// Usage :
//   pnpm tsx scripts/postal-codes-from-bestaddress.ts            (dry-run)
//   pnpm tsx scripts/postal-codes-from-bestaddress.ts --yes      (applique)

import { prisma } from '@/lib/prisma'

const APPLY = process.argv.includes('--yes')

async function main() {
  console.log(`Mode : ${APPLY ? '🔥 APPLY' : '👀 DRY RUN'}\n`)

  // 1) Trouve la lookup table code-rue
  const rueTable = await prisma.lookupTable.findFirst({
    where: { slug: { contains: 'rue' } },
    select: { id: true, slug: true, _count: { select: { entries: true } } },
  })
  if (!rueTable) {
    console.log('⚠ Aucune lookup table contenant "rue" trouvée. Abandon.')
    return
  }
  console.log(`Table source : ${rueTable.slug} (${rueTable._count.entries} entrées)\n`)

  // 2) Agrège les paires distinctes (postcode, insCode) via raw SQL
  //    plus rapide que findMany sur 144k lignes.
  const pairs = await prisma.$queryRaw<{ postcode: string; ins: string }[]>`
    SELECT DISTINCT
      metadata->>'Code postal' AS postcode,
      metadata->>'Code NIS commune' AS ins
    FROM "LookupEntry"
    WHERE "tableId" = ${rueTable.id}
      AND metadata->>'Code postal' ~ '^[0-9]{4}$'
      AND metadata->>'Code NIS commune' IS NOT NULL
  `
  console.log(`Pairs distinctes extraites : ${pairs.length}`)

  // 3) Précharge les communes par insCode
  const communes = await prisma.commune.findMany({
    select: { id: true, insCode: true, nameFr: true },
  })
  const byIns = new Map(communes.map((c) => [c.insCode, c]))
  console.log(`Communes en DB : ${communes.size ?? communes.length}\n`)

  // 4) Précharge les PostalCode existants (PK = code, pas d'id séparé)
  const existing = await prisma.postalCode.findMany({
    select: { code: true, communeId: true },
  })
  const existingByCode = new Map(existing.map((p) => [p.code, p]))
  console.log(`PostalCode existants : ${existing.length}\n`)

  // 5) Upsert
  let created = 0
  let updated = 0
  let skipsNoCommune = 0
  for (const p of pairs) {
    const commune = byIns.get(p.ins)
    if (!commune) {
      skipsNoCommune++
      continue
    }
    const ex = existingByCode.get(p.postcode)
    if (ex) {
      if (ex.communeId === commune.id) continue // déjà à jour
      if (APPLY) {
        await prisma.postalCode.update({
          where: { code: p.postcode },
          data: { communeId: commune.id },
        })
      }
      updated++
    } else {
      if (APPLY) {
        await prisma.postalCode.create({
          data: { code: p.postcode, communeId: commune.id },
        })
      }
      created++
    }
  }

  console.log(`${APPLY ? '✓ Résultat :' : 'À traiter :'}`)
  console.log(`  ${created} créés`)
  console.log(`  ${updated} mis à jour (re-link à une autre commune)`)
  console.log(`  ${skipsNoCommune} skipped (insCode pas dans Commune)`)
  if (!APPLY) console.log('\nDry-run. Passe --yes pour appliquer.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
