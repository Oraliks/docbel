// Extrait tous les codes uniques du smoke test pour préparer le glossaire.
// Usage: pnpm exec tsx scripts/dump-unique-codes.ts

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
  const normalized = normalizeBaremeData(parsed, validFrom)

  // Group by category
  const byCategory: Record<
    string,
    { allocationCodes: Set<string>; salaryCodes: Set<string>; articles: Set<string> }
  > = {}

  for (const a of normalized.amounts) {
    if (!byCategory[a.category]) {
      byCategory[a.category] = {
        allocationCodes: new Set(),
        salaryCodes: new Set(),
        articles: new Set(),
      }
    }
    const bucket = byCategory[a.category]
    if (a.allocationCode) bucket.allocationCodes.add(a.allocationCode)
    if (a.salaryCode) bucket.salaryCodes.add(a.salaryCode)
    if (a.article) bucket.articles.add(a.article)
  }

  for (const [cat, bucket] of Object.entries(byCategory)) {
    console.log(`\n=== ${cat} ===`)
    const allocs = [...bucket.allocationCodes].sort()
    const tranches = [...bucket.salaryCodes].sort((a, b) => {
      const na = Number(a)
      const nb = Number(b)
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb
      return a.localeCompare(b)
    })
    const articles = [...bucket.articles].sort()
    if (allocs.length > 0) {
      console.log(`  Codes alloc (${allocs.length}): ${allocs.join(', ')}`)
    }
    if (tranches.length > 0 && tranches.length <= 30) {
      console.log(`  Codes tranche (${tranches.length}): ${tranches.join(', ')}`)
    } else if (tranches.length > 30) {
      console.log(
        `  Codes tranche (${tranches.length}): ${tranches.slice(0, 10).join(', ')}…${tranches.slice(-3).join(', ')}`
      )
    }
    if (articles.length > 0 && articles.length <= 15) {
      console.log(`  Articles: ${articles.join(' | ')}`)
    } else if (articles.length > 15) {
      console.log(`  Articles (${articles.length}): ${articles.slice(0, 8).join(' | ')}…`)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
