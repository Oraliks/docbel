// Patch les communes en DB après un seed REFNIS imparfait :
//
//   1) Région : recalcule selon le CP (le seed mettait tout en 'wallonia'
//      pour les communes sans hiérarchie REFNIS complète, dont les 19
//      bruxelloises). Mapping CP-range :
//        1000-1299 → brussels (19 communes RBC)
//        1300-1499 → wallonia (Brabant wallon)
//        1500-3999 → flanders (Brabant flamand + Anvers + Limbourg)
//        4000-7999 → wallonia (Liège + Namur + Hainaut + Luxembourg)
//        8000-9999 → flanders (Flandre Occidentale + Orientale)
//      (germanophone géré séparément via la liste INS hardcodée du seed)
//
//   2) Lat/lng : pour chaque commune sans coordonnées, fetch Nominatim
//      (1.1s/req par politesse) et update. ~7-8 min pour 421 communes.
//
// Usage :
//   pnpm tsx scripts/communes-fix-region-coords.ts            (dry-run)
//   pnpm tsx scripts/communes-fix-region-coords.ts --yes      (applique)
//   pnpm tsx scripts/communes-fix-region-coords.ts --yes --regions-only
//   pnpm tsx scripts/communes-fix-region-coords.ts --yes --coords-only

import { prisma } from '@/lib/prisma'

const APPLY = process.argv.includes('--yes')
const REGIONS_ONLY = process.argv.includes('--regions-only')
const COORDS_ONLY = process.argv.includes('--coords-only')

const USER_AGENT = 'Beldoc/1.0 (admin import: commune coords; contact: oraliks@github)'

function regionFromCp(cp: string): 'brussels' | 'wallonia' | 'flanders' | null {
  const n = parseInt(cp, 10)
  if (Number.isNaN(n)) return null
  if (n >= 1000 && n <= 1299) return 'brussels'
  if (n >= 1300 && n <= 1499) return 'wallonia'
  if (n >= 1500 && n <= 3999) return 'flanders'
  if (n >= 4000 && n <= 7999) return 'wallonia'
  if (n >= 8000 && n <= 9999) return 'flanders'
  return null
}

async function fixRegions() {
  console.log('═══ Fix régions ═══')
  // On groupe par commune et on regarde tous ses CPs
  const communes = await prisma.commune.findMany({
    select: {
      id: true,
      insCode: true,
      nameFr: true,
      region: true,
      postalCodes: { select: { code: true } },
    },
  })
  let toUpdate = 0
  for (const c of communes) {
    if (c.postalCodes.length === 0) continue
    // Prend la région majoritaire parmi les CPs de la commune
    const counts = new Map<string, number>()
    for (const pc of c.postalCodes) {
      const r = regionFromCp(pc.code)
      if (!r) continue
      counts.set(r, (counts.get(r) ?? 0) + 1)
    }
    if (counts.size === 0) continue
    const correctRegion = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
    // Ne pas écraser les germanophones (qui restent germanophone)
    if (c.region === 'germanophone') continue
    if (c.region === correctRegion) continue
    toUpdate++
    if (APPLY) {
      await prisma.commune.update({
        where: { id: c.id },
        data: { region: correctRegion },
      })
    }
    if (toUpdate <= 20) {
      console.log(`  ${c.insCode} ${c.nameFr.padEnd(28)} ${c.region} → ${correctRegion}`)
    }
  }
  console.log(`${APPLY ? '✓ Mis à jour' : 'À mettre à jour'} : ${toUpdate} communes`)
  if (toUpdate > 20) console.log(`  (${toUpdate - 20} de plus non listées)`)
}

interface NomResult {
  lat: string
  lon: string
}

async function nominatimSearch(name: string, postcode: string | null): Promise<NomResult | null> {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  if (postcode) {
    url.searchParams.set('postalcode', postcode)
  }
  url.searchParams.set('city', name)
  url.searchParams.set('country', 'Belgium')
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', '1')
  try {
    const r = await fetch(url.toString(), { headers: { 'User-Agent': USER_AGENT } })
    if (!r.ok) return null
    const arr = (await r.json()) as NomResult[]
    return arr[0] ?? null
  } catch {
    return null
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function fixCoords() {
  console.log('\n═══ Fix lat/lng (Nominatim, ~1.1s/req) ═══')
  const communes = await prisma.commune.findMany({
    where: { lat: null },
    select: {
      id: true,
      insCode: true,
      nameFr: true,
      nameNl: true,
      postalCodes: { select: { code: true }, take: 1 },
    },
  })
  console.log(`${communes.length} communes sans coords`)
  let ok = 0
  let fail = 0
  for (let i = 0; i < communes.length; i++) {
    const c = communes[i]
    const cp = c.postalCodes[0]?.code ?? null
    // Essaye FR d'abord, puis NL si échec (les communes flamandes ne se
    // résolvent pas toujours sous leur nom FR auprès de Nominatim)
    let res = await nominatimSearch(c.nameFr, cp)
    if (!res && c.nameNl) {
      await sleep(1100)
      res = await nominatimSearch(c.nameNl, cp)
    }
    const tag = `[${(i + 1).toString().padStart(3, ' ')}/${communes.length}] ${c.insCode}`
    if (res) {
      const lat = parseFloat(res.lat)
      const lng = parseFloat(res.lon)
      console.log(`${tag} ✓ ${lat.toFixed(4)},${lng.toFixed(4)} ${c.nameFr}`)
      if (APPLY) {
        await prisma.commune.update({
          where: { id: c.id },
          data: { lat, lng },
        })
      }
      ok++
    } else {
      console.log(`${tag} ✗ ${c.nameFr}`)
      fail++
    }
    await sleep(1100)
  }
  console.log(`\n${APPLY ? '✓ Mis à jour' : 'À mettre à jour'} : ${ok} ok, ${fail} échec`)
}

async function main() {
  console.log(`Mode : ${APPLY ? '🔥 APPLY' : '👀 DRY RUN'}\n`)
  if (!COORDS_ONLY) await fixRegions()
  if (!REGIONS_ONLY) await fixCoords()
  if (!APPLY) console.log('\nDry-run. Passe --yes pour appliquer.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
