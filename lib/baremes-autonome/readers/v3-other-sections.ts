import * as XLSX from 'xlsx'
import { SheetReader, address, semantic, type Point, type ValueSpec } from './v3-common'
import { readOtherAllowances } from './v3-other-allowances'

const token = (value: string) => semantic(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'unknown'
const populated = (cell?: XLSX.CellObject) => !!cell && (cell.v != null || !!cell.f)
const isAmount = (cell?: XLSX.CellObject) => populated(cell) && (cell?.t === 'n' || cell?.t === 'e' || !!cell?.f && cell.t !== 's')
const point = (r: number, c: number): Point => ({ r, c })

function addUnique(reader: SheetReader, keys: Set<string>, source: Point, spec: ValueSpec) {
  if (keys.has(spec.key)) { reader.fail('duplicate_semantic_identity', source); return }
  keys.add(spec.key)
  reader.add(source, spec)
}

function claimText(reader: SheetReader) {
  for (const p of reader.points) {
    const cell = reader.cell(p)
    if (cell?.t === 's') {
      if (!reader.claimed.has(address(p))) reader.claim(p, 'metadata')
    }
  }
}

function dependsOnSource(reader: SheetReader, start: Point, target: NonNullable<ValueSpec['indexation']>['source']) {
  const targetKey = `${target.sheet}!${target.cell}`
  const visited = new Set<string>()
  const visit = (sheetName: string, cellAddress: string, depth: number): boolean => {
    const key = `${sheetName}!${cellAddress}`
    if (key === targetKey) return true
    if (depth > 12 || visited.has(key)) return false
    visited.add(key)
    const cell = reader.workbook.Sheets[sheetName]?.[cellAddress]
    if (!cell?.f) return false
    const formula = String(cell.f)
    const refs: Array<{ sheet: string; cell: string }> = []
    const quoted = /'([^']+)'!\$?([A-Z]{1,3})\$?(\d+)/gi
    let remainder = formula.replace(quoted, (_match, sheet: string, col: string, row: string) => {
      refs.push({ sheet, cell: `${col.toUpperCase()}${row}` })
      return ' '
    })
    const plainSheet = /\b([A-Za-z_][A-Za-z0-9_]*)!\$?([A-Z]{1,3})\$?(\d+)/g
    remainder = remainder.replace(plainSheet, (_match, sheet: string, col: string, row: string) => {
      refs.push({ sheet, cell: `${col.toUpperCase()}${row}` })
      return ' '
    })
    const local = /(?<![A-Za-z0-9_!])\$?([A-Z]{1,3})\$?(\d+)/gi
    for (const match of remainder.matchAll(local)) refs.push({ sheet: sheetName, cell: `${match[1].toUpperCase()}${match[2]}` })
    return refs.some(ref => visit(ref.sheet, ref.cell, depth + 1))
  }
  return visit(reader.name, address(start), 0)
}

function uniqueAnchor(reader: SheetReader, predicate: (value: string, p: Point) => boolean, code: string) {
  const matches = reader.find(predicate)
  if (matches.length !== 1) { reader.fail(code); return null }
  return matches[0]
}

