// Geocode les bureaux OP (type=SYNDICAT) qui n'ont pas encore de lat/lng.
//
// Stratégie :
//  1. Pour chaque bureau sans lat/lng, on interroge Nominatim avec une
//     requête structurée (street + postalcode + city + country=Belgium).
//  2. Si zéro résultat → fallback free-form avec adresse complète.
//  3. Throttle à 1.1s/req pour respecter la policy Nominatim (1 req/s).
//  4. UPDATE bureau.lat/lng + verified=false (auto-géocodage).
//
// Usage : pnpm bureaux:geocode-op            (dry-run)
//         pnpm bureaux:geocode-op --yes      (applique)
//         pnpm bureaux:geocode-op --yes --org capac
//         pnpm bureaux:geocode-op --yes --force (regéocode même ceux qui ont lat/lng)

import { prisma } from '@/lib/prisma'

const APPLY = process.argv.includes('--yes')
const FORCE = process.argv.includes('--force')
const orgFlagIdx = process.argv.indexOf('--org')
const ORG_FILTER = orgFlagIdx >= 0 ? process.argv[orgFlagIdx + 1] : null

const USER_AGENT = 'Beldoc/1.0 (geocoding bureaux OP belges; contact: oraliks@github)'
const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
const DELAY_MS = 1100 // 1 req/s policy

interface NomResult {
  lat: string
  lon: string
  display_name: string
  importance?: number
  type?: string
  class?: string
}

async function nominatimStructured(b: {
  street: string
  streetNum: string | null
  postalCode: string
  city: string
}): Promise<NomResult | null> {
  const houseNum = b.streetNum?.match(/^\d+[A-Za-z]?/)?.[0] ?? ''
  const street = `${houseNum} ${b.street}`.trim()
  const url = new URL(NOMINATIM)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('street', street)
  url.searchParams.set('postalcode', b.postalCode)
  url.searchParams.set('city', b.city)
  url.searchParams.set('country', 'Belgium')
  url.searchParams.set('limit', '1')
  const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!r.ok) return null
  const arr = (await r.json()) as NomResult[]
  return arr[0] ?? null
}

async function nominatimFreeForm(b: {
  street: string
  streetNum: string | null
  postalCode: string
  city: string
}): Promise<NomResult | null> {
  const q = `${b.street} ${b.streetNum ?? ''}, ${b.postalCode} ${b.city}, Belgium`
  const url = new URL(NOMINATIM)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('q', q)
  url.searchParams.set('limit', '1')
  const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!r.ok) return null
  const arr = (await r.json()) as NomResult[]
  return arr[0] ?? null
}

async function nominatimPostalCity(b: { postalCode: string; city: string }): Promise<NomResult | null> {
  const url = new URL(NOMINATIM)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('postalcode', b.postalCode)
  url.searchParams.set('city', b.city)
  url.searchParams.set('country', 'Belgium')
  url.searchParams.set('limit', '1')
  const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!r.ok) return null
  const arr = (await r.json()) as NomResult[]
  return arr[0] ?? null
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  console.log(`Mode : ${APPLY ? '🔥 APPLY' : '👀 DRY RUN'}${FORCE ? ' (force)' : ''}${ORG_FILTER ? ' org=' + ORG_FILTER : ''}\n`)

  const bureaus = await prisma.bureau.findMany({
    where: {
      type: 'SYNDICAT',
      active: true,
      ...(FORCE ? {} : { lat: null }),
      ...(ORG_FILTER ? { organisme: { code: ORG_FILTER } } : {}),
    },
    include: { organisme: { select: { code: true } } },
    orderBy: [{ organisme: { code: 'asc' } }, { postalCode: 'asc' }],
  })
  console.log(`${bureaus.length} bureaux à géocoder\n`)

  let ok = 0
  let fallback = 0
  let cityOnly = 0
  let fail = 0
  const failed: string[] = []

  for (let i = 0; i < bureaus.length; i++) {
    const b = bureaus[i]
    const tag = `[${(i + 1).toString().padStart(3, ' ')}/${bureaus.length}] ${b.organisme?.code?.toUpperCase().padEnd(5)} ${b.postalCode}`
    let res: NomResult | null = null
    let how = ''

    res = await nominatimStructured(b)
    if (res) how = 'structured'
    if (!res) {
      await sleep(DELAY_MS)
      res = await nominatimFreeForm(b)
      if (res) how = 'free-form'
    }
    if (!res) {
      await sleep(DELAY_MS)
      res = await nominatimPostalCity(b)
      if (res) how = 'cp+city only'
    }

    if (res) {
      const lat = parseFloat(res.lat)
      const lng = parseFloat(res.lon)
      const flag = how === 'structured' ? '✓' : how === 'free-form' ? '~' : '⌖'
      console.log(`${tag} ${flag} ${lat.toFixed(4)},${lng.toFixed(4)}  ${b.name} (${how})`)
      if (APPLY) {
        await prisma.bureau.update({
          where: { id: b.id },
          data: { lat, lng },
        })
      }
      if (how === 'structured') ok++
      else if (how === 'free-form') fallback++
      else cityOnly++
    } else {
      console.log(`${tag} ✗ — ${b.name} | ${b.street} ${b.streetNum ?? ''}, ${b.city}`)
      failed.push(`${b.organisme?.code} ${b.postalCode} ${b.name}`)
      fail++
    }

    await sleep(DELAY_MS)
  }

  console.log(`\n— Résumé —`)
  console.log(`  ✓ adresse exacte (structured) : ${ok}`)
  console.log(`  ~ adresse approximée (free-form) : ${fallback}`)
  console.log(`  ⌖ CP+ville seulement (centroïde) : ${cityOnly}`)
  console.log(`  ✗ échec : ${fail}`)
  if (failed.length) {
    console.log(`\n  Échecs :`)
    failed.forEach((s) => console.log(`    - ${s}`))
  }
  if (!APPLY) console.log(`\nDry-run. Passe --yes pour appliquer.`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
