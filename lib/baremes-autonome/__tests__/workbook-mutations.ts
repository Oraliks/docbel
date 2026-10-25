import * as XLSX from 'xlsx'

/** Test-only Excel move/insert: adjusts A1 references as well as cells, including absolute references. */
export function moveSheet(book: XLSX.WorkBook, name: string, row: (r: number) => number, col: (c: number) => number) {
  const sheet = book.Sheets[name], moved: XLSX.WorkSheet = {}
  for (const [key, cell] of Object.entries(sheet)) {
    if (key.startsWith('!')) continue
    const old = XLSX.utils.decode_cell(key)
    moved[XLSX.utils.encode_cell({ r: row(old.r), c: col(old.c) })] = { ...cell }
  }
  const range = XLSX.utils.decode_range(sheet['!ref']!)
  moved['!ref'] = XLSX.utils.encode_range({ s: { r: row(range.s.r), c: col(range.s.c) }, e: { r: row(range.e.r), c: col(range.e.c) } })
  book.Sheets[name] = moved
  for (const owner of book.SheetNames) for (const [key, cell] of Object.entries(book.Sheets[owner])) {
    if (key.startsWith('!') || !cell.f) continue
    cell.f = cell.f.split(/("(?:[^"]|"")*")/g).map((part: string, segment: number) => {
      if (segment % 2) return part // literal source captions are not references
      let inherited: string | null = null, previousEnd = -2
      return part.replace(/((?:'(?:[^']|'')+'|[A-Za-z_][A-Za-z0-9_ .-]*)!)?(\$?[A-Z]{1,3})(\$?\d+)/g, (match: string, prefix: string | undefined, column: string, line: string, offset: number) => {
        const target = prefix ? prefix.slice(0, -1).replace(/^'|'$/g, '').replaceAll("''", "'") : offset === previousEnd + 1 && part[previousEnd] === ':' ? inherited : owner
        inherited = target; previousEnd = offset + match.length
        if (target !== name || part[offset + match.length] === '(') return match
        const before = XLSX.utils.decode_cell(`${column.replace('$', '')}${line.replace('$', '')}`)
        return `${prefix ?? ''}${column.startsWith('$') ? '$' : ''}${XLSX.utils.encode_col(col(before.c))}${line.startsWith('$') ? '$' : ''}${row(before.r) + 1}`
      })
    }).join('')
  }
}
