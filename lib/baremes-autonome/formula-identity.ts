import type { RateValue, Reading } from './types'

/** Canonical references follow known semantic records, so moving cells is not a formula change. */
export function formulaIdentities(reading: Reading, additional?: Reading) {
  const names = new Map<string, string>()
  for (const value of reading.values) names.set(`${value.source.sheet}!${value.source.cell}`, value.key)
  for (const value of additional?.values ?? [])
    if (!names.has(`${value.source.sheet}!${value.source.cell}`))
      names.set(`${value.source.sheet}!${value.source.cell}`, value.key)
  for (const value of [...reading.values, ...(additional?.values ?? [])])
    if (value.indexation && !names.has(`${value.indexation.source.sheet}!${value.indexation.source.cell}`))
      names.set(
        `${value.indexation.source.sheet}!${value.indexation.source.cell}`,
        `indexation:${value.indexation.source.sheet}`,
      )
  return (value: RateValue) => {
    if (!value.source.formula) return null
    const ownColumn = value.source.cell.match(/^[A-Z]+/)?.[0]
    return value.source.formula
      .split(/("(?:[^"]|"")*")/g)
      .map((part, index) =>
        index % 2
          ? part
          : part
              .replace(
                /((?:'(?:[^']|'')+'|[A-Za-z_][A-Za-z0-9_ .-]*)!)?(\$?[A-Z]{1,3})(\$?\d+)/g,
                (all, prefix: string | undefined, column: string, row: string) => {
                  const sheet = prefix
                    ? prefix.slice(0, -1).replace(/^'|'$/g, '').replaceAll("''", "'")
                    : value.source.sheet
                  const cell = column.replace('$', '') + row.replace('$', '')
                  const known = names.get(`${sheet}!${cell}`)
                  if (known) return `REF(${known})`
                  if (
                    !prefix &&
                    value.source.sheet === 'Uurlonen_Salaires horaires' &&
                    column.replace('$', '') === ownColumn
                  )
                    return `WEEKLY_HOURS(${value.context.find((item) => /heures par semaine/.test(item)) ?? 'unknown'})`
                  return `${sheet}!${cell}`
                },
              )
              .replace(/\s+/g, ''),
      )
      .join('')
  }
}
