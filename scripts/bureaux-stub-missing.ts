// Crée des "stubs" CPAS + Maison communale pour les communes qui n'en ont
// PAS encore en DB. Garantit que /outils/bureaux retourne TOUJOURS un
// résultat — l'admin/user peut ensuite signaler une erreur pour qu'on
// complète l'adresse exacte.
//
// Stratégie :
//   - Pour chaque commune sans bureau type=CPAS → crée un stub :
//       name      = "CPAS de {nameFr}"
//       street    = "Adresse à confirmer"
//       lat/lng   = commune.lat/lng (centroïde)
//       hours     = [] (pas d'horaires défaut, comme c'est variable)
//       organisme = "cpas"
//   - Idem pour COMMUNE : "Maison communale de {nameFr}"
//
// Quand un re-import OSM trouvera l'adresse réelle, il faudra mettre à jour
// le stub (matcher par communeId + type). Pour l'instant le script Overpass
// crée des doublons — à upserter dans un commit séparé.
//
// Usage :
//   pnpm tsx scripts/bureaux-stub-missing.ts            (dry-run)
//   pnpm tsx scripts/bureaux-stub-missing.ts --yes      (applique)
//   pnpm tsx scripts/bureaux-stub-missing.ts --yes --cpas-only
//   pnpm tsx scripts/bureaux-stub-missing.ts --yes --commune-only

import { prisma } from '@/lib/prisma'

const APPLY = process.argv.includes('--yes')
const CPAS_ONLY = process.argv.includes('--cpas-only')
const COMMUNE_ONLY = process.argv.includes('--commune-only')

const STUB_NOTE =
  'Coordonnées génériques (centre de la commune) — adresse exacte à confirmer.'

async function ensureOrganisme(code: string, name: string) {
  return prisma.organisme.upsert({
    where: { code },
    update: {},
    create: { code, name, type: 'local', active: true, color: '#7c3aed', order: 0 },
  })
}

async function stubCpas() {
  console.log('═══ Stubs CPAS ═══')
  const orgCpas = await ensureOrganisme('cpas', 'CPAS')

  const communes = await prisma.commune.findMany({
    where: { bureaus: { none: { type: 'CPAS' } } },
    select: { id: true, insCode: true, nameFr: true, lat: true, lng: true, postalCodes: { select: { code: true }, take: 1 } },
  })
  console.log(`${communes.length} communes sans CPAS`)
  let created = 0
  for (const c of communes) {
    const cp = c.postalCodes[0]?.code ?? '0000'
    if (APPLY) {
      await prisma.bureau.create({
        data: {
          organismeId: orgCpas.id,
          type: 'CPAS',
          name: `CPAS de ${c.nameFr}`,
          street: 'Adresse à confirmer',
          streetNum: null,
          postalCode: cp,
          city: c.nameFr,
          lat: c.lat,
          lng: c.lng,
          communeId: c.id,
          hours: [],
          hoursNotes: STUB_NOTE,
          notes: 'Stub auto-généré — adresse à compléter',
        },
      })
    }
    created++
    if (created <= 10) console.log(`  + CPAS de ${c.nameFr}`)
  }
  console.log(`${APPLY ? '✓ Créé' : 'À créer'} : ${created} stubs CPAS`)
}

async function stubCommune() {
  console.log('\n═══ Stubs Maison communale ═══')
  const orgCommune = await ensureOrganisme('commune', 'Commune')

  const communes = await prisma.commune.findMany({
    where: { bureaus: { none: { type: 'COMMUNE' } } },
    select: { id: true, insCode: true, nameFr: true, lat: true, lng: true, postalCodes: { select: { code: true }, take: 1 } },
  })
  console.log(`${communes.length} communes sans Maison communale`)
  let created = 0
  for (const c of communes) {
    const cp = c.postalCodes[0]?.code ?? '0000'
    if (APPLY) {
      await prisma.bureau.create({
        data: {
          organismeId: orgCommune.id,
          type: 'COMMUNE',
          name: `Maison communale de ${c.nameFr}`,
          street: 'Adresse à confirmer',
          streetNum: null,
          postalCode: cp,
          city: c.nameFr,
          lat: c.lat,
          lng: c.lng,
          communeId: c.id,
          hours: [],
          hoursNotes: STUB_NOTE,
          notes: 'Stub auto-généré — adresse à compléter',
        },
      })
    }
    created++
    if (created <= 10) console.log(`  + Maison communale de ${c.nameFr}`)
  }
  console.log(`${APPLY ? '✓ Créé' : 'À créer'} : ${created} stubs COMMUNE`)
}

async function main() {
  console.log(`Mode : ${APPLY ? '🔥 APPLY' : '👀 DRY RUN'}\n`)
  if (!COMMUNE_ONLY) await stubCpas()
  if (!CPAS_ONLY) await stubCommune()
  if (!APPLY) console.log('\nDry-run. Passe --yes pour appliquer.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
