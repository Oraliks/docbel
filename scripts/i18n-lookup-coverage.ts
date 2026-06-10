// Couverture multilingue des LookupEntry (codes ONEM) — read-only.
// Décision : lookup = FR/NL/DE uniquement (exception). FR = source, NL déjà fourni,
// DE = le trou à combler. On dédoublonne par libellé FR (un même libellé existe sur
// plusieurs versions de validité → on ne le traduit qu'une fois).
//
// Usage : dotenv -e .env.local -- tsx scripts/i18n-lookup-coverage.ts

import { prisma, withDbRetry } from '@/lib/prisma'

const nf = new Intl.NumberFormat('fr-BE')
const filled = (s: string | null | undefined) => !!(s && s.trim())
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length

async function main() {
  const rows = await withDbRetry(() =>
    prisma.lookupEntry.findMany({ select: { labelFr: true, labelNl: true, labelDe: true, labelEn: true } })
  )
  const total = rows.length

  let nl = 0, de = 0, en = 0
  const uniqFr = new Set<string>()
  const uniqMissingDe = new Set<string>()
  const uniqMissingNl = new Set<string>()

  for (const r of rows) {
    if (filled(r.labelNl)) nl++
    if (filled(r.labelDe)) de++
    if (filled(r.labelEn)) en++

    if (filled(r.labelFr)) {
      const key = r.labelFr.trim()
      uniqFr.add(key)
      if (!filled(r.labelDe)) uniqMissingDe.add(key)
      if (!filled(r.labelNl)) uniqMissingNl.add(key)
    }
  }

  let deGapWords = 0
  for (const s of uniqMissingDe) deGapWords += words(s)
  let nlGapWords = 0
  for (const s of uniqMissingNl) nlGapWords += words(s)

  const pct = (n: number) => `${((n / total) * 100).toFixed(1)}%`

  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('  COUVERTURE LOOKUP ONEM (LookupEntry) — exception FR/NL/DE')
  console.log('═══════════════════════════════════════════════════════════════\n')
  console.log(`  Lignes totales        : ${nf.format(total)}`)
  console.log(`  Libellés FR uniques   : ${nf.format(uniqFr.size)}  (dédoublonné → ${(total / uniqFr.size).toFixed(1)}× de répétition)\n`)
  console.log('  Couverture par langue (niveau ligne) :')
  console.log(`    FR (source)  : ${nf.format(total)}  (100%)`)
  console.log(`    NL           : ${nf.format(nl).padStart(8)}  (${pct(nl)})`)
  console.log(`    DE           : ${nf.format(de).padStart(8)}  (${pct(de)})`)
  console.log(`    EN           : ${nf.format(en).padStart(8)}  (${pct(en)})  — hors scope lookup\n`)
  console.log('  ── TRAVAIL NEUF (dédoublonné par libellé FR) ──')
  console.log(`    Trou DE : ${nf.format(uniqMissingDe.size)} libellés uniques  ≈ ${nf.format(deGapWords)} mots`)
  console.log(`    Trou NL : ${nf.format(uniqMissingNl.size)} libellés uniques  ≈ ${nf.format(nlGapWords)} mots\n`)
  console.log('  Coût trou DE (mots × tarif/mot, une seule langue) :')
  for (const [label, rate] of [['IA + relecture légère', 0.02], ['IA + relecture pro', 0.05]] as [string, number][]) {
    console.log(`    ${label.padEnd(24)} ≈ ${nf.format(Math.round(deGapWords * rate))} €`)
  }
  console.log('\n  NB : une partie du DE peut venir GRATUITEMENT d\'un ré-import des CSV')
  console.log('  ONEM (qui portent parfois le DE) via scripts/import-lookup-bulk.ts.\n')

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
