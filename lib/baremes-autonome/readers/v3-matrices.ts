import * as XLSX from 'xlsx'
import { SheetReader, address, dateValue, decimal, populated, semantic, type Point, type ValueSpec } from './v3-common'
import type { Coverage, ReadingIssue, RateValue } from '../types'

type Parsed = { values: RateValue[]; issues: ReadingIssue[]; coverage: Coverage['tables'] }
const p = (r: number, c: number): Point => ({ r, c })
const codeToken = (s: string) => semantic(s).replace(/\s+/g, '').toUpperCase()
const isNum = (s: string) => /^\d+$/.test(s)
const tableKey = (sheet: string, ...parts: string[]) => [sheet, ...parts].join(':')

function markText(reader: SheetReader) {
  for (const point of reader.points) {
    const cell = reader.cell(point)
    if (cell?.t === 's' && !reader.claimed.has(address(point))) reader.claim(point, 'metadata')
  }
}
function add(reader: SheetReader, point: Point, spec: Omit<ValueSpec, 'valueKind'>, keys: Set<string>) {
  if (keys.has(spec.key)) { reader.fail('duplicate_semantic_identity', point); return }
  const before = reader.values.length
  reader.add(point, spec)
  if (reader.values.length > before) keys.add(spec.key)
}
function claimDate(reader: SheetReader) {
  const anchors=reader.find(v=>semantic(v).includes('geldig/valable'))
  const primary=anchors.length===1?reader.points.find(q=>q.c===anchors[0].c&&q.r>anchors[0].r&&reader.claimed.get(address(q))==='metadata'):undefined
  const copies=primary ? reader.points.filter(point=>reader.cell(point)?.f?.replace(/^=/,'').replace(/\$/g,'')===address(primary)) : []
  if(copies.length!==1 || dateValue(reader.cell(copies[0]))!==reader.effectiveFrom) reader.fail('repeated_effective_date_mismatch')
  else reader.claim(copies[0], 'metadata')
}
function percentLabel(value: string | null) {
  if (!value) return null
  const match = value.match(/^(-?)(\d+)(?:\.(\d+))?$/)
  if (!match) return null
  const digits = `${match[2]}${match[3] ?? ''}`, decimalPlaces = (match[3]?.length ?? 0) - 2
  const shifted = decimalPlaces <= 0 ? digits + '0'.repeat(-decimalPlaces) : `${digits.slice(0, -decimalPlaces) || '0'}.${digits.slice(-decimalPlaces)}`
  const normalized = shifted.includes('.') ? shifted.replace(/0+$/, '').replace(/\.$/, '') : shifted.replace(/^0+(?=\d)/, '')
  return `${match[1]}${normalized}%`
}
function dateAndMultiplier(reader: SheetReader) {
  const multiplier = reader.multiplier()
  return multiplier ? { value: multiplier.value, source: multiplier.source } : undefined
}
function rowIds(reader: SheetReader, col: number, start: number, end: number) {
  const ids = new Map<number, string>()
  for (let r = start; r <= end; r++) {
    const value = reader.str(p(r, col))
    if (value === 'MIN' || isNum(value)) ids.set(r, value)
    else if (reader.points.some(q => q.r === r && q.c > col && (reader.cell(q)?.t === 'n' || reader.cell(q)?.f))) reader.fail('unknown_rate_row_identity', p(r, col))
  }
  return ids
}
function allocationHeaders(reader: SheetReader, codeRow: number) {
  const headings=reader.points.filter(q=>q.r<codeRow && /entière|volle uitkering|demi allocation|halve uitkering/i.test(reader.str(q)))
    .map(point=>({point,half:/demi|halve/i.test(reader.str(point)),full:/entière|volle/i.test(reader.str(point))}))
  if(headings.length!==2 || headings.some(heading=>heading.half===heading.full) || headings.filter(heading=>heading.half).length!==1) reader.fail('missing_allocation_heading')
  return headings
}
function allocationFor(headings: ReturnType<typeof allocationHeaders>, col: number) {
  return headings.filter(heading=>heading.point.c<=col).sort((a,b)=>b.point.c-a.point.c)[0]
}
function percentagePoint(reader: SheetReader, col: number, codeRow: number, minRow: number) {
  const points=reader.points.filter(q=>q.c===col && q.r>codeRow && q.r<minRow && populated(reader.cell(q)))
  if(points.length!==1) {reader.fail('missing_rate_percentage',p(codeRow,col));return null}
  return points[0]
}
function dailyMatrix(reader: SheetReader) {
  const keys = new Set<string>(), codeHeader = reader.one(v => semantic(v) === 'code')
  if (!codeHeader) return
  const cols = reader.points.filter(q => q.r === codeHeader.r && q.c > codeHeader.c && reader.str(q))
  const min = reader.points.filter(q => q.c === codeHeader.c && q.r > codeHeader.r && reader.str(q) === 'MIN')
  if (min.length !== 1) { reader.fail('missing_minimum_row', codeHeader); return }
  const ids = rowIds(reader, codeHeader.c, min[0].r, Math.max(...reader.points.map(q => q.r)))
  for (const r of ids.keys()) reader.claim(p(r, codeHeader.c), 'metadata')
  const expected = ['MIN', ...Array.from({ length: 99 }, (_, i) => String(i + 1))]
  if (ids.size !== expected.length || expected.some(id => ![...ids.values()].includes(id)) || [...ids.values()].some(id => !expected.includes(id))) reader.fail('incomplete_rate_identities', codeHeader)
  const indexation = dateAndMultiplier(reader)
  const headings=allocationHeaders(reader,codeHeader.r)
  const expectedColumns = ['entière:A0N0B0:0.65','entière:A0N0B0:0.6','entière:A0H:0.65','entière:A0H:0.6','entière:J/S:0.65',
    'demi:A0N0B0:0.65','demi:A0N0B0:0.6','demi:A0H:0.65','demi:A0H:0.6','demi:J/S:0.65']
  const observedColumns: string[] = []
  const series: Array<{header:Point;half:boolean;raw:string;pct:string|null}> = []
  for (const header of cols) {
    const raw = codeToken(reader.str(header))
    const groups = raw.match(/A0H|A0|N0|B0|J\/S/g) ?? []
    if (!groups.length || groups.join('') !== raw) { reader.fail('unknown_daily_code', header); continue }
    const allocationHeader = allocationFor(headings,header.c)
    if (!allocationHeader) { reader.fail('missing_allocation_heading', header); continue }
    const half = allocationHeader.half
    const pctPoint = percentagePoint(reader,header.c,codeHeader.r,min[0].r)
    if(!pctPoint)continue
    const pctCell = reader.cell(pctPoint)
    let rateContext: string[] = []
    const pct = decimal(pctCell)
    if (pctCell?.t === 'n' && typeof pctCell.v === 'number' && pctCell.v > 0 && pctCell.v <= 1 && pct) {
      reader.claim(pctPoint, 'metadata')
      rateContext = [`Taux source : ${percentLabel(pct)}`]
      observedColumns.push(`${half?'demi':'entière'}:${groups.join('')}:${pct}`)
    } else reader.fail('missing_rate_percentage', pctPoint)
    series.push({header,half,raw,pct})
    for (const [r, id] of ids) {
      const point = p(r, header.c), cell = reader.cell(point)
      if (!cell || cell.v == null && !cell.f) { reader.fail('missing_daily_rate', point); continue }
      const group = groups.join('/')
      const period = groups[0] === 'J/S' ? 'J/S' : groups[0]
      const pctIdentity = pct ?? 'sans-taux'
      add(reader, point, { key: tableKey(reader.name, half ? 'demi' : 'entière', group, pctIdentity, id), table: `${reader.name}:${half ? 'Demi-allocation' : 'Allocation entière'}`, code: id, label: `${group} — ${period}`, context: [...(half ? ['Demi-allocation'] : ['Allocation entière']), ...rateContext, ...(indexation ? [`Multiplicateur indiqué dans la feuille : ${indexation.value}`] : [])], unit: 'EUR/day', ...(indexation ? { indexation } : {}) }, keys)
    }
  }
  for(const expectedColumn of expectedColumns) if(observedColumns.filter(v=>v===expectedColumn).length!==1) reader.fail('missing_or_duplicate_daily_series',codeHeader)
  if(cols.length!==expectedColumns.length) reader.fail('unknown_or_missing_daily_column',codeHeader)
  const fullMain=series.find(s=>s.raw==='A0N0B0' && s.pct==='0.65' && !s.half)?.header
  const halfMain=series.find(s=>s.raw==='A0N0B0' && s.pct==='0.65' && s.half)?.header
  if(fullMain && halfMain) {
    const firstRateRow=min[0].r, firstRankRow=[...ids].find(([, id])=>id==='1')?.[0]
    const first=reader.cell(p(firstRateRow,fullMain.c))
    const fullCopies=reader.points.filter(q=>q.r===firstRateRow && !reader.claimed.has(address(q)) && !reader.str(p(codeHeader.r,q.c)) && first?.f && reader.cell(q)?.f===first.f && decimal(reader.cell(q))===decimal(first))
    if(fullCopies.length!==1 || firstRankRow===undefined) reader.fail('unknown_daily_auxiliary',p(firstRateRow,fullMain.c))
    else {
      const fullAux=fullCopies[0]
      reader.claim(fullAux,'auxiliary')
      const halfCopies=reader.points.filter(q=>q.r===firstRateRow && !reader.claimed.has(address(q)) && reader.cell(q)?.f?.replace(/\$/g,'')===`ROUND(${address(fullAux)}/2,2)` && decimal(reader.cell(q))===decimal(reader.cell(p(firstRateRow,halfMain.c))))
      if(halfCopies.length!==1) reader.fail('unknown_daily_auxiliary',fullAux)
      else {
        const halfAux=halfCopies[0],zeroAux=p(firstRankRow,halfAux.c),zeroTarget=p(firstRankRow,fullAux.c),zero=reader.cell(zeroAux)
        reader.claim(halfAux,'auxiliary')
        const zeroFormula=zero?.f?.replace(/^=/,'').replace(/\$/g,'')
        if(zero?.t==='n' && zero.v===0 && zeroFormula===`ROUND(${address(zeroTarget)}/2,2)` && !populated(reader.cell(zeroTarget)) && !reader.str(p(codeHeader.r,zeroTarget.c))) reader.claim(zeroAux,'auxiliary')
        else reader.fail('unknown_daily_auxiliary',zeroAux)
      }
    }
  } else reader.fail('missing_daily_auxiliary_anchors',codeHeader)
  markText(reader)
}