const OTHER_UNEMPLOYMENT_EXPECTED = new Set([
  'art_28_2_5_mb_am|refertemaandloon_salaire_mensuel_de_reference|month',
  'art_37_10_mb_am_art_195_2|refertedagloon_artiesten_salaire_journalier_de_reference_artistes|day',
  'art_37|minimumbedrag_montant_minimal|month', 'art_37|minimumbedrag_montant_minimal|year',
  'art_37|gemiddeld_minimum_maandinkomen_revenu_minimum_mensuel_moyen|month',
  'art_45bis_2_al_1_3|vrijwilligerswerk_fiscale_plafonds_volontariat_plafonds_fiscaux|day',
  'art_45bis_2_al_1_3|vrijwilligerswerk_fiscale_plafonds_volontariat_plafonds_fiscaux|year',
  'art_46_3_7|zitpenningen_culturele_sector_jetons_de_presence_secteur_culturel|year',
  'art_48bis_2_al_9_art_195_3|artistieke_activiteiten_bedrag_y_activites_artistiques_montant_y|day',
  'art_79_10_al_5|gemiddeld_minimum_maandinkomen_revenu_minimum_mensuel_moyen|month',
  'art_110|beroepsinkomen_partner_revenu_professionnel_conjoint|month',
  'art_110|beroepsinkomen_kind_revenu_professionnel_enfant|month',
  'art_110|vervangingsinkomen_revenu_de_remplacement|month',
  'art_110|vervangingsinkomen_onthaalouder_revenu_de_remplacement_gardien|month',
  'art_110|vervangingsinkomen_kind_revenu_de_remplacement_enfant|month',
  'art_110|gepensioneerd_ascendent_kind_ascendant_pensionne_enfant|month',
  'art_110|gepensioneerd_ascendent_ascendant_pensionne|month',
  'art_110|gehandicapt_gepensioneerd_ascendent_ascendant_pensionne_handicape|month',
  'art_111_al_2|loongrens_a1_plafond_salarial_a1|day', 'art_111_al_2|loongrens_a1_plafond_salarial_a1|month',
  'art_111_al_2|loongrens_a2_plafond_salarial_a2|day', 'art_111_al_2|loongrens_a2_plafond_salarial_a2|month',
  'art_111_al_2|loongrens_b_plafond_salarial_b|day', 'art_111_al_2|loongrens_b_plafond_salarial_b|month',
  'art_111_al_2|loongrens_c_plafond_salarial_c|day', 'art_111_al_2|loongrens_c_plafond_salarial_c|month',
  'art_111_al_2|loongrens_ax_plafond_salarial_ax|day', 'art_111_al_2|loongrens_ax_plafond_salarial_ax|month',
  'art_111_al_2|loongrens_az_plafond_salarial_az|day', 'art_111_al_2|loongrens_az_plafond_salarial_az|month',
  'art_114_5|max_48_maanden_max_48_mois|half_day', 'art_114_5|max_48_maanden_max_48_mois|day', 'art_114_5|max_48_maanden_max_48_mois|month',
  'art_114bis_al_3|a_samenwonende_met_gezinslast_cohabitant_avec_charge_de_famille|day',
  'art_114bis_al_3|n_alleenwonende_isole|day', 'art_114bis_al_3|b_samenwonende_cohabitant|day',
  'art_115_1_al_1_3_d|verhoogd_forfait_b_voldoende_bv_forfait_majore_b_pp_suffisant|day',
  'art_115_1_al_2|verhoging_minimum_bevoorrecht_samenwonende_augmentation_minimum_cohabitant_privilegie|day',
  'art_125|vrijstelling_mantelzorg_inschakelingsuitkeringen_dispenses_aidant_proche_allocations_d_insertion|half_day',
  'art_125|vrijstelling_mantelzorg_inschakelingsuitkeringen_dispenses_aidant_proche_allocations_d_insertion|day',
  'art_125|vrijstelling_mantelzorg_inschakelingsuitkeringen_dispenses_aidant_proche_allocations_d_insertion|month',
  'art_129bis_1_al_2|werkhervattingstoeslag_complement_de_reprise_de_travail|month',
  'art_129ter_1bis_al_2|maand_1_12|month', 'art_129ter_1bis_al_2|maand_13_24|month', 'art_129ter_1bis_al_2|maand_25_36|month',
  'art_129quater_1_al_2|toeslag_na_activiteitencooperatie_complement_apres_cooperatives_d_activites|month',
  'art_130_2|toegelaten_cumul_vanaf_geldigheid_barema_cumul_autorise_a_partir_de_la_validite_bareme|day',
  'art_130_2|toegelaten_cumul_vanaf_geldigheid_barema_cumul_autorise_a_partir_de_la_validite_bareme|month',
  'art_130_2|toegelaten_cumul_vanaf_geldigheid_barema_cumul_autorise_a_partir_de_la_validite_bareme|year',
  'art_130bis|a_samenwonende_met_gezinslast_cohabitant_avec_charge_de_famille|half_day',
  'art_130bis|a_samenwonende_met_gezinslast_cohabitant_avec_charge_de_famille|day',
  'art_130bis|n_alleenwonende_isole|half_day', 'art_130bis|n_alleenwonende_isole|day',
  'art_131bis_1_4|igu_refertemaandloon_agr_salaire_mensuel_de_reference|month',
  'art_131bis_2bis_al_3|igu_uurtoeslag_agr_supplement_par_heure|hour',
  'art_131bis_3_3|igu_minimale_halve_uitkering_agr_demi_allocation_minimale|half_day',
  'art_131septies_1_5_al_1|kinderopvangtoeslag_complement_de_garde_d_enfants|month',
  'art_171_al_1|bestaansmiddelen_moyens_d_existence|year',
  'art_188_2_al_1|artistieke_activiteiten_bedrag_y_2024_activites_artistiques_montant_y_2024|day',
  'art_189_1_al_4|toegelaten_cumul_kunstwerkers_cumul_autorise_travailleurs_des_arts|day',
  'art_189_1_al_4|toegelaten_cumul_kunstwerkers_cumul_autorise_travailleurs_des_arts|month',
  'art_189_1_al_4|toegelaten_cumul_kunstwerkers_cumul_autorise_travailleurs_des_arts|year',
  'kb_03_05_2007|niet_vervanging_swt_non_remplacement_rcc|day',
])

