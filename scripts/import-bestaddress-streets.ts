// Importe la liste officielle des rues belges (~145k) depuis BeStAddress
// (BOSA — donnée fédérale gratuite, CC-BY 4.0) dans la table `code-rue`.
//
// Sources :
//   https://opendata.bosa.be/download/best/postalstreets-latest.zip
//   → 3 CSVs : Brussels_postal_street, Flanders_postal_street, Wallonia_postal_street
//
// Colonnes utiles : postal_id, street_fr, street_nl, street_de, city_fr, city_nl,
// street_no (identifiant régional), city_no (code NIS commune)
//
// Code synthétique : "{postal}-{street_no}" — unique en Belgique
// car street_no peut se répéter entre régions mais postal_id non.
//
// Usage :
//   pnpm exec dotenv -e .env.local -- tsx scripts/import-bestaddress-streets.ts
//   pnpm exec dotenv -e .env.local -- tsx scripts/import-bestaddress-streets.ts --skip-download (réutilise /tmp/best)

import AdmZip from 'adm-zip'
import { mkdir, writeFile, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import os from 'os'
import { prisma } from '@/lib/prisma'
import { parseCsv } from '@/lib/lookup/importLookupCsv'

const SKIP_DOWNLOAD = process.argv.includes('--skip-download')
const URL = 'https://opendata.bosa.be/download/best/postalstreets-latest.zip'
const WORK_DIR = path.join(os.tmpdir(), 'beldoc-best')
const ZIP_PATH = path.join(WORK_DIR, 'postalstreets.zip')
const CSV_FILES = [
  'Brussels_postal_street.csv',
  'Flanders_postal_street.csv',
  'Wallonia_postal_street.csv',
]

const BATCH = 1000

async function main() {
  console.log('━━ IMPORT CODE RUE (BeStAddress) ━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  await mkdir(WORK_DIR, { recursive: true })

  if (!SKIP_DOWNLOAD) {
    console.log(`Téléchargement : ${URL}`)
    const res = await fetch(URL)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    await writeFile(ZIP_PATH, buf)
    console.log(`  ✓ ${(buf.length / 1024 / 1024).toFixed(1)} MB téléchargés`)
  }
  if (!existsSync(ZIP_PATH)) {
    throw new Error(`ZIP introuvable: ${ZIP_PATH} (relance sans --skip-download)`)
  }

  console.log('Décompression…')
  const zip = new AdmZip(ZIP_PATH)
  for (const entry of CSV_FILES) {
    zip.extractEntryTo(entry, WORK_DIR, false, true)
  }
  console.log(`  ✓ 3 CSVs extraits`)

  const table = await prisma.lookupTable.findFirst({
    where: { slug: 'code-rue' },
  })
  if (!table) throw new Error('Table code-rue introuvable en DB')

  // Étape 1 : parser les 3 CSVs et dédupliquer en mémoire (par {postal}-{street_no})
  console.log('Parsing CSVs…')
  const byKey = new Map<
    string,
    { code: string; labelFr: string; labelNl: string; metadata: Record<string, string> }
  >()
  for (const fileName of CSV_FILES) {
    const region = fileName.split('_')[0] // Brussels / Flanders / Wallonia
    const csv = await readFile(path.join(WORK_DIR, fileName), 'utf-8')
    const rows = parseCsv(csv)
    const header = rows[0]
    const col = (name: string) => header.indexOf(name)
    const iPostal = col('postal_id')
    const iStreetFr = col('street_fr')
    const iStreetNl = col('street_nl')
    const iStreetDe = col('street_de')
    const iCityFr = col('city_fr')
    const iCityNl = col('city_nl')
    const iStreetNo = col('street_no')
    const iCityNo = col('city_no')

    let added = 0
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]
      const postal = (r[iPostal] ?? '').trim()
      const streetNo = (r[iStreetNo] ?? '').trim()
      if (!postal || !streetNo) continue
      const labelFr = (r[iStreetFr] ?? '').trim() || (r[iStreetNl] ?? '').trim()
      const labelNl = (r[iStreetNl] ?? '').trim() || (r[iStreetFr] ?? '').trim()
      if (!labelFr && !labelNl) continue
      const key = `${postal}-${streetNo}`
      if (byKey.has(key)) continue // dédoublonnage
      const cityFr = (r[iCityFr] ?? '').trim() || (r[iCityNl] ?? '').trim()
      const cityNl = (r[iCityNl] ?? '').trim() || (r[iCityFr] ?? '').trim()
      const cityNo = (r[iCityNo] ?? '').trim()
      const streetDe = (r[iStreetDe] ?? '').trim()
      const metadata: Record<string, string> = {
        'Code postal': postal,
        'Code NIS commune': cityNo,
        Commune: cityFr,
        Région: region,
      }
      if (cityNl && cityNl !== cityFr) metadata['Commune (NL)'] = cityNl
      if (streetDe) metadata['Nom rue (DE)'] = streetDe
      byKey.set(key, { code: key, labelFr, labelNl, metadata })
      added++
    }
    console.log(`  ✓ ${region}: ${added} rues uniques (${rows.length - 1} lignes brutes)`)
  }

  console.log(`Total dédupliqué : ${byKey.size} rues`)

  // Étape 2 : purger l'existant (ré-import complet, pas de diff)
  console.log('Purge de la table…')
  await prisma.lookupEntry.deleteMany({ where: { tableId: table.id } })

  // Étape 3 : insertion par batch
  console.log(`Insertion par batchs de ${BATCH}…`)
  const all = [...byKey.values()]
  const validFrom = new Date('1970-01-01')
  let inserted = 0
  const t0 = Date.now()
  for (let i = 0; i < all.length; i += BATCH) {
    const chunk = all.slice(i, i + BATCH)
    const created = await prisma.lookupEntry.createMany({
      data: chunk.map((e) => ({
        tableId: table.id,
        code: e.code,
        labelFr: e.labelFr,
        labelNl: e.labelNl,
        validFrom,
        metadata: e.metadata,
      })),
      skipDuplicates: true,
    })
    inserted += created.count
    if (i % (BATCH * 10) === 0) {
      const pct = ((i / all.length) * 100).toFixed(0)
      process.stdout.write(`\r  ${pct}% (${inserted}/${all.length})`)
    }
  }
  process.stdout.write(`\r  100% (${inserted}/${all.length})\n`)

  await prisma.lookupTable.update({
    where: { id: table.id },
    data: {
      entriesCount: inserted,
      lastImportedAt: new Date(),
      lastImportSource: 'BeStAddress (BOSA)',
      lastImportedBy: 'import-bestaddress-streets',
    },
  })

  console.log(`✓ ${inserted} rues insérées en ${((Date.now() - t0) / 1000).toFixed(1)}s`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