function specialMatrix(reader: SheetReader) {
  const keys = new Set<string>(), header = reader.one(v => semantic(v) === 'code')
  if (!header) return
  const min = reader.points.find(q => q.c === header.c && q.r > header.r && reader.str(q) === 'MIN')
  if (!min) { reader.fail('missing_minimum_row', header); return }
  const ids = rowIds(reader, header.c, min.r, Math.max(...reader.points.map(q => q.r)))
  for (const r of ids.keys()) reader.claim(p(r, header.c), 'metadata')
  const expectedIds=['MIN',...Array.from({length:99},(_,i)=>String(i+1))]
  if(ids.size!==expectedIds.length || expectedIds.some(id=>![...ids.values()].includes(id)) || [...ids.values()].some(id=>!expectedIds.includes(id))) reader.fail('incomplete_special_identities',header)
  const indexation = dateAndMultiplier(reader)
  const headings=allocationHeaders(reader,header.r)
  const cols = reader.points.filter(q => q.r === header.r && q.c > header.c && reader.str(q))
  const observedGroups:string[]=[]
  for (const h of cols) {
    const rawCode = reader.str(h).replace(/\s+/g, '')
    const allowed = new Set(['A6','A7','EFA','GNFN','GBFB','AA','ANAB'])
    if (!allowed.has(rawCode)) { reader.fail('unknown_special_code', h); continue }
    const allocation=allocationFor(headings,h.c)
    if(!allocation) {reader.fail('missing_special_allocation_heading',h);continue}
    const labelPoint = reader.points.filter(q => q.r>allocation.point.r && q.r<header.r && q.c>=allocation.point.c && q.c<=h.c && reader.str(q)).sort((a,b)=>b.c-a.c||b.r-a.r)[0]
    const labelRaw = labelPoint ? reader.str(labelPoint) : ''
    const labelContracts:Record<string,RegExp>={A6:/havenarbeiders|travailleurs de port/i,A7:/zeevissers|p.cheurs de mer/i,EFA:/bedrijfstoeslag|compl.ment d.entreprise/i,GNFN:/bedrijfstoeslag|compl.ment d.entreprise/i,GBFB:/bedrijfstoeslag|compl.ment d.entreprise/i,AA:/kunstwerkers|travailleurs des arts/i,ANAB:/kunstwerkers|travailleurs des arts/i}
    if(!labelContracts[rawCode].test(labelRaw)) reader.fail('unknown_special_category_context',h)
    const half = allocation.half
    observedGroups.push(`${half?'demi':'entière'}:${rawCode}`)
    const identity = {code:rawCode,label:labelRaw}
    const pctPoint = percentagePoint(reader,h.c,header.r,min.r)
    if(!pctPoint)continue
    const pctCell = reader.cell(pctPoint)
    const pct=decimal(pctCell)
    if(pctCell?.t!=='n'||pct!=='0.6') reader.fail('unknown_special_rate_percentage',pctPoint)
    const context = [half ? 'Demi-allocation' : 'Allocation entière', identity.label, ...(pctCell?.t === 'n' && pct ? [`Taux source : ${percentLabel(pct)}`] : [])]
    if (pctCell?.t === 'n') reader.claim(pctPoint, 'metadata')
    const expectedCount = ['EFA','GNFN','GBFB'].includes(rawCode) ? 64 : 100
    let populatedCount=0
    for (const [r, id] of ids) {
      const point = p(r, h.c), cell = reader.cell(point)
      const expected = expectedCount===100 || id==='MIN' || Number(id)<=63
      if (!cell || cell.v == null && !cell.f) { if (expected) reader.fail('missing_special_rate', point); continue }
      if(!expected) { reader.fail('unexpected_special_rate',point); continue }
      populatedCount++
      add(reader, point, { key: tableKey(reader.name, identity.code, id, half ? 'demi' : 'entière'), table: `${reader.name}:${identity.label}`, code: id, label: identity.label, context, unit: 'EUR/day', ...(indexation ? { indexation } : {}) }, keys)
    }
    if(populatedCount!==expectedCount) reader.fail('incomplete_special_series',h)
  }
  const expectedGroups=['entière:A6','entière:A7','entière:EFA','entière:GNFN','entière:GBFB','entière:AA','entière:ANAB','demi:A6','demi:A7','demi:EFA','demi:GNFN','demi:GBFB']
  for(const group of expectedGroups) if(observedGroups.filter(value=>value===group).length!==1) reader.fail('missing_or_duplicate_special_series',header)
  if(cols.length!==expectedGroups.length) reader.fail('unknown_or_missing_special_column',header)
  markText(reader)
}

