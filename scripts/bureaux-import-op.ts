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

/**
 * Horaires par défaut des OP belges (paiement chômage). Les vrais horaires
 * varient par bureau, mais ces ranges sont représentatifs nationalement et
 * mieux que "rien" pour l'usager. À affiner via re-scrape ou signalements.
 *
 * Format : [{day, slots:[{open, close}]}] — day : 0=dim, 1=lun, ..., 6=sam.
 * Tous les OP : Lun-Ven matinée + après-midi (jeudi parfois fermé l'AM dans
 * les bureaux locaux, mais en moyenne ils ouvrent les 5 jours).
 */
const DEFAULT_OP_HOURS = [
  { day: 1, slots: [{ open: '08:30', close: '12:00' }, { open: '13:30', close: '16:00' }] },
  { day: 2, slots: [{ open: '08:30', close: '12:00' }, { open: '13:30', close: '16:00' }] },
  { day: 3, slots: [{ open: '08:30', close: '12:00' }] },
  { day: 4, slots: [{ open: '08:30', close: '12:00' }, { open: '13:30', close: '16:00' }] },
  { day: 5, slots: [{ open: '08:30', close: '12:00' }] },
  { day: 6, slots: [] },
  { day: 0, slots: [] },
]
const DEFAULT_OP_HOURS_NOTES =
  'Horaires standards estimés — peuvent varier selon le bureau. À confirmer.'

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

    // Stratégie UPSERT : clé naturelle = organismeId + postalCode + street +
    // streetNum. Préserve les champs enrichis (lat/lng géocodés, verified,
    // services, notes, hours réelles si saisies manuellement).
    //
    // Champs MISE À JOUR à chaque import (data fresh du scrape) :
    //   name, phone, email, website, city, communeId, hoursNotes
    // Champs PRÉSERVÉS (jamais écrasés une fois enrichis) :
    //   lat, lng, hours (si non vides), verified*, services, notes
    //
    // Ancien comportement (delete + create) écrasait tout — préservé via
    // --reset si vraiment besoin de repartir de zéro.
    const RESET = process.argv.includes('--reset')
    if (APPLY && RESET && !KEEP_EXISTING) {
      const deleted = await prisma.bureau.deleteMany({
        where: { organismeId: org.id, type: 'SYNDICAT' },
      })
      console.log(`  🗑  --reset : supprime ${deleted.count} bureaux existants`)
    }

    // Précharge tous les bureaux SYNDICAT existants pour cet organisme
    // (évite N+1 lookups dans la boucle)
    const existingBureaus = await prisma.bureau.findMany({
      where: { organismeId: org.id, type: 'SYNDICAT' },
      select: {
        id: true,
        postalCode: true,
        street: true,
        streetNum: true,
        hours: true,
      },
    })
    const existingMap = new Map<string, (typeof existingBureaus)[number]>()
    for (const e of existingBureaus) {
      const key = `${e.postalCode}|${e.street}|${e.streetNum ?? ''}`
      existingMap.set(key, e)
    }

    // Stats
    let created = 0
    let updated = 0
    let skipsNoCommune = 0
    const seenKeys = new Set<string>()

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

      const key = `${b.postalCode}|${b.street}|${b.streetNum ?? ''}`
      seenKeys.add(key)
      const existing = existingMap.get(key)

      if (APPLY) {
        if (existing) {
          // Update non-destructif : on touche pas hours si déjà rempli
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const existingHours = (existing.hours as any[]) ?? []
          const hasExistingHours = existingHours.some(
            (d) => (d?.slots?.length ?? 0) > 0
          )
          await prisma.bureau.update({
            where: { id: existing.id },
            data: {
              name: b.name,
              city: b.city,
              phone: b.phone ?? data.phone ?? null,
              email: b.email ?? null,
              website: b.website ?? null,
              communeId,
              ...(hasExistingHours
                ? {}
                : { hours: DEFAULT_OP_HOURS, hoursNotes: DEFAULT_OP_HOURS_NOTES }),
            },
          })
          updated++
        } else {
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
              hours: DEFAULT_OP_HOURS,
              hoursNotes: DEFAULT_OP_HOURS_NOTES,
            },
          })
          created++
        }
      } else {
        if (existing) updated++
        else created++
      }
    }

    // Détecte les bureaux DB qui ne sont plus dans le JSON (= retirés du
    // site source). Ne les supprime PAS automatiquement — juste warning.
    // Permet à l'admin de juger (peut-être que le site est temp en panne).
    const orphans = existingBureaus.filter((e) => {
      const key = `${e.postalCode}|${e.street}|${e.streetNum ?? ''}`
      return !seenKeys.has(key)
    })
    if (orphans.length > 0) {
      console.log(`  ⚠ ${orphans.length} bureau(x) en DB pas trouvés dans le JSON :`)
      for (const o of orphans.slice(0, 5)) {
        console.log(`     - ${o.postalCode} ${o.street} ${o.streetNum ?? ''} (id=${o.id})`)
      }
      console.log(`     (ne sont pas supprimés auto — vérifier manuellement)`)
    }

    console.log(
      `  ${APPLY ? '✓' : 'À traiter :'} ${created} créés, ${updated} mis à jour, ${skipsNoCommune} sans commune`
    )
  }

  if (!APPLY) {
    console.log('\nDry-run. Passe --yes pour appliquer.')
    console.log('Pour repartir de zéro (delete + recreate), passe --reset.')
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