function otherUnemployment(reader: SheetReader) {
  const keys = new Set<string>()
  const indexation = reader.multiplier()
  const articleHeader = uniqueAnchor(reader, v => semantic(v) === 'artikel - article', 'missing_other_unemployment_headers')
  const labelHeader = uniqueAnchor(reader, v => semantic(v) === 'uitleg - explications', 'missing_other_unemployment_headers')
  if (!articleHeader || !labelHeader || articleHeader.r !== labelHeader.r) return
  const unitLabels = new Map<string, ValueSpec['unit']>([['hour', 'EUR/hour'], ['half_day', 'EUR/half-day'], ['day', 'EUR/day'], ['month', 'EUR/month'], ['year', 'EUR/year']])
  const columns = new Map<number, { unit: ValueSpec['unit']; name: string }>()
  for (const p of reader.points.filter(p => p.r === articleHeader.r && p.c > labelHeader.c)) {
    const label = semantic(reader.str(p))
    const unit = label.includes('uur') || label.includes('heure') ? 'hour'
      : label.includes('halve dag') || label.includes('demi jour') ? 'half_day'
        : label.includes('dag') || label.includes('jour') ? 'day'
          : label.includes('maand') || label.includes('mois') ? 'month'
            : label.includes('jaar') || label.includes('annee') ? 'year' : null
    if (unit) {
      if ([...columns.values()].some(value => value.name === unit)) reader.fail('ambiguous_unit_header', p)
      else columns.set(p.c, { unit: unitLabels.get(unit)!, name: unit })
    }
  }
  for (const unit of unitLabels.keys()) if (![...columns.values()].some(value => value.name === unit)) reader.fail('missing_unit_header')
  if (columns.size !== 5) return
  let article = ''
  const found = new Set<string>()
  const range = XLSX.utils.decode_range(reader.sheet['!ref'] ?? 'A1:A1')
  for (let r = articleHeader.r + 1; r <= range.e.r; r++) {
    const articleText = reader.str(point(r, articleHeader.c))
    if (/^(?:art\.|kb\s)/i.test(articleText)) article = articleText
    const label = reader.str(point(r, labelHeader.c))
    const identityLabel = token(label)
    for (const [col, { unit, name: unitName }] of columns) {
      const p = point(r, col)
      if (!isAmount(reader.cell(p))) continue
      if (!article || !label) { reader.fail('unknown_rate_identity', p); continue }
      const contractKey = `${token(article)}|${token(label)}|${unitName}`
      if (!OTHER_UNEMPLOYMENT_EXPECTED.has(contractKey)) { reader.fail('unknown_rate_identity', p); continue }
      found.add(contractKey)
      const key = `other_unemployment/${contractKey.replaceAll('|', '/')}`
      addUnique(reader, keys, p, {
        key, table: 'other_unemployment', code: article, label, context: [article, label, `Unité: ${unitName}`], unit,
        ...(indexation && dependsOnSource(reader, p, indexation.source) ? { indexation } : {}),
      })
    }
    if (label && article && identityLabel && ![...columns].some(([col]) => isAmount(reader.cell(point(r, col))))
      && [...OTHER_UNEMPLOYMENT_EXPECTED].some(expected => expected.startsWith(`${token(article)}|${identityLabel}|`))) {
      reader.fail('missing_supported_rate_identity', point(r, labelHeader.c))
    }
  }
  for (const expected of OTHER_UNEMPLOYMENT_EXPECTED) if (!found.has(expected)) reader.fail('missing_supported_rate_identity')
  claimText(reader)
}