function numericColsFromRows(reader:SheetReader,rows:Point[]) {
  return [...new Set(reader.points.filter(q=>rows.some(row=>row.r===q.r)&&(reader.cell(q)?.t==='n'||reader.cell(q)?.f)).map(q=>q.c))]
}

function salaryBands(reader: SheetReader) {
  const keys = new Set<string>(), header = reader.one(v => semantic(v) === 'code')
  if (!header) return
  const dayHeader = reader.points.filter(q => q.r < header.r && /dagloon|salaire journalier/i.test(reader.str(q))).sort((a,b)=>b.r-a.r)[0]
  if (!dayHeader) { reader.fail('missing_salary_band_header'); return }
  claimDate(reader)
  const codeRows = reader.points.filter(q => q.c === header.c && q.r > header.r && isNum(reader.str(q)))
  for (const row of codeRows) reader.claim(row, 'metadata')
  const bandCodes=new Set(codeRows.map(row=>Number(reader.str(row))))
  for(let code=29;code<=99;code++) if(!bandCodes.has(code)) reader.fail('missing_salary_code',header)
  if(codeRows.some(row=>Number(reader.str(row))<29||Number(reader.str(row))>99)||bandCodes.size!==codeRows.length) reader.fail('unknown_salary_code',header)
  if (!codeRows.length) { reader.fail('missing_salary_codes', header); return }
  const indexation = dateAndMultiplier(reader)
  const rankCandidates = [...new Set(reader.points.filter(q=>isNum(reader.str(q)) && Number(reader.str(q))>=1 && Number(reader.str(q))<=99).map(q=>q.c))]
    .map(c=>({c,rows:reader.points.filter(q=>q.c===c && isNum(reader.str(q)) && Number(reader.str(q))>=1 && Number(reader.str(q))<=99)}))
    .filter(x=>x.rows.length===99 && x.rows.every((q,i)=>Number(reader.str(q))===i+1))
    .filter(x=>numericColsFromRows(reader,x.rows).filter(c=>c>x.c).length>=3)
  const rankSeries = rankCandidates.length===1 ? rankCandidates[0] : null
  if (!rankSeries) { reader.fail('missing_or_ambiguous_rank_series'); return }
  const rankRows = rankSeries.rows
  for (const row of rankRows) reader.claim(row, 'metadata')
  const numericCols=numericColsFromRows(reader,rankRows.slice(0,2))
  const formulaAt=(r:number,c:number)=>{
    const f=reader.cell(p(r,c))?.f?.replace(/^=/,'').replace(/\$/g,'')
    const match=f?.match(/^([A-Z]+)(\d+)([-+])(\d+(?:\.\d+)?)$/i)
    return match?{point:XLSX.utils.decode_cell(`${match[1]}${match[2]}`),operator:match[3],constant:Number(match[4])}:null
  }
  const roleCols = new Map<number,string>()
  const lowerCols=numericCols.filter(c=>rankRows.slice(0,2).every((row,i)=>{const f=formulaAt(row.r,c);return !!f&&f.point.c===c&&f.point.r===rankRows[i+1].r&&f.operator==='-'&&f.constant===0.8631}))
  if(lowerCols.length===1){
    const lower=lowerCols[0]
    for(const c of numericCols){
      if(c===lower){roleCols.set(c,'base_borne_inferieure');continue}
      const role=rankRows.slice(0,2).map((row,i)=>{const f=formulaAt(row.r,c);if(!f)return null
        if(f.point.c===lower&&f.point.r===rankRows[i+1].r&&f.operator==='-'&&f.constant===0.0001)return 'base_borne_superieure'
        if(f.point.c===lower&&f.point.r===row.r&&f.operator==='+'&&f.constant===0.4316)return 'base_reference_calcul'
        return null
      })
      if(role[0]&&role[0]===role[1])roleCols.set(c,role[0])
    }
  }
  if(roleCols.size!==3 || new Set(roleCols.values()).size!==3) { reader.fail('ambiguous_salary_parameter_roles'); return }
  for (const row of codeRows) {
    const id = reader.str(row)
    const amountCols = reader.points.filter(q => q.r === row.r && q.c < header.c && reader.cell(q)?.t === 'n')
    const expectedBounds=Number(id)===99?1:2
    if (amountCols.length!==expectedBounds) reader.fail('missing_salary_band_amount', row)
    for (let i=0;i<amountCols.length;i++) {
      const point=amountCols[i], role=i===0?'borne_inferieure':'borne_superieure'
      add(reader,point,{key:tableKey(reader.name,'code',id,role),table:`${reader.name}:Tranches salariale`,code:id,label:'Tranche salariale',context:[i===0?'Borne inférieure':'Borne supérieure'],unit:'EUR/day',...(indexation?{indexation}:{})},keys)
    }
  }
  for (const row of rankRows) {
    const rank = reader.str(row)
    for (const [c,role] of roleCols) {
      const point=p(row.r,c), cell=reader.cell(point)
      if (!cell || cell.v==null && !cell.f) { if(role!=='base_borne_superieure' || Number(rank)<99) reader.fail('missing_salary_parameter',point); continue }
      add(reader,point,{key:tableKey(reader.name,'rang',rank,role),table:`${reader.name}:Paramètres de calcul`,code:rank,label:'Paramètre de calcul sans libellé source',context:[role.replaceAll('_',' ')+' (rôle déduit des formules source; unité non documentée)', 'Série source avant indexation'],unit:'number'},keys)
    }
  }
  markText(reader)
}

