// Géocode les bureaux qui n'ont pas encore de lat/lng via Nominatim.
//
// Fusion de bureaux-geocode-op.ts + bureaux-geocode-cpas-commune.ts
// (qui étaient 80 % code dupliqué) en un seul script paramétrable.
//
// Stratégie :
//   1. Nominatim structuré (street + cp + city + country=BE) — précis
//   2. Fallback free-form (q="adresse complète, Belgium")
//   3. Fallback cp+ville (centroïde commune) — au moins on a un dot
//   4. Throttle 1.1 s/req (policy Nominatim : 1 req/s max)
//
// Les "stubs" (rue placeholder type "?", "stub", "Adresse à confirmer")
// sont reconnus → on saute direct à l'étape 3 (sinon Nominatim cherche
// inutilement et fail).
//
// Usage :
//   pnpm tsx scripts/bureaux-geocode.ts                          (dry-run, tous types)
//   pnpm tsx scripts/bureaux-geocode.ts --yes                    (applique, tous types)
//   pnpm tsx scripts/bureaux-geocode.ts --yes --type CPAS        (CPAS uniquement)
//   pnpm tsx scripts/bureaux-geocode.ts --yes --type SYNDICAT    (les 4 OPs)
//   pnpm tsx scripts/bureaux-geocode.ts --yes --type SYNDICAT --org capac
//   pnpm tsx scripts/bureaux-geocode.ts --yes --force            (regéocode même ceux qui ont lat/lng)

import { prisma } from '@/lib/prisma'

const APPLY = process.argv.includes('--yes')
const FORCE = process.argv.includes('--force')

function getArg(flag: string): string | null {
  const idx = process.argv.indexOf(flag)
  return idx >= 0 ? (process.argv[idx + 1] ?? null) : null
}
const TYPE_FILTER = getArg('--type') // CPAS | COMMUNE | SYNDICAT | ONEM | null
const ORG_FILTER = getArg('--org') // capac | fgtb | csc | cgslb | null

const USER_AGENT = 'Beldoc/1.0 (geocoding bureaux belges; contact: oraliks@github)'
const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
const DELAY_MS = 1100 // 1 req/s policy

const VALID_TYPES = ['CPAS', 'COMMUNE', 'SYNDICAT', 'ONEM', 'PERMANENCE', 'AUTRE'] as const
type BureauType = (typeof VALID_TYPES)[number]

interface NomResult {
  lat: string
  lon: string
  display_name: string
  importance?: number
  type?: string
  class?: string
}

/**
 * Détecte une rue "placeholder" (stub) qui ne mérite pas une recherche
 * Nominatim structurée — on tombera direct sur le fallback cp+ville.
 */
function isPlaceholderStreet(street: string | null | undefined): boolean {
  if (!street) return true
  const s = street.trim().toLowerCase()
  if (s.length < 2) return true
  if (/adresse\s*à\s*confirmer/i.test(s)) return true
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
  if (TYPE_FILTER && !VALID_TYPES.includes(TYPE_FILTER as BureauType)) {
    console.error(`⚠ --type invalide : "${TYPE_FILTER}". Valeurs : ${VALID_TYPES.join(', ')}`)
    process.exit(1)
  }

  const typesWhere = TYPE_FILTER
    ? { type: TYPE_FILTER as BureauType }
    : { type: { in: ['CPAS', 'COMMUNE', 'SYNDICAT', 'ONEM'] as BureauType[] } }

  const orgWhere = ORG_FILTER ? { organisme: { code: ORG_FILTER } } : {}

  console.log(
    `Mode : ${APPLY ? '🔥 APPLY' : '👀 DRY RUN'}` +
      `${FORCE ? ' (force)' : ''}` +
      `${TYPE_FILTER ? ' type=' + TYPE_FILTER : ' type=*'}` +
      `${ORG_FILTER ? ' org=' + ORG_FILTER : ''}\n`
  )

  const bureaus = await prisma.bureau.findMany({
    where: {
      ...typesWhere,
      ...orgWhere,
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
      organisme: { select: { code: true } },
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
    const orgTag = b.organisme?.code ? `/${b.organisme.code}` : ''
    const tag = `[${(i + 1).toString().padStart(4, ' ')}/${bureaus.length}] ${(b.type + orgTag).padEnd(13)} ${b.postalCode}`

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
      failed.push(`${b.type}${orgTag} ${b.postalCode} ${b.name}`)
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
