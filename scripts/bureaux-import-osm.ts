// Importe les Maisons communales + CPAS de toute la Belgique depuis OpenStreetMap
// via l'Overpass API. Source ouverte, maintenue par la communauté OSM. Couverture
// estimée : ~95% des Maisons communales, ~70% des CPAS (selon les contributeurs).
//
// Stratégie :
//  1. Fetch via Overpass : amenity=townhall + amenity=social_facility avec
//     name matching "CPAS"|"OCMW"
//  2. Match chaque résultat à une Commune via le code postal (PostalCode → Commune)
//  3. Upsert Bureau (type=COMMUNE ou CPAS, organisme=commune/cpas) — non-destructif
//     sur les champs personnalisés (hours, verified, notes, services)
//
// Usage :
//   pnpm bureaux:import-osm                (dry-run)
//   pnpm bureaux:import-osm --yes          (applique)
//   pnpm bureaux:import-osm --townhalls    (que les Maisons communales)
//   pnpm bureaux:import-osm --cpas         (que les CPAS)

import { prisma } from '@/lib/prisma'
import { isNonGuichetName } from '@/lib/bureaus/dedupe'

const APPLY = process.argv.includes('--yes')
const ONLY_TOWNHALLS = process.argv.includes('--townhalls')
const ONLY_CPAS = process.argv.includes('--cpas')

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'

// Townhalls = Maisons communales
const TOWNHALL_QUERY = `
[out:json][timeout:90];
area["ISO3166-1"="BE"]->.be;
(
  node["amenity"="townhall"](area.be);
  way["amenity"="townhall"](area.be);
  relation["amenity"="townhall"](area.be);
);
out center tags;
`

// CPAS = Centre Public d'Action Sociale (OCMW en NL)
// On fait 2 queries séparées (le multi-regex + ,i causent des timeouts sur
// Overpass). On dédoublonne ensuite par id.
const CPAS_QUERY_FR = `
[out:json][timeout:90];
area["ISO3166-1"="BE"]->.be;
(
  node["name"~"CPAS"](area.be);
  way["name"~"CPAS"](area.be);
);
out center tags;
`

const CPAS_QUERY_NL = `
[out:json][timeout:90];
area["ISO3166-1"="BE"]->.be;
(
  node["name"~"OCMW"](area.be);
  way["name"~"OCMW"](area.be);
);
out center tags;
`

interface OsmTags {
  name?: string
  'name:fr'?: string
  'name:nl'?: string
  'addr:street'?: string
  'addr:housenumber'?: string
  'addr:postcode'?: string
  'addr:city'?: string
  phone?: string
  'contact:phone'?: string
  email?: string
  'contact:email'?: string
  website?: string
  'contact:website'?: string
}

interface OsmElement {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: OsmTags
}

interface OsmResponse {
  elements: OsmElement[]
}

async function fetchOverpass(query: string, attempt = 1): Promise<OsmElement[]> {
  const MAX_ATTEMPTS = 4
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    body: 'data=' + encodeURIComponent(query.trim()),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Beldoc-Bureaux-Import/1.0 (https://docbel.be)',
      Accept: 'application/json',
    },
  })
  if (res.ok) {
    const data = (await res.json()) as OsmResponse
    return data.elements ?? []
  }
  // 429 / 504 = serveur saturé → backoff exponentiel
  if ((res.status === 429 || res.status === 504) && attempt < MAX_ATTEMPTS) {
    const delay = 1000 * Math.pow(2, attempt) // 2s, 4s, 8s
    console.log(`  ⚠ Overpass ${res.status}, retry ${attempt}/${MAX_ATTEMPTS - 1} dans ${delay / 1000}s…`)
    await new Promise((r) => setTimeout(r, delay))
    return fetchOverpass(query, attempt + 1)
  }
  const body = await res.text().catch(() => '')
  throw new Error(`Overpass HTTP ${res.status}: ${body.slice(0, 200)}`)
}

interface PreparedBureau {
  name: string
  nameFr: string | null
  nameNl: string | null
  street: string
  streetNum: string | null
  postalCode: string
  city: string
  phone: string | null
  email: string | null
  website: string | null
  lat: number | null
  lng: number | null
  osmId: number
}

function prepareBureau(el: OsmElement): PreparedBureau | null {
  const t = el.tags ?? {}
  const name = t.name ?? t['name:fr'] ?? t['name:nl']
  if (!name) return null
  const street = t['addr:street']
  const postcode = t['addr:postcode']
  const city = t['addr:city']
  if (!street || !postcode || !city) return null
  if (!/^\d{4}$/.test(postcode)) return null
  return {
    name,
    nameFr: t['name:fr'] ?? null,
    nameNl: t['name:nl'] ?? null,
    street,
    streetNum: t['addr:housenumber'] ?? null,
    postalCode: postcode,
    city,
    phone: t.phone ?? t['contact:phone'] ?? null,
    email: t.email ?? t['contact:email'] ?? null,
    website: t.website ?? t['contact:website'] ?? null,
    lat: el.lat ?? el.center?.lat ?? null,
    lng: el.lon ?? el.center?.lon ?? null,
    osmId: el.id,
  }
}

