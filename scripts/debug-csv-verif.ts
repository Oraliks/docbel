// Debug VerifCompensatoryRestDay
import { readFile } from 'fs/promises'
import {
  parseCsv,
  findHeaderRow,
  detectColumns,
} from '@/lib/lookup/importLookupCsv'

const f = 'C:/Users/Admin/Downloads/JSON/VerifCompensatoryRestDay-export_fr.csv'

async function main() {
  const content = await readFile(f, 'utf-8')
  const rows = parseCsv(content)
  console.log('Total rows:', rows.length)
  const headerIdx = findHeaderRow(rows)
  console.log('Header index:', headerIdx)
  if (headerIdx >= 0) {
    console.log('Header row:', rows[headerIdx])
    const cols = detectColumns(rows[headerIdx])
    console.log('Detected columns:', cols)
  }
}

main().catch(console.error)