const W_CODES = new Set([
  'WA2V', 'WA7V', 'WA2', 'WA72', 'DA1', 'DA2', 'WA6V', 'WA62', 'WN2', 'DN1', 'DN2', 'WP2', 'DP1', 'DP2',
  'WB2', 'DB1', 'DB2', 'IN', 'TA', 'IA', 'TN', 'IP', 'TP', 'S', 'SA3F', 'SA7F', 'SA3', 'SA73', 'SA6F', 'SA63',
  'SN3', 'SP3', 'SB3', 'I', 'T',
])

function wSheet(reader: SheetReader) {
  const keys = new Set<string>()
  const indexation = reader.multiplier()
  const ageHeader = uniqueAnchor(reader, value => semantic(value).includes('leeftijd') && (semantic(value).includes('age') || semantic(value).includes('âge')), 'missing_age_header')
  const fullHeader = uniqueAnchor(reader, value => token(value).includes('allocation_entiere'), 'missing_full_amount_header')
  const halfHeader = uniqueAnchor(reader, value => semantic(value).includes('demi allocation'), 'missing_half_amount_header')
  if (!ageHeader || !fullHeader || !halfHeader || fullHeader.c === halfHeader.c) return
  const codeFrequency = new Map<number, number>()
  for (const p of reader.points) {
    const codes = reader.str(p).split(/\s+/).filter(Boolean)
    if (p.r > ageHeader.r && codes.length && codes.every(code => W_CODES.has(code))) codeFrequency.set(p.c, (codeFrequency.get(p.c) ?? 0) + 1)
  }
  const maxFrequency = Math.max(0, ...codeFrequency.values())
  const codeColumns = [...codeFrequency].filter(([, count]) => count === maxFrequency && count > 0).map(([col]) => col)
  if (codeColumns.length !== 1) { reader.fail('ambiguous_code_column'); return }
  const codeCol = codeColumns[0]
  const ageCol = ageHeader.c
  const firstCodeRow = ageHeader.r + 1
  const stageAnchor = uniqueAnchor(reader, value => /(?:tijdens de bit|pendant le sip)/i.test(value), 'missing_post_sip_section')
  if (!stageAnchor || !Number.isFinite(firstCodeRow)) return
  const fullTable = 'insertion_assimilees_full'
  const halfTable = 'insertion_assimilees_half'
  const legends = reader.find(value => /^[wdist]\s*=/i.test(value)).map(p => {
    const label = reader.points.filter(other => other.r === p.r && other.c > p.c).map(other => reader.str(other)).find(Boolean)
    return [reader.str(p), label].filter(Boolean).join(' ')
  })
  const expected = new Set([
    'wa2v_wa7v/sans_limite_age', 'da1_da2_wa2_wa72/sans_limite_age', 'wa6v/sans_limite_age', 'wa62/sans_limite_age',
    'dn1_dn2_wn2/gt_21', 'dn1_dn2_wn2/gt_18_lt_21', 'wn2/lt_18', 'dp1_dp2_wp2/gt_18', 'wp2/lt_18',
    'db1_db2_wb2/gt_18', 'wb2/lt_18', 'ia_ta/sans_limite_age', 'in/gt_21', 'in/gt_18_lt_21', 'in_tn/lt_18',
    'ip/gt_18', 'ip_tp/lt_18', 'i/gt_18', 'i_t/lt_18', 's/sans_limite_age', 'sa3f_sa7f/sans_limite_age',
    'sa3_sa73/sans_limite_age', 'sa6f/sans_limite_age', 'sa63/sans_limite_age', 'sn3/gt_21', 'sn3/gt_18_lt_21',
    'sn3/lt_18', 'sp3/gt_18', 'sp3/lt_18', 'sb3/gt_18', 'sb3/lt_18',
  ])
  const found = new Set<string>()
  const valuesByRow = new Map<number, Point[]>()
  for (const p of reader.points) if (p.r >= firstCodeRow && (p.c === fullHeader.c || p.c === halfHeader.c) && isAmount(reader.cell(p))) {
    valuesByRow.set(p.r, [...(valuesByRow.get(p.r) ?? []), p])
  }
  const range = XLSX.utils.decode_range(reader.sheet['!ref'] ?? 'A1:A1')
  for (let r = firstCodeRow; r <= range.e.r; r++) {
    const codeText = reader.str(point(r, codeCol))
    const codes = codeText.split(/\s+/).filter(Boolean)
    const rowAmounts = valuesByRow.get(r) ?? []
    if (!codeText && !rowAmounts.length) continue
    if (!codes.length || codes.some(code => !W_CODES.has(code))) { reader.fail('unknown_rate_identity', point(r, codeCol)); continue }
    const age = reader.str(point(r, ageCol))
    const normalizedAge = semantic(age)
    const ageId = !age || normalizedAge === '//' ? 'sans_limite_age'
      : /^>\s*18\s+en\s+<\s*21$/.test(normalizedAge) ? 'gt_18_lt_21'
        : /^>\s*(\d+)$/.test(normalizedAge) ? `gt_${normalizedAge.match(/\d+/)?.[0]}`
          : /^<\s*(\d+)$/.test(normalizedAge) ? `lt_${normalizedAge.match(/\d+/)?.[0]}` : token(age)
    const groupCode = codes.slice().sort().join('+')
    const identity = `${token(groupCode)}/${ageId}`
    if (found.has(identity)) reader.fail('duplicate_semantic_identity', point(r, codeCol))
    found.add(identity)
    if (!expected.has(identity)) reader.fail('unknown_rate_identity', point(r, codeCol))
    const expectedColumns = r < stageAnchor.r ? [fullHeader.c, halfHeader.c] : [fullHeader.c]
    for (const col of expectedColumns) {
      const p = point(r, col)
      if (!isAmount(reader.cell(p))) reader.fail('missing_rate_value', p)
    }
    for (const p of rowAmounts) {
      if (!expectedColumns.includes(p.c)) { reader.fail('unexpected_half_or_full_amount', p); continue }
      const isFull = p.c === fullHeader.c
      const table = isFull ? fullTable : halfTable
      const rowContext = reader.points.filter(cell => cell.r === r && (cell.c < codeCol || cell.c > ageCol && cell.c < fullHeader.c))
        .map(cell => reader.str(cell)).filter(Boolean)
      const code = groupCode
      const key = `${table}/${identity}`
      addUnique(reader, keys, p, {
        key, table, code, label: 'Allocation d’insertion ou assimilée', context: [...legends.map(legend => `Légende source: ${legend}`), ...rowContext, ...(age && age !== '//' ? [`Âge source: ${age}`] : [])],
        unit: 'EUR/day', ...(indexation && dependsOnSource(reader, p, indexation.source) ? { indexation } : {}),
      })
    }
  }
  for (const identity of expected) if (!found.has(identity)) reader.fail('missing_supported_rate_identity')
  for (const p of reader.points) {
    if (p.r >= firstCodeRow && (p.c === fullHeader.c || p.c === halfHeader.c) && isAmount(reader.cell(p)) && !valuesByRow.has(p.r)) reader.fail('unmapped_sheet_value', p)
  }
  claimText(reader)
}

