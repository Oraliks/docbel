import * as XLSX from 'xlsx'

export interface ParsedSheet {
  name: string
  category: string
  sheetIndex: number
  rowCount: number
  colCount: number
  cellData: string[][]  // Grid: rows of cells (string values)
  searchText: string    // Concatenated text for search
}

export interface ParsedBaremaData {
  fileMetadata: {
    effectiveDate: string
    multiplicateur?: number
  }
  sheets: ParsedSheet[]
}

const SHEET_CATEGORY_MAP: Record<string, string> = {
  'A_N_B_vol_plein': 'Allocations chômage - Plein temps',
  'A_N_B_half_demi': 'Allocations chômage - Mi-temps',
  'TW-CT_JS': 'Chômage temporaire',
  'SpecCat': 'Catégories spéciales',
  'Loonschijven_Tranches salariale': 'Tranches salariales',
  'Uurlonen_Salaires horaires': 'Salaires horaires',
  'W ': 'Allocations W',
  'AndereBedrWLH_AutresMontCHOM': 'Autres montants chômage',
  'Activering_Activation': 'Allocations activation',
  'AndereUitk_AutresAlloc': 'Autres allocations',
  'Bonus': 'Bonus emploi',
  'Basisbedragen': 'Montants de base',
}

export function parseBaremaFile(buffer: ArrayBuffer): ParsedBaremaData {
  try {
    const workbook = XLSX.read(buffer, { cellDates: true })

    const effectiveDate = extractEffectiveDate(workbook)
    const multiplicateur = extractMultiplicateur(workbook)

    const sheets: ParsedSheet[] = workbook.SheetNames.map((sheetName, index) => {
      const worksheet = workbook.Sheets[sheetName]
      const category = SHEET_CATEGORY_MAP[sheetName] || sheetName

      const { cellData, rowCount, colCount, searchText } = extractGrid(worksheet)

      return {
        name: sheetName,
        category,
        sheetIndex: index,
        rowCount,
        colCount,
        cellData,
        searchText,
      }
    })

    return {
      fileMetadata: {
        effectiveDate,
        multiplicateur,
      },
      sheets,
    }
  } catch (error) {
    throw new Error(
      `Failed to parse Excel file: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

function extractGrid(worksheet: XLSX.WorkSheet): {
  cellData: string[][]
  rowCount: number
  colCount: number
  searchText: string
} {
  if (!worksheet['!ref']) {
    return { cellData: [], rowCount: 0, colCount: 0, searchText: '' }
  }

  const range = XLSX.utils.decode_range(worksheet['!ref'])
  const maxRow = range.e.r
  const maxCol = range.e.c

  const cellData: string[][] = []
  const searchTextParts: string[] = []

  for (let r = 0; r <= maxRow; r++) {
    const row: string[] = []
    for (let c = 0; c <= maxCol; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c })
      const cell = worksheet[cellRef]

      let value = ''
      if (cell) {
        if (cell.w !== undefined) {
          value = String(cell.w)
        } else if (cell.v !== undefined) {
          value = String(cell.v)
        }
      }

      row.push(value)
      if (value && value.trim() && !value.startsWith('#')) {
        searchTextParts.push(value)
      }
    }
    cellData.push(row)
  }

  // Trim trailing empty rows
  while (cellData.length > 0 && cellData[cellData.length - 1].every((c) => !c.trim())) {
    cellData.pop()
  }

  return {
    cellData,
    rowCount: cellData.length,
    colCount: maxCol + 1,
    searchText: searchTextParts.join(' '),
  }
}

function extractEffectiveDate(workbook: XLSX.WorkBook): string {
  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName]
    for (const cell in ws) {
      if (cell.startsWith('!')) continue
      const cellObj = ws[cell]
      const value = String(cellObj.w || cellObj.v || '')
      const match = value.match(/(\d{1,2})-(\d{1,2})-(\d{4})/)
      if (match) {
        return value
      }
      // Dates sérialisées ISO ("2026-03-01" ou "2026-03-01 00:00:00") :
      // renvoyées au format belge D-M-YYYY pour rester compatibles avec
      // parseBelgianDate côté normalisation.
      const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
      if (iso) {
        return `${Number(iso[3])}-${Number(iso[2])}-${iso[1]}`
      }
    }
  }
  // Pas de date détectée → chaîne vide. On ne devine JAMAIS une période
  // légale (la date du jour serait mensongère) ; l'import lèvera une issue
  // 'missing_period' bloquante si le nom de fichier n'en fournit pas non plus.
  return ''
}

function extractMultiplicateur(workbook: XLSX.WorkBook): number | undefined {
  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName]
    for (const cell in ws) {
      if (cell.startsWith('!')) continue
      const value = ws[cell].v
      if (typeof value === 'number' && value > 1.5 && value < 2) {
        return parseFloat(value.toFixed(4))
      }
    }
  }
  return undefined
}
