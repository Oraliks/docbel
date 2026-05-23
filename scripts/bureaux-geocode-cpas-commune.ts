// Géocode les CPAS et Maisons communales qui n'ont pas encore de lat/lng.
//
// Beaucoup de CPAS et de Maisons communales ont été ajoutés en stubs (depuis
// bureaux-stub-missing.ts) avec juste un nom et une commune mais sans coords.
// Du coup leurs dots manquaient sur la map du finder.
//
// Stratégie identique à bureaux-geocode-op.ts :
//   1. Nominatim structuré (street + cp + city + country=BE)
//   2. Fallback free-form (q="adresse complète, Belgium")
//   3. Fallback cp+ville (centroïde commune)
//   4. Throttle 1.1s/req (policy Nominatim)
//
// On skip les bureaux dont la rue est manifestement un placeholder ("?",
// "stub", "TODO", vide) : pour eux on tombera direct sur le fallback cp+ville
// puisque Nominatim ne trouverait rien d'utile.
//
// Usage : pnpm tsx scripts/bureaux-geocode-cpas-commune.ts            (dry-run)
//         pnpm tsx scripts/bureaux-geocode-cpas-commune.ts --yes      (applique)
//         pnpm tsx scripts/bureaux-geocode-cpas-commune.ts --yes --type CPAS
//         pnpm tsx scripts/bureaux-geocode-cpas-commune.ts --yes --force

import { prisma } from '@/lib/prisma'

const APPLY = process.argv.includes('--yes')
const FORCE = process.argv.includes('--force')
const typeFlagIdx = process.argv.indexOf('--type')
const TYPE_FILTER = typeFlagIdx >= 0 ? process.argv[typeFlagIdx + 1] : null

const USER_AGENT = 'Beldoc/1.0 (geocoding CPAS+Communes belges; contact: oraliks@github)'
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

function isPlaceholderStreet(street: string | null | undefined): boolean {
  if (!street) return true
  const s = street.trim().toLowerCase()
  if (s.length < 2) return true
  return /^(stub|todo|tbd|n\/?a|\?+|-+|placeholder)$/i.test(s)
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
  const typesWhere = TYPE_FILTER
    ? { type: TYPE_FILTER as 'CPAS' | 'COMMUNE' }
    : { type: { in: ['CPAS', 'COMMUNE'] as ('CPAS' | 'COMMUNE')[] } }

  console.log(
    `Mode : ${APPLY ? '🔥 APPLY' : '👀 DRY RUN'}${FORCE ? ' (force)' : ''}${TYPE_FILTER ? ' type=' + TYPE_FILTER : ' type=CPAS+COMMUNE'}\n`
  )

  const bureaus = await prisma.bureau.findMany({
    where: {
      ...typesWhere,
      active: true,
      ...(FORCE ? {} : { lat: null }),
    },
    select: {
      id: true,
      type: true,
      name: true,
      street: true,
      streetNum: true,
      postalCode: true,
      city: true,
    },
    orderBy: [{ type: 'asc' }, { postalCode: 'asc' }],
  })
  console.log(`${bureaus.length} bureaux à géocoder\n`)

  let ok = 0
  let fallback = 0
  let cityOnly = 0
  let skipped = 0
  let fail = 0
  const failed: string[] = []

  for (let i = 0; i < bureaus.length; i++) {
    const b = bureaus[i]
    const tag = `[${(i + 1).toString().padStart(4, ' ')}/${bureaus.length}] ${b.type.padEnd(7)} ${b.postalCode}`

    const placeholder = isPlaceholderStreet(b.street)
    let res: NomResult | null = null
    let how = ''

    if (!placeholder) {
      res = await nominatimStructured(b)
      if (res) how = 'structured'
      if (!res) {
        await sleep(DELAY_MS)
        res = await nominatimFreeForm(b)
        if (res) how = 'free-form'
      }
    }
    if (!res) {
      // Fallback : centroïde de la commune via cp+ville (toujours tenté, même
      // si la rue est correcte mais introuvable)
      if (!placeholder) await sleep(DELAY_MS)
      res = await nominatimPostalCity(b)
      if (res) how = placeholder ? 'cp+city (placeholder)' : 'cp+city only'
    }

    if (res) {
      const lat = parseFloat(res.lat)
      const lng = parseFloat(res.lon)
      const flag = how === 'structured' ? '✓' : how === 'free-form' ? '~' : '⌖'
      console.log(
        `${tag} ${flag} ${lat.toFixed(4)},${lng.toFixed(4)}  ${b.name.slice(0, 60)} (${how})`
      )
      if (APPLY) {
        await prisma.bureau.update({
          where: { id: b.id },
          data: { lat, lng },
        })
      }
      if (how === 'structured') ok++
      else if (how === 'free-form') fallback++
      else if (how.startsWith('cp+city (placeholder)')) skipped++
      else cityOnly++
    } else {
      console.log(`${tag} ✗ — ${b.name} | ${b.street ?? '∅'} ${b.streetNum ?? ''}, ${b.city}`)
      failed.push(`${b.type} ${b.postalCode} ${b.name}`)
      fail++
    }

    await sleep(DELAY_MS)
  }

  console.log(`\n— Résumé —`)
  console.log(`  ✓ adresse exacte (structured)        : ${ok}`)
  console.log(`  ~ adresse approximée (free-form)      : ${fallback}`)
  console.log(`  ⌖ CP+ville (rue introuvable)          : ${cityOnly}`)
  console.log(`  ⌖ CP+ville (rue placeholder, skipped) : ${skipped}`)
  console.log(`  ✗ échec total                         : ${fail}`)
  if (failed.length) {
    console.log(`\n  Échecs :`)
    failed.forEach((s) => console.log(`    - ${s}`))
  }
  if (!APPLY) console.log(`\nDry-run. Passe --yes pour appliquer.`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