const ACTIVATION_CODES = new Map([
  ['CA/ ••1••••', 'sine_old'], ['CA/ ••2••••', 'sine_old'], ['CA/ ••#••••', 'sine_new'],
  ['G•/ ••WA1••', 'activa_wallonia'], ['G•/ ••WA2••', 'activa_wallonia'], ['G•/ ••WA3••', 'activa_wallonia'],
  ['G•/ ••WB1••', 'activa_wallonia'], ['G•/ ••WB2••', 'activa_wallonia'], ['G•/ ••WB3••', 'activa_wallonia'],
  ['G•/ ••BA1••', 'activa_brussels'], ['G•/ ••BA2••', 'activa_brussels'], ['G•/ ••BA3••', 'activa_brussels'],
  ['G•/ ••BB1••', 'activa_brussels'], ['G•/ ••BB2••', 'activa_brussels'],
].map(([code, section]) => [token(code), section] as const))

function activation(reader: SheetReader) {
  const keys = new Set<string>()
  const headers = reader.find(value => semantic(value) === 'code').flatMap(codeHeader => {
    const nextCode = reader.points.filter(p => p.r === codeHeader.r && p.c > codeHeader.c && semantic(reader.str(p)) === 'code').sort((a, b) => a.c - b.c)[0]
    const amountHeaders = reader.points.filter(p => p.r === codeHeader.r && p.c > codeHeader.c && (!nextCode || p.c < nextCode.c) && /maximum maandbedrag|maximum mensuel/i.test(reader.str(p)))
    if (amountHeaders.length !== 1) { reader.fail('missing_activation_amount_header', codeHeader); return [] }
    return [{ codeHeader, amountHeader: amountHeaders[0] }]
  })
  if (headers.length !== 4) reader.fail('incomplete_activation_tables')
  const seen = new Set<string>()
  const range = XLSX.utils.decode_range(reader.sheet['!ref'] ?? 'A1:A1')
  for (const { codeHeader, amountHeader } of headers) {
    const nextHeader = headers.filter(other => other.codeHeader.c === codeHeader.c && other.codeHeader.r > codeHeader.r).sort((a, b) => a.codeHeader.r - b.codeHeader.r)[0]
    const end = nextHeader ? nextHeader.codeHeader.r - 1 : range.e.r
    for (let r = codeHeader.r + 1; r <= end; r++) {
      const codePoint = point(r, codeHeader.c), valuePoint = point(r, amountHeader.c)
      const code = reader.str(codePoint), cell = reader.cell(valuePoint), raw = reader.str(valuePoint)
      const normalizedCode = token(code)
      const section = ACTIVATION_CODES.get(normalizedCode)
      const isStructuralText = /^(?:sine|code|oude regeling|ancien régime|nieuwe regeling|nouveau régime|activa|werkuitkering|allocation de travail|#\s*=)/i.test(code)
      const expression = cell?.t === 's' && /^\s*\d[\d.,]*\s*(?:X|×)\s*.+/i.test(raw)
      if (code && !section && !isStructuralText) reader.fail('unknown_activation_code', codePoint)
      if (!code && populated(cell)) reader.fail('missing_activation_code', codePoint)
      if (section) {
        if (seen.has(normalizedCode)) reader.fail('duplicate_activation_code', codePoint)
        seen.add(normalizedCode)
        if (!isAmount(cell) && !expression) { reader.fail('missing_activation_value', valuePoint); continue }
        const amountText = expression ? raw : ''
        const contextLabel = section === 'sine_old' ? 'SINE — ancien régime' : section === 'sine_new' ? 'SINE — nouveau régime'
          : section === 'activa_wallonia' ? 'ACTIVA — Wallonie' : 'ACTIVA — Bruxelles'
        addUnique(reader, keys, valuePoint, {
          key: `activation/${section}/${normalizedCode}`, table: 'activation_allowances', code, label: code,
          context: [contextLabel, ...(amountText ? [`Expression source: ${amountText}`] : [])], unit: 'EUR/month',
          ...(expression ? { valueKind: 'expression' as const } : {}),
        })
      } else if (populated(cell)) {
        if (!expression) reader.fail('unknown_activation_expression', valuePoint)
        else reader.fail('activation_expression_without_code', valuePoint)
      }
    }
  }
  for (const code of ACTIVATION_CODES.keys()) if (!seen.has(code)) reader.fail('missing_activation_identity')
  for (const p of reader.points) {
    const cell = reader.cell(p)
    const raw = reader.str(p)
    if (cell?.t === 's' && /^\s*\d[\d.,]*\s*(?:X|×)\s*.+/i.test(raw) && !reader.claimed.has(address(p))) reader.fail('unknown_activation_expression', p)
  }
  claimText(reader)
}

function bonus(reader: SheetReader) {
  const keys = new Set<string>()
  const indexation = reader.multiplier()
  const sHeaders = reader.find(value => semantic(value) === 's')
  if (sHeaders.length !== 2) { reader.fail('ambiguous_bonus_tables'); return }
  const groups = sHeaders.map(sHeader => {
    const rHeaders = reader.points.filter(p => p.r === sHeader.r && p.c > sHeader.c && semantic(reader.str(p)) === 'r')
    if (rHeaders.length !== 1) { reader.fail('ambiguous_bonus_r_header', sHeader); return null }
    const classifiers = reader.points.filter(p => p.r < sHeader.r && /bediende|employee|employe|arbeider|ouvrier/.test(token(reader.str(p))))
      .sort((a, b) => b.r - a.r)
    const classification = classifiers[0] ? token(reader.str(classifiers[0])) : ''
    const worker = /ouvrier|arbeider/.test(classification) ? 'worker' : /bediende|employee|employe/.test(classification) ? 'employee' : null
    if (!worker) { reader.fail('unknown_bonus_population', sHeader); return null }
    return { sHeader, rHeader: rHeaders[0], worker }
  }).filter((group): group is NonNullable<typeof group> => group !== null)
  const sorted = groups.slice().sort((a, b) => a.sHeader.r - b.sHeader.r)
  for (const [groupIndex, group] of sorted.entries()) {
    const next = sorted[groupIndex + 1]
    const endRow = next ? next.sHeader.r - 1 : XLSX.utils.decode_range(reader.sheet['!ref'] ?? 'A1:A1').e.r
    const headerContext = reader.points.filter(p => p.r === group.sHeader.r).map(p => reader.str(p)).filter(Boolean)
    const dataRows = reader.points.filter(p => p.c === group.sHeader.c && p.r > group.sHeader.r && p.r <= endRow
      && ['<', '>'].includes(semantic(reader.str(p))))
    if (dataRows.length !== 4) reader.fail('incomplete_bonus_bands', group.sHeader)
    for (const [index, marker] of dataRows.entries()) {
      const band = `band_${index + 1}`
      const markerText = semantic(reader.str(marker))
      const hasUpper = reader.points.some(p => p.r === marker.r && p.c > marker.c && p.c < group.rHeader.c && semantic(reader.str(p)).includes('en <'))
      const rowContext = reader.points.filter(p => p.r === marker.r).map(p => reader.str(p)).filter(Boolean)
      const thresholdPoints = reader.points.filter(p => p.r === marker.r && p.c > marker.c && p.c < group.rHeader.c && isAmount(reader.cell(p)))
        .sort((a, b) => a.c - b.c)
      const expectedThresholds = hasUpper ? 2 : 1
      if (thresholdPoints.length !== expectedThresholds) reader.fail('incomplete_bonus_thresholds', marker)
      for (const [boundIndex, p] of thresholdPoints.entries()) {
        const operator = markerText === '<' ? '<' : boundIndex === 0 ? '>' : '<'
        const role = operator === '>' ? 'salary_lower_gt' : 'salary_upper_lt'
        addUnique(reader, keys, p, {
          key: `employment_bonus/${group.worker}/${band}/${role}`, table: `employment_bonus_${group.worker}`, code: role,
          label: operator === '>' ? 'Seuil inférieur strict du salaire S' : 'Seuil supérieur strict du salaire S',
          context: [...headerContext, ...rowContext, `Population: ${group.worker}`, `Bande ${index + 1}`, `Condition source: S ${operator} seuil`, 'Formule de la feuille: R − coefficient × (S − offset)'],
          unit: 'EUR/month', ...(indexation && dependsOnSource(reader, p, indexation.source) ? { indexation } : {}),
        })
      }

      const rowAmounts = reader.points.filter(p => p.r === marker.r && p.c > group.rHeader.c && isAmount(reader.cell(p))).sort((a, b) => a.c - b.c)
      const base = rowAmounts[0]
      if (!base) reader.fail('missing_bonus_base', marker)
      else addUnique(reader, keys, base, {
        key: `employment_bonus/${group.worker}/${band}/base_R`, table: `employment_bonus_${group.worker}`, code: 'base_R',
        label: 'Montant de base R du bonus', context: [...headerContext, ...rowContext, `Population: ${group.worker}`, `Bande ${index + 1}`, 'Paramètre R de la formule source'],
        unit: 'EUR/month', ...(indexation && dependsOnSource(reader, base, indexation.source) ? { indexation } : {}),
      })

      const extras = rowAmounts.slice(1)
      const coefficient = extras.filter(p => {
        const formula = reader.cell(p)?.f ?? ''
        return formula.includes('/') && formula.includes('-') && /\bbonus\b/i.test(formula)
      })
      const offset = extras.filter(p => /^\$?[A-Z]{1,3}\$?\d+$/i.test(reader.cell(p)?.f ?? ''))
      if (hasUpper) {
        if (coefficient.length !== 1) reader.fail('missing_bonus_coefficient', marker)
        else addUnique(reader, keys, coefficient[0], {
          key: `employment_bonus/${group.worker}/${band}/coefficient`, table: `employment_bonus_${group.worker}`, code: 'coefficient',
          label: 'Coefficient de la formule du bonus', context: [...headerContext, ...rowContext, `Population: ${group.worker}`, `Bande ${index + 1}`, 'Formule source: R − coefficient × (S − offset)'],
          unit: 'ratio', ...(indexation && dependsOnSource(reader, coefficient[0], indexation.source) ? { indexation } : {}),
        })
        if (offset.length !== 1) reader.fail('missing_bonus_offset', marker)
        else addUnique(reader, keys, offset[0], {
          key: `employment_bonus/${group.worker}/${band}/offset`, table: `employment_bonus_${group.worker}`, code: 'offset',
          label: 'Décalage du salaire S dans la formule du bonus', context: [...headerContext, ...rowContext, `Population: ${group.worker}`, `Bande ${index + 1}`, 'Formule source: R − coefficient × (S − offset)'],
          unit: 'EUR/month', ...(indexation && dependsOnSource(reader, offset[0], indexation.source) ? { indexation } : {}),
        })
      } else if (extras.length) reader.fail('unknown_bonus_parameter', extras[0])
    }
  }
  claimText(reader)
}

export function readOtherSheet(workbook: XLSX.WorkBook, name: string) {
  const parser: Record<string, (reader: SheetReader) => void> = {
    'W ': wSheet,
    AndereBedrWLH_AutresMontCHOM: otherUnemployment,
    Activering_Activation: activation,
    Bonus: bonus,
  }
  if (name === 'AndereUitk_AutresAlloc' && workbook.Sheets[name]) {
    const reader = new SheetReader(workbook, name)
    readOtherAllowances(reader)
    const coverage = reader.finish()
    return { values: reader.values, issues: reader.issues, coverage }
  }
  const parse = parser[name]
  if (!parse || !workbook.Sheets[name]) return null
  const reader = new SheetReader(workbook, name)
  parse(reader)
  const coverage = reader.finish()
  return { values: reader.values, issues: reader.issues, coverage }
}