function hourly(reader: SheetReader) {
  const keys=new Set<string>(), header=reader.one(v=>semantic(v)==='code')
  if(!header)return
  const codes=reader.points.filter(q=>q.c===header.c && q.r>header.r && isNum(reader.str(q)))
  const hours=reader.points.filter(q=>q.r===header.r && q.c>header.c && /^\d+(?:\.\d+)?$/.test(reader.str(q)))
  for(const row of codes) reader.claim(row,'metadata')
  for(const point of hours) reader.claim(point,'metadata')
  const codeSet=new Set(codes.map(row=>Number(reader.str(row))))
  for(let code=29;code<=99;code++) if(!codeSet.has(code)) reader.fail('missing_hourly_code',header)
  if(codes.some(row=>Number(reader.str(row))<29||Number(reader.str(row))>99)||codeSet.size!==codes.length) reader.fail('unknown_hourly_code',header)
  const expectedHours=Array.from({length:11},(_,i)=>String(40-i*0.5))
  if(hours.length!==11 || expectedHours.some(value=>hours.filter(point=>reader.str(point)===value).length!==1)) reader.fail('unknown_or_missing_hourly_hours',header)
  if(hours.length) claimDate(reader)
  if(!codes.length||!hours.length){reader.fail('missing_hourly_axes',header);return}
  const indexation=dateAndMultiplier(reader)
  for(const row of codes) for(const h of hours){
    const point=p(row.r,h.c),cell=reader.cell(point)
    if(!cell||cell.v==null&&!cell.f){reader.fail('missing_hourly_rate',point);continue}
    const week=reader.str(h)
    add(reader,point,{key:tableKey(reader.name,'code',reader.str(row),'heures-semaine',week),table:`${reader.name}:Salaires horaires`,code:reader.str(row),label:'Salaire horaire',context:[`${week} heures par semaine`,...(indexation?[`Multiplicateur indiqué dans la feuille : ${indexation.value}`]:[])],unit:'EUR/hour',...(indexation?{indexation}:{})},keys)
  }
  markText(reader)
}

export function parseMatrices(workbook: XLSX.WorkBook): Parsed {
  const readers=[new SheetReader(workbook,'TW-CT_JS'),new SheetReader(workbook,'SpecCat'),new SheetReader(workbook,'Loonschijven_Tranches salariale'),new SheetReader(workbook,'Uurlonen_Salaires horaires')]
  dailyMatrix(readers[0]);specialMatrix(readers[1]);salaryBands(readers[2]);hourly(readers[3])
  const coverage=readers.map(reader=>reader.finish())
  return {values:readers.flatMap(reader=>reader.values),issues:readers.flatMap(reader=>reader.issues),coverage}
}
