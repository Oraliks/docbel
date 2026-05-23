// Smoke test du pipeline d'import barème sur le vrai fichier ONEM.
// Usage: pnpm exec tsx scripts/smoke-test-baremes.ts
// Pas d'écriture DB.

import { readFile } from 'fs/promises'
import path from 'path'
import { parseBaremaFile } from '../lib/baremes-parser'
import { normalizeBaremeData } from '../lib/baremes/normalizeBaremeData'
import { extractValidFromFileName } from '../lib/baremes/normalize'

const FILE = path.join(
  process.cwd(),
  'public/uploads/baremes/1777763910366-barema-new-01042026.xlsx'
)

async function main() {
  const buffer = await readFile(FILE)
  const ab = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer
  const parsed = parseBaremaFile(ab)

  const validFrom = extractValidFromFileName(path.basename(FILE))
  console.log('Date détectée dans le nom de fichier:', validFrom?.toISOString().slice(0, 10))

  const normalized = normalizeBaremeData(parsed, validFrom)

  console.log('\n=== RÉSUMÉ ===')
  console.log(JSON.stringify(normalized.summary, null, 2))

  console.log('\n=== ALERTES ===')
  for (const a of normalized.alerts) {
    console.log(`[${a.level}] ${a.sheet ? `(${a.sheet}) ` : ''}${a.message}`)
  }

  console.log('\n=== EXEMPLES PAR CATÉGORIE ===')
  const byCat: Record<string, typeof normalized.amounts> = {}
  for (const a of normalized.amounts) {
    if (!byCat[a.category]) byCat[a.category] = []
    byCat[a.category].push(a)
  }

  for (const [cat, list] of Object.entries(byCat)) {
    console.log(`\n--- ${cat} (${list.length} montants) ---`)
    for (const a of list.slice(0, 3)) {
      console.log(
        JSON.stringify({
          sourceSheet: a.sourceSheet,
          allocationCode: a.allocationCode,
          salaryCode: a.salaryCode,
          article: a.article,
          labelNl: a.labelNl,
          amount: a.amount,
          minDailySalary: a.minDailySalary,
          maxDailySalary: a.maxDailySalary,
          unit: a.unit,
          comparisonKey: a.comparisonKey,
          validFrom: a.validFrom?.toISOString().slice(0, 10),
        })
      )
    }
  }

  console.log(`\n=== TOTAL : ${normalized.amounts.length} montants extraits ===`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
