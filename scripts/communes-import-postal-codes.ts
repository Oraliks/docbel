// Peuple la table PostalCode depuis le lookup ONEM parametres-onem-cp (1298 CPs).
// Chaque entrée du lookup = 1 CP avec son Code INS principal → Commune.
//
// Usage : pnpm exec dotenv -e .env.local -- tsx scripts/communes-import-postal-codes.ts --yes

import { prisma } from '@/lib/prisma'

const APPLY = process.argv.includes('--yes')

async function main() {
  console.log(`Mode : ${APPLY ? '🔥 APPLY' : '👀 DRY RUN'}\n`)

  const entries = await prisma.lookupEntry.findMany({
    where: { table: { slug: 'parametres-onem-cp' } },
    select: { code: true, labelFr: true },
  })
  console.log(`${entries.length} CPs dans lookup parametres-onem-cp`)

  const communes = await prisma.commune.findMany({ select: { id: true, insCode: true } })
  const byIns = new Map(communes.map((c) => [c.insCode, c.id]))
  console.log(`${communes.length} communes en DB`)

  const existing = await prisma.postalCode.findMany({ select: { code: true } })
  const existingSet = new Set(existing.map((p) => p.code))

  type Action = { code: string; communeId: string; isNew: boolean }
  const actions: Action[] = []
  let skipsNoIns = 0
  let skipsNoCommune = 0

  for (const e of entries) {
    const ins = e.labelFr.trim()
    if (!ins) {
      skipsNoIns++
      continue
    }
    const communeId = byIns.get(ins)
    if (!communeId) {
      skipsNoCommune++
      continue
    }
    actions.push({ code: e.code, communeId, isNew: !existingSet.has(e.code) })
  }

  const creates = actions.filter((a) => a.isNew).length
  const updates = actions.length - creates
  console.log(`  ${updates} updates, ${creates} créations`)
  console.log(`  ${skipsNoIns} skips (pas d'INS), ${skipsNoCommune} skips (commune introuvable)`)

  if (!APPLY) return console.log('\nDry-run. Passe --yes pour appliquer.')

  console.log('\n🔥 Application…')
  let done = 0
  for (const a of actions) {
    await prisma.postalCode.upsert({
      where: { code: a.code },
      create: { code: a.code, communeId: a.communeId },
      update: { communeId: a.communeId },
    })
    done++
    if (done % 100 === 0) process.stdout.write(`\r  ${done}/${actions.length}`)
  }
  process.stdout.write(`\r  ${done}/${actions.length}\n✓ Done\n`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
