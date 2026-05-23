// Import des bureaux OP (Organismes de Paiement) scrapés depuis leurs sites
// officiels : CAPAC, FGTB, CSC, CGSLB.
//
// Sources : lib/data/op-bureaux-{capac,fgtb,csc,cgslb}.json
//
// Strategie :
//  1. Pour chaque OP : DELETE les Bureau type=SYNDICAT existants (pour éviter
//     les doublons du seed manuel précédent qui peuvent etre obsolete)
//  2. INSERT chaque bureau du JSON avec communeId résolu via postalCode
//  3. Type SYNDICAT (notre enum n'a pas OP_PAIEMENT, on utilise organismeId
//     pour distinguer)
//
// Usage : pnpm bureaux:import-op            (dry-run)
//         pnpm bureaux:import-op --yes      (applique)
//         pnpm bureaux:import-op --keep     (n'efface pas l'existant)

import { readFile } from 'fs/promises'
import path from 'path'
import { prisma } from '@/lib/prisma'

const APPLY = process.argv.includes('--yes')
const KEEP_EXISTING = process.argv.includes('--keep')

interface OpBureau {
  name: string
  street: string
  streetNum: string | null
  postalCode: string
  city: string
  phone?: string | null
  email?: string | null
  website?: string | null
}

interface OpData {
  source: string | string[]
  scrapedAt: string
  phone?: string // tel commun (CAPAC)
  bureaux: OpBureau[]
}

const ORGS = [
  { code: 'capac', file: 'op-bureaux-capac.json' },
  { code: 'fgtb', file: 'op-bureaux-fgtb.json' },
  { code: 'csc', file: 'op-bureaux-csc.json' },
  { code: 'cgslb', file: 'op-bureaux-cgslb.json' },
] as const

async function main() {
  console.log(`Mode : ${APPLY ? '🔥 APPLY' : '👀 DRY RUN'}\n`)

  // Précharge communes par CP
  const postalCodes = await prisma.postalCode.findMany({
    include: { commune: { select: { id: true, nameFr: true } } },
  })
  const cpToCommune = new Map<string, { id: string; nameFr: string }[]>()
  for (const pc of postalCodes) {
    if (!pc.commune) continue
    const list = cpToCommune.get(pc.code) ?? []
    list.push(pc.commune)
    cpToCommune.set(pc.code, list)
  }

  for (const o of ORGS) {
    console.log(`━━ ${o.code.toUpperCase()} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    const org = await prisma.organisme.findUnique({ where: { code: o.code } })
    if (!org) {
      console.log(`  ⚠ Organisme "${o.code}" introuvable, skip`)
      continue
    }
    const dataPath = path.join(process.cwd(), 'lib', 'data', o.file)
    let data: OpData
    try {
      data = JSON.parse(await readFile(dataPath, 'utf-8'))
    } catch (e) {
      console.log(`  ⚠ Impossible de lire ${o.file}: ${e instanceof Error ? e.message : e}`)
      continue
    }

    console.log(`  ${data.bureaux.length} bureaux dans le JSON`)

    // Stats pré-import
    const existingCount = await prisma.bureau.count({
      where: { organismeId: org.id, type: 'SYNDICAT' },
    })
    console.log(`  ${existingCount} bureaux SYNDICAT existants en DB (avant import)`)

    if (APPLY && !KEEP_EXISTING) {
      // Purge avant ré-import — évite les doublons + données obsolètes
      const deleted = await prisma.bureau.deleteMany({
        where: { organismeId: org.id, type: 'SYNDICAT' },
      })
      console.log(`  🗑  Supprime ${deleted.count} bureaux existants`)
    }

    // Insertion
    let inserted = 0
    let skipsNoCommune = 0
    for (const b of data.bureaux) {
      const candidates = cpToCommune.get(b.postalCode)
      let communeId: string | null = null
      if (candidates && candidates.length > 0) {
        const exact = candidates.find(
          (c) => c.nameFr.toLowerCase() === b.city.toLowerCase()
        )
        communeId = (exact ?? candidates[0]).id
      } else {
        skipsNoCommune++
      }
      if (APPLY) {
        await prisma.bureau.create({
          data: {
            organismeId: org.id,
            type: 'SYNDICAT',
            name: b.name,
            street: b.street,
            streetNum: b.streetNum,
            postalCode: b.postalCode,
            city: b.city,
            phone: b.phone ?? data.phone ?? null,
            email: b.email ?? null,
            website: b.website ?? null,
            communeId,
          },
        })
      }
      inserted++
    }
    console.log(
      `  ${APPLY ? '✓ Inséré' : 'À insérer'} ${inserted}, ${skipsNoCommune} sans commune (gardés sans communeId)`
    )
  }

  if (!APPLY) {
    console.log('\nDry-run. Passe --yes pour appliquer.')
    console.log('Pour conserver les bureaux existants en plus, ajoute --keep.')
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