async function importOsm(kind: 'COMMUNE' | 'CPAS', elements: OsmElement[]) {
  const orgCode = kind === 'COMMUNE' ? 'commune' : 'cpas'
  const org = await prisma.organisme.findUnique({ where: { code: orgCode } })
  if (!org) throw new Error(`Organisme "${orgCode}" introuvable`)

  // Map CP → Commune (via PostalCode)
  const pcs = await prisma.postalCode.findMany({
    include: { commune: { select: { id: true, nameFr: true, nameNl: true, insCode: true } } },
  })
  // 1 CP peut avoir plusieurs Communes. On les stocke comme array.
  const cpToCommunes = new Map<string, { id: string; nameFr: string; nameNl: string | null; insCode: string }[]>()
  for (const pc of pcs) {
    if (!pc.commune) continue
    const list = cpToCommunes.get(pc.code) ?? []
    list.push(pc.commune)
    cpToCommunes.set(pc.code, list)
  }

  // Bureaux existants pour ce type. On ne matche QUE les bureaux ACTIFS pour ne
  // pas ressusciter / réécrire un doublon désactivé par bureaux:dedupe.
  const existing = await prisma.bureau.findMany({
    where: { type: kind, organismeId: org.id, active: true },
    select: { id: true, name: true, communeId: true, postalCode: true },
  })

  let creates = 0
  let updates = 0
  let skipsNoMatch = 0
  let skipsMultipleCommunes = 0
  let skipsNonGuichet = 0

  const actions: { kind: 'create' | 'update'; id?: string; data: Record<string, unknown> }[] = []

  for (const el of elements) {
    const p = prepareBureau(el)
    if (!p) continue

    // Garde-fou anti-doublons : OSM tague comme "townhall"/"CPAS" des bâtiments
    // annexes (archives, police, musées, cloîtres). On ne les crée pas en
    // nouveaux bureaux (ils réintroduiraient le bruit nettoyé par le lot 1).
    if (isNonGuichetName(p.name)) {
      skipsNonGuichet++
      continue
    }

    // Find commune via postal code (préférence : commune dont le nom matche addr:city)
    const candidates = cpToCommunes.get(p.postalCode) ?? []
    if (candidates.length === 0) {
      skipsNoMatch++
      continue
    }
    let commune = candidates[0]
    if (candidates.length > 1) {
      const exact = candidates.find(
        (c) =>
          c.nameFr.toLowerCase() === p.city.toLowerCase() ||
          c.nameNl?.toLowerCase() === p.city.toLowerCase()
      )
      if (exact) commune = exact
      else skipsMultipleCommunes++ // on prend quand même le premier mais on note
    }

    // Match bureau existant (par communeId)
    const match = existing.find((b) => b.communeId === commune.id)

    const baseData = {
      organismeId: org.id,
      type: kind,
      name: p.name,
      nameNl: p.nameNl,
      street: p.street,
      streetNum: p.streetNum,
      postalCode: p.postalCode,
      city: p.city,
      lat: p.lat,
      lng: p.lng,
      phone: p.phone,
      email: p.email,
      website: p.website,
      communeId: commune.id,
    }

    if (match) {
      actions.push({ kind: 'update', id: match.id, data: baseData })
      updates++
    } else {
      actions.push({ kind: 'create', data: baseData })
      creates++
    }
  }

  console.log(`  ${kind}: ${updates} updates, ${creates} créations`)
  console.log(`           ${skipsNoMatch} skips (CP inconnu), ${skipsMultipleCommunes} CP ambigus, ${skipsNonGuichet} non-guichets écartés`)

  if (!APPLY) return

  console.log(`  🔥 Application…`)
  for (const a of actions) {
    if (a.kind === 'update' && a.id) {
      await prisma.bureau.update({
        where: { id: a.id },
        // PRÉSERVÉ : hours, services, verified, notes, lastVerifiedAt
        data: {
          name: a.data.name as string,
          nameNl: a.data.nameNl as string | null,
          street: a.data.street as string,
          streetNum: a.data.streetNum as string | null,
          postalCode: a.data.postalCode as string,
          city: a.data.city as string,
          lat: a.data.lat as number | null,
          lng: a.data.lng as number | null,
          phone: a.data.phone as string | null,
          email: a.data.email as string | null,
          website: a.data.website as string | null,
        },
      })
    } else if (a.kind === 'create') {
      await prisma.bureau.create({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: a.data as any,
      })
    }
  }
  console.log(`  ✓ Done`)
}

async function main() {
  console.log(`Mode : ${APPLY ? '🔥 APPLY' : '👀 DRY RUN'}\n`)

  if (!ONLY_CPAS) {
    console.log('━━ 1. MAISONS COMMUNALES (OSM amenity=townhall) ━━━━━━━━━━━━━')
    console.log('  Fetch Overpass API…')
    const townhalls = await fetchOverpass(TOWNHALL_QUERY)
    console.log(`  ${townhalls.length} townhalls trouvés dans OSM`)
    await importOsm('COMMUNE', townhalls)
  }

  if (!ONLY_TOWNHALLS) {
    console.log('\n━━ 2. CPAS (OSM name="CPAS|OCMW") ━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('  Fetch Overpass API (CPAS)…')
    const cpasFr = await fetchOverpass(CPAS_QUERY_FR)
    console.log(`  ${cpasFr.length} "CPAS" trouvés`)
    console.log('  Fetch Overpass API (OCMW)…')
    const cpasNl = await fetchOverpass(CPAS_QUERY_NL)
    console.log(`  ${cpasNl.length} "OCMW" trouvés`)
    // Dédoublonnage par (type, id)
    const dedupKey = (e: OsmElement) => `${e.type}:${e.id}`
    const merged = [...cpasFr]
    const seen = new Set(cpasFr.map(dedupKey))
    for (const e of cpasNl) {
      const k = dedupKey(e)
      if (!seen.has(k)) {
        merged.push(e)
        seen.add(k)
      }
    }
    console.log(`  ${merged.length} CPAS uniques au total`)
    await importOsm('CPAS', merged)
  }

  if (!APPLY) console.log('\nDry-run terminé. Relance avec --yes pour appliquer.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
