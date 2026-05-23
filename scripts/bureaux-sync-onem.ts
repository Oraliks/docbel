// Sync des bureaux ONEM depuis le lookup ONEM officiel (table bureau-de-chomage).
//
// Étape 1 : update non-destructif des Bureau type=ONEM existants
//   - match par numeroOnem (s'il est déjà set) puis fallback par nom+CP
//   - update : address, postalCode, city, phone, numeroOnem, regionOnem
//   - PRÉSERVÉ : hours, services, verified, lastVerifiedAt, notes, lat/lng, communeId
//
// Étape 2 : auto-génération des BureauAssignment depuis parametres-onem-cp
//   - 1298 CP → BC mappings officiels ONEM
//   - upsert BureauAssignment (bureauId, communeId, serviceType="chomage")
//   - les commune.insCode viennent de lookup (Code INS principale = labelFr)
//
// Usage :
//   pnpm bureaux:sync-onem          (dry-run)
//   pnpm bureaux:sync-onem --yes    (applique)

import { prisma } from '@/lib/prisma'

const APPLY = process.argv.includes('--yes')

interface LookupBureauMeta {
  Rue?: string
  Numéro?: string
  Localité?: string
  'Code postal'?: string
  Téléphone?: string
  Entité?: string
  'Code MFU'?: string
  BIC?: string
  'PCR,IBAN'?: string
}

interface LookupCpMeta {
  BC?: string
  Région?: string
  'Code INS principale'?: string
}

