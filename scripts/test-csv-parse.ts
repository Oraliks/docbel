// Test du parser CSV sur chaque fichier ONEM téléchargé. Détecte les bugs
// sans avoir besoin de toucher la DB.
// Usage: pnpm exec tsx scripts/test-csv-parse.ts

import { readFile, readdir } from 'fs/promises'
import path from 'path'
import { parseCsv } from '../lib/lookup/importLookupCsv'

const DOWNLOADS = 'C:/Users/Admin/Downloads'

async function main() {
  const files = await readdir(DOWNLOADS)
  const csvs = files.filter((f) => f.endsWith('-export_fr.csv'))

  for (const f of csvs) {
    const fullPath = path.join(DOWNLOADS, f)
    const content = await readFile(fullPath, 'utf-8')
    try {
      const rows = parseCsv(content)
      const headerIdx = rows.findIndex((r) =>
        r.some((c) => /^code\b/i.test((c ?? '').trim()))
      )
      const header = headerIdx >= 0 ? rows[headerIdx] : null
      const dataRows = headerIdx >= 0 ? rows.length - headerIdx - 1 : 0

      console.log(`✓ ${f}`)
      console.log(`  rows: ${rows.length}, header at row ${headerIdx}, data rows: ${dataRows}`)
      if (header) {
        const colNames = header.map((c, i) => `[${i}]${c?.slice(0, 25)}`).join(' | ')
        console.log(`  cols (${header.length}): ${colNames}`)
      }
    } catch (err) {
      console.log(`✗ ${f}: ${err instanceof Error ? err.message : err}`)
    }
    console.log('')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
