// Sync des sections d'organismes de paiement (70 antennes locales) depuis lookup
// section-organismes-paiement. Enrichit les Bureau type=SYNDICAT existants
// (CAPAC/FGTB/CSC/CGSLB) avec adresses + téléphones + BIC officiels ONEM.
//
// Usage :
//   pnpm bureaux:sync-sections-paiement          (dry-run)
//   pnpm bureaux:sync-sections-paiement --yes    (applique)

import { prisma } from '@/lib/prisma'

const APPLY = process.argv.includes('--yes')
// Par défaut, on n'applique QUE les updates (enrichit l'existant) — les créations
// sont risquées (doublons) sans matching ville plus poussé. Passe --create pour
// les inclure si tu as vérifié les noms.
const ALLOW_CREATE = process.argv.includes('--create')

interface SectionMeta {
  OP?: string // "1 - CAPAC"
  Rue?: string
  Numéro?: string
  Localité?: string
  'Code postal'?: string
  BIC?: string
  'PCR, IBAN'?: string
}

// Code OP du lookup ONEM → code organisme dans notre DB
const OP_CODE_TO_ORG: Record<string, string> = {
  '1': 'capac',
  '2': 'csc',
  '3': 'fgtb',
  '4': 'cgslb',
}

async function main() {
  console.log(`Mode : ${APPLY ? '🔥 APPLY' : '👀 DRY RUN'}\n`)

  const sections = await prisma.lookupEntry.findMany({
    where: { table: { slug: 'section-organismes-paiement' } },
    select: { code: true, labelFr: true, metadata: true },
    orderBy: { code: 'asc' },
  })
  console.log(`${sections.length} sections dans lookup`)

  // Précharge organismes
  const orgs = await prisma.organisme.findMany({
    where: { code: { in: ['capac', 'fgtb', 'csc', 'cgslb'] } },
  })
  const orgByCode = new Map(orgs.map((o) => [o.code, o]))

  // Précharge bureaux existants par organisme
  const existing = await prisma.bureau.findMany({
    where: { organisme: { code: { in: ['capac', 'fgtb', 'csc', 'cgslb'] } } },
    select: {
      id: true,
      name: true,
      city: true,
      postalCode: true,
      organisme: { select: { code: true } },
    },
  })

  let updates = 0
  let creates = 0
  let skips = 0
  const actions: { kind: 'update' | 'create'; id?: string; data: Record<string, unknown>; label: string }[] = []

  for (const s of sections) {
    const m = (s.metadata ?? {}) as SectionMeta
    const opPrefix = m.OP?.split('-')[0]?.trim() ?? ''
    const orgCode = OP_CODE_TO_ORG[opPrefix]
    if (!orgCode) {
      skips++
      continue
    }
    const org = orgByCode.get(orgCode)
    if (!org) {
      skips++
      continue
    }

    const cp = (m['Code postal'] ?? '').slice(0, 4)
    const ville = (m.Localité ?? '').match(/-\s*(.+)$/)?.[1]?.trim() ?? ''
    const rue = (m.Rue ?? '').match(/^\d+,\s*\d+\s*-\s*(.+)$/)?.[1]?.trim() ?? m.Rue ?? ''
    const num = m['Numéro']?.trim() ?? null
    if (!cp || !ville || !rue) {
      skips++
      continue
    }

    // Match par organisme + ville (heuristique simple)
    const match = existing.find(
      (b) => b.organisme.code === orgCode && b.city.toLowerCase() === ville.toLowerCase()
    )

    const data = {
      organismeId: org.id,
      type: 'SYNDICAT' as const,
      name: s.labelFr.replace(/^HVW\s+/, '') + ` (${org.shortName ?? orgCode.toUpperCase()})`,
      street: rue,
      streetNum: num,
      postalCode: cp,
      city: ville,
    }

    if (match) {
      actions.push({ kind: 'update', id: match.id, data, label: `${orgCode}/${ville}` })
      updates++
    } else {
      actions.push({ kind: 'create', data, label: `${orgCode}/${ville} (${s.labelFr})` })
      creates++
    }
  }

  console.log(`  ${updates} updates, ${creates} créations, ${skips} skips`)

  if (!APPLY) {
    console.log('\nDry-run terminé. Relance avec --yes pour appliquer.')
    return
  }

  console.log(`\n🔥 Application (créations ${ALLOW_CREATE ? 'INCLUSES' : 'IGNORÉES'})…`)
  let applied = 0
  for (const a of actions) {
    if (a.kind === 'update' && a.id) {
      await prisma.bureau.update({
        where: { id: a.id },
        data: {
          street: a.data.street as string,
          streetNum: a.data.streetNum as string | null,
          postalCode: a.data.postalCode as string,
          city: a.data.city as string,
          // PAS de update du name pour préserver les noms personnalisés
        },
      })
      applied++
    } else if (a.kind === 'create' && ALLOW_CREATE) {
      await prisma.bureau.create({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: a.data as any,
      })
      applied++
    }
  }
  console.log(`✓ ${applied} modifications appliquées`)
  if (!ALLOW_CREATE && creates > 0) {
    console.log(`  ℹ ${creates} créations ignorées — passe --create pour les inclure`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