async function main() {
  console.log(`Mode : ${APPLY ? '🔥 APPLY' : '👀 DRY RUN (passe --yes pour appliquer)'}\n`)

  // ─── Étape 1 : sync bureaux ONEM ────────────────────────────────────
  console.log('━━ 1. SYNC BUREAUX ONEM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  const lookupBureaux = await prisma.lookupEntry.findMany({
    where: { table: { slug: 'bureau-de-chomage' } },
    select: { code: true, labelFr: true, metadata: true },
    orderBy: { code: 'asc' },
  })
  console.log(`${lookupBureaux.length} bureaux dans lookup`)

  const organismeOnem = await prisma.organisme.findUnique({ where: { code: 'onem' } })
  if (!organismeOnem) throw new Error('Organisme "onem" introuvable')

  // Bureaux ONEM existants
  const existingOnem = await prisma.bureau.findMany({
    where: { type: 'ONEM' },
    select: {
      id: true,
      name: true,
      postalCode: true,
      city: true,
      street: true,
      streetNum: true,
      phone: true,
    },
  })
  console.log(`${existingOnem.length} bureaux ONEM déjà en DB`)

  type SyncAction =
    | { kind: 'update'; id: string; name: string; patch: BureauPatch }
    | { kind: 'create'; name: string; patch: BureauPatch }
    | { kind: 'skip'; code: string; reason: string }
  interface BureauPatch {
    name: string
    street: string
    streetNum: string | null
    postalCode: string
    city: string
    phone: string | null
    numeroOnem: string
    regionOnem: string | null
  }

  const actions: SyncAction[] = []
  for (const e of lookupBureaux) {
    const m = (e.metadata ?? {}) as LookupBureauMeta
    // On skip tous les "directions centrales" ONEM (pas des BCs opérationnels) :
    //  - pas de Code MFU
    //  - OU nom contenant "Direction" / "Fonds" / "Service" (services centraux)
    //  - OU Entité = 999 (placeholder ONEM pour services centraux)
    const isCentralService =
      !m['Code MFU'] ||
      /^(direction|fonds|service|cabinet)/i.test(e.labelFr) ||
      m['Entité'] === '999'
    if (isCentralService) {
      actions.push({ kind: 'skip', code: e.code, reason: 'service central' })
      continue
    }
    // Parse adresse
    const rue = parseRueField(m.Rue) // "1029, 1000 - Boulevard de l'Empereur" → "Boulevard de l'Empereur"
    const cp = parseCodePostalField(m['Code postal']) // "2018, 11002" → "2018"
    const ville = parseLocaliteField(m.Localité) // "1000, 21004 - Bruxelles" → "Bruxelles"

    if (!rue || !cp || !ville) {
      actions.push({ kind: 'skip', code: e.code, reason: 'adresse incomplète' })
      continue
    }

    const patch: BureauPatch = {
      name: e.labelFr,
      street: rue,
      streetNum: m['Numéro']?.trim() || null,
      postalCode: cp,
      city: ville,
      phone: m['Téléphone']?.trim() || null,
      numeroOnem: e.code, // "711" pour Anvers
      regionOnem: deriveRegion(ville),
    }

    // Match : 1) par numeroOnem déjà set, 2) par nom + CP
    const existing = existingOnem.find(
      (b) => b.name.toLowerCase().includes(e.labelFr.toLowerCase()) || e.labelFr.toLowerCase().includes(b.name.toLowerCase())
    )

    if (existing) {
      actions.push({ kind: 'update', id: existing.id, name: e.labelFr, patch })
    } else {
      actions.push({ kind: 'create', name: e.labelFr, patch })
    }
  }

  const updates = actions.filter((a) => a.kind === 'update').length
  const creates = actions.filter((a) => a.kind === 'create').length
  const skips = actions.filter((a) => a.kind === 'skip').length
  console.log(`  ${updates} updates, ${creates} créations, ${skips} skips`)
  for (const a of actions.filter((a) => a.kind === 'skip').slice(0, 5)) {
    if (a.kind === 'skip') console.log(`    SKIP [${a.code}] ${a.reason}`)
  }

  if (APPLY) {
    console.log(`  🔥 Application…`)
    for (const a of actions) {
      if (a.kind === 'update') {
        await prisma.bureau.update({
          where: { id: a.id },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: a.patch as any,
        })
      } else if (a.kind === 'create') {
        await prisma.bureau.create({
          data: {
            organismeId: organismeOnem.id,
            type: 'ONEM',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...(a.patch as any),
          },
        })
      }
    }
    console.log(`  ✓ Done`)
  }

  // ─── Étape 2 : assignations CP → BC ─────────────────────────────────
  console.log('\n━━ 2. AUTO-ASSIGNATIONS CP → BC ━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  const cpEntries = await prisma.lookupEntry.findMany({
    where: { table: { slug: 'parametres-onem-cp' } },
    select: { code: true, labelFr: true, metadata: true },
  })
  console.log(`${cpEntries.length} CP dans lookup`)

  // Mapping numeroOnem → Bureau.id (relit depuis DB pour avoir les creates de l'étape 1)
  const bureauxByNumero = new Map<string, string>()
  if (APPLY) {
    const all = (await prisma.bureau.findMany({
      where: { type: 'ONEM' },
    })) as Array<{ id: string; numeroOnem: string | null }>
    for (const b of all) {
      if (b.numeroOnem) bureauxByNumero.set(b.numeroOnem, b.id)
    }
  }

  // Map insCode → commune.id
  const communes = await prisma.commune.findMany({ select: { id: true, insCode: true } })
  const communesByIns = new Map(communes.map((c) => [c.insCode, c.id]))

  let assignmentsPlanned = 0
  let skippedNoBureau = 0
  let skippedNoCommune = 0
  type AssignAction = { bureauId: string; communeId: string }
  const assignments: AssignAction[] = []

  for (const e of cpEntries) {
    const meta = (e.metadata ?? {}) as LookupCpMeta
    if (!meta.BC) continue
    const bcCode = meta.BC.split('-')[0]?.trim() // "921 - BRUXELLES" → "921"
    if (!bcCode) continue
    const insCode = e.labelFr.trim() // labelFr = code INS principale
    if (!insCode) continue

    const bureauId = bureauxByNumero.get(bcCode)
    const communeId = communesByIns.get(insCode)

    if (!bureauId) {
      skippedNoBureau++
      continue
    }
    if (!communeId) {
      skippedNoCommune++
      continue
    }
    assignments.push({ bureauId, communeId })
    assignmentsPlanned++
  }
  console.log(`  ${assignmentsPlanned} assignations à créer/maintenir`)
  console.log(`  ${skippedNoBureau} skipped (bureau ONEM introuvable par numeroOnem)`)
  console.log(`  ${skippedNoCommune} skipped (commune introuvable par insCode)`)

  if (APPLY && assignments.length > 0) {
    console.log(`  🔥 Upsert ${assignments.length} BureauAssignment…`)
    // Bulk upsert via createMany skipDuplicates
    await prisma.bureauAssignment.createMany({
      data: assignments.map((a) => ({
        bureauId: a.bureauId,
        communeId: a.communeId,
        serviceType: 'chomage',
      })),
      skipDuplicates: true,
    })
    console.log(`  ✓ Done`)
  }

  if (!APPLY) {
    console.log('\nDry-run terminé. Relance avec --yes pour appliquer.')
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────

function parseRueField(raw?: string): string {
  if (!raw) return ''
  // Format observé : "1029, 1000 - Boulevard de l'Empereur"
  const m = raw.match(/^\d+,\s*\d+\s*-\s*(.+)$/)
  return m ? m[1].trim() : raw.trim()
}

function parseCodePostalField(raw?: string): string {
  if (!raw) return ''
  // "2018, 11002" → "2018"
  const m = raw.match(/^(\d{4})/)
  return m ? m[1] : raw.trim()
}

function parseLocaliteField(raw?: string): string {
  if (!raw) return ''
  // "1000, 21004 - Bruxelles" → "Bruxelles"
  const m = raw.match(/-\s*(.+)$/)
  return m ? m[1].trim() : raw.trim()
}

function deriveRegion(city: string): string | null {
  // Heuristique très simple : à raffiner avec parametres-onem-cp si besoin
  const c = city.toLowerCase()
  if (/bruxelles|brussel|sint-|saint-/.test(c)) return 'Bruxelles-Capitale'
  return null
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
