import { decimal, semantic, SheetReader, type Point, type ValueSpec } from './v3-common'

const p = (r: number, c: number): Point => ({ r, c })
const isOperator = (value: string) => ['>', '<=', '≤'].includes(value)

/** Source contracts: exchange-rate supplement, care allowance, and integration income. */
export function readOtherAllowances(reader: SheetReader) {
  const exchange = reader.one(value => /wisselkoerstoeslag.*indemnit/i.test(value))
  const care = reader.one(value => /opvanguitkering.*allocation de garde/i.test(value))
  const income = reader.one(value => /leefloon.*revenu d.int.gration/i.test(value))
  if (!exchange || !care || !income || !(exchange.r < care.r && care.r < income.r)) { reader.fail('ambiguous_table_header'); return }
  const indexation = reader.multiplier((value, point) => point.r < exchange.r && /multiplicat/i.test(value))
  const inExchange = (point: Point) => point.r > exchange.r && point.r < care.r
  const oldRegime = reader.one((value, point) => inExchange(point) && /oude regeling.*ancien r.gime/i.test(value))
  const newRegime = reader.one((value, point) => inExchange(point) && /nieuwe regeling.*nouveau r.gime/i.test(value))
  const salary = reader.one((value, point) => inExchange(point) && /brutomaandloon.*salaire mensuel brut/i.test(value))
  if (!oldRegime || !newRegime || !salary || oldRegime.c <= newRegime.c) { reader.fail('ambiguous_table_header'); return }
  const monthlyHeader = (value: string) => /maandbedrag toeslag.*montant mensuel indem/i.test(value)
  const amount = reader.one((value, point) => inExchange(point) && point.c > newRegime.c && point.c < oldRegime.c && monthlyHeader(value))
  const oldAmount = reader.one((value, point) => inExchange(point) && point.c >= oldRegime.c && monthlyHeader(value))
  const factorHeading = reader.one((value, point) => inExchange(point) && /multiplicat/i.test(value))
  if (!amount || !oldAmount || !factorHeading) return
  const factorCells = reader.points.filter(point => inExchange(point) && point.r > factorHeading.r && point.c === factorHeading.c && decimal(reader.cell(point)) !== null)
  if (factorCells.length !== 1) reader.fail('missing_index_multiplier', factorHeading)
  else reader.add(factorCells[0], { key: 'exchange_rate_allowance:index_factor', table: 'exchange_rate_allowance', code: 'index_factor', label: reader.str(factorHeading), context: [reader.str(exchange), reader.str(newRegime)], unit: 'ratio' })

  const rows = reader.points.filter(point => inExchange(point) && point.r > salary.r && point.c === salary.c && isOperator(reader.str(point)))
  const found = new Set<string>()
  const add = (point: Point, table: string, code: string, label: string, unit: ValueSpec['unit'], context: string[], indexed?: ValueSpec['indexation']) => reader.add(point, { key: `${table}:${code}`, table, code, label, context, unit, ...(indexed ? { indexation: indexed } : {}) })
  for (const row of rows) {
    const terms = reader.points.filter(point => point.r === row.r && point.c >= salary.c && point.c < amount.c && reader.str(point))
    const ops = terms.filter(point => isOperator(reader.str(point))).map(point => reader.str(point) === '≤' ? '<=' : reader.str(point))
    const numbers = terms.filter(point => !isOperator(reader.str(point)))
    const branch = ops.join(',') === '<=' ? 'upper_only' : ops.join(',') === '>,<=' ? 'bounded' : ops.join(',') === '>' ? 'lower_only' : null
    if (!branch || numbers.length !== ops.length || numbers.some(point => decimal(reader.cell(point)) === null) || found.has(branch)) { reader.fail('unknown_rate_identity', row); continue }
    found.add(branch)
    const condition = terms.map(point => reader.str(point)).join(' ')
    numbers.forEach((point, i) => add(point, 'exchange_rate_allowance', `${branch}:${ops[i] === '>' ? 'salary_lower' : 'salary_upper'}`, `${reader.str(salary)} (${ops[i]})`, 'EUR/month', [reader.str(exchange), reader.str(newRegime), condition]))
    add(p(row.r, amount.c), 'exchange_rate_allowance', `${branch}:monthly_amount`, reader.str(amount), 'EUR/month', [reader.str(exchange), reader.str(newRegime), condition])
  }
  if (found.size !== 3 || rows.length !== 3) reader.fail('incomplete_rate_identities', salary)
  const oldValues = reader.points.filter(point => point.c === oldAmount.c && point.r > oldAmount.r && point.r < care.r && reader.cell(point)?.t !== 's' && reader.str(point))
  if (oldValues.length !== 1) reader.fail('missing_rate_value', oldAmount)
  else add(oldValues[0], 'exchange_rate_allowance', 'old_regime_monthly_amount', reader.str(oldAmount), 'EUR/month', [reader.str(exchange), reader.str(oldRegime)])

  const daily = reader.one((value, point) => point.r > care.r && point.r < income.r && /dagbedrag.*montant journalier/i.test(value))
  if (!daily) reader.fail('ambiguous_table_header', care)
  else for (const [id, label] of [['full', /^vol\s*-\s*plein$/i], ['half', /^half\s*-\s*demi$/i]] as const) {
    const row = reader.one((value, point) => point.r > daily.r && point.r < income.r && label.test(value))
    if (!row) continue
    const numbers = reader.points.filter(point => point.r === row.r && point.c > row.c && reader.str(point) && reader.cell(point)?.t !== 's')
    if (numbers.length !== 1) reader.fail('missing_rate_value', row)
    else add(numbers[0], 'care_allowance', id, reader.str(care), 'EUR/day', [reader.str(daily), reader.str(row)], indexation)
  }

  const month = reader.one((value, point) => point.r > income.r && semantic(value) === 'maand mois')
  const year = reader.one((value, point) => point.r > income.r && semantic(value) === 'jaar année')
  if (!month || !year) { reader.fail('ambiguous_table_header', income); return }
  for (const [family, match] of [['family', /gezinshoofd.*chef de m.nage/i], ['single', /alleenstaande.*isol/i], ['cohabitant', /samenwonende.*cohabitant/i]] as const) {
    const row = reader.one((value, point) => point.r > Math.max(month.r, year.r) && match.test(value))
    if (!row) continue
    for (const [period, header, unit] of [['month', month, 'EUR/month'], ['year', year, 'EUR/year']] as const) add(p(row.r, header.c), 'integration_income', `${family}:${period}`, reader.str(income), unit, [reader.str(row), reader.str(header)], indexation)
  }
}
