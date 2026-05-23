import * as XLSX from 'xlsx'
import { readFile } from 'fs/promises'
import path from 'path'

const FILE = path.join(
  process.cwd(),
  'public/uploads/baremes/1777763910366-barema-new-01042026.xlsx'
)

const TARGET_SHEETS = [
  'TW-CT_JS',
  'SpecCat',
  'Uurlonen_Salaires horaires',
  'W ',
  'AndereBedrWLH_AutresMontCHOM',
  'Activering_Activation',
  'AndereUitk_AutresAlloc',
  'Bonus',
]

function dumpSheet(workbook, name) {
  const ws = workbook.Sheets[name]
  if (!ws) {
    console.log(`\n=== ${name} (NOT FOUND) ===\n`)
    return
  }
  const ref = ws['!ref']
  if (!ref) {
    console.log(`\n=== ${name} (empty) ===\n`)
    return
  }
  const range = XLSX.utils.decode_range(ref)
  const maxRow = Math.min(range.e.r, 25)
  const maxCol = range.e.c

  console.log(`\n=== ${name} ===`)
  console.log(`Range: ${ref} (rows: ${range.e.r + 1}, cols: ${maxCol + 1})`)
  console.log(`Showing first ${maxRow + 1} rows (non-empty cells with coords):\n`)

  for (let r = 0; r <= maxRow; r++) {
    const cells = []
    for (let c = 0; c <= maxCol; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c })
      const cell = ws[cellRef]
      if (!cell) continue
      let v = cell.w !== undefined ? String(cell.w) : String(cell.v ?? '')
      if (!v.trim()) continue
      cells.push(`${cellRef}=${v.length > 25 ? v.slice(0, 22) + '...' : v}`)
    }
    if (cells.length === 0) {
      console.log(`R${String(r).padStart(2, '0')} (vide)`)
    } else {
      console.log(`R${String(r).padStart(2, '0')} ${cells.join(' | ')}`)
    }
  }
}

const buffer = await readFile(FILE)
const workbook = XLSX.read(buffer, { cellDates: true })

console.log(`Available sheets: ${workbook.SheetNames.join(', ')}`)

for (const sheet of TARGET_SHEETS) {
  dumpSheet(workbook, sheet)
}
