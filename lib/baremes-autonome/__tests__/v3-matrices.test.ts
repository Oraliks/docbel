import * as fs from 'node:fs'
import * as path from 'node:path'
import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'
import { parseMatrices } from '../readers/v3-matrices'

const fixture = path.join(__dirname, 'fixtures', 'barema20260901-new.xlsx')
const load = () => XLSX.read(fs.readFileSync(process.env.DOCBEL_REFERENCE_XLSX || fixture), { type: 'buffer', cellFormula: true, cellDates: false })

describe('lecteur des quatre matrices v3', () => {
  it('lit les montants avec identités sémantiques, unités, taux et formules de la référence', () => {
    const result = parseMatrices(load())
    const blockers = result.issues.filter(i => i.blocking)
    expect(blockers.map(({ sheet, cell, code }) => [sheet, cell, code])).toEqual([])
    expect(result.values).toHaveLength(3202)
    expect(result.coverage.map(s => [s.sheet, s.mappedCells])).toEqual([
      ['TW-CT_JS', 1000], ['SpecCat', 984], ['Loonschijven_Tranches salariale', 437], ['Uurlonen_Salaires horaires', 781],
    ])
    expect(new Set(result.values.map(v => v.key)).size).toBe(result.values.length)
    expect(result.values.find(v => v.source.sheet === 'TW-CT_JS' && v.source.cell === 'B8')).toMatchObject({ unit: 'EUR/day', context: expect.arrayContaining(['Allocation entière', 'Taux source : 65%']) })
    expect(result.values.find(v => v.source.sheet === 'TW-CT_JS' && v.source.cell === 'L8')?.unit).toBe('EUR/day')
    expect(result.values.find(v => v.source.sheet === 'Loonschijven_Tranches salariale' && v.source.cell === 'B9')?.value).toBe('63.3233')
    expect(result.values.find(v => v.source.sheet === 'Loonschijven_Tranches salariale' && v.source.cell === 'O36')?.value).toBe('34.9581999999999')
    expect(result.values.find(v => v.source.sheet === 'Loonschijven_Tranches salariale' && v.source.cell === 'Q8')?.context[0]).toContain('base reference calcul')
    expect(result.values.find(v => v.source.sheet === 'Uurlonen_Salaires horaires' && v.source.cell === 'D8')?.key).toContain('heures-semaine:40')
    expect(result.values.find(v => v.source.sheet === 'Uurlonen_Salaires horaires' && v.source.cell === 'D8')?.source.formula).toContain('Loonschijven_Tranches salariale')
  })

  it('conserve les identités lors du déplacement simultané de la grille horaire', () => {
    const workbook = load(), sheet = workbook.Sheets['Uurlonen_Salaires horaires']
    const ref = XLSX.utils.decode_range(sheet['!ref']!)
    const moved: XLSX.WorkSheet = { '!ref': 'C3:Q80' }
    for (const key of Object.keys(sheet).filter(k => !k.startsWith('!'))) {
      const old = XLSX.utils.decode_cell(key)
      if (old.r < 0 || old.c < 0) continue
      const copy = { ...sheet[key] }
      if (copy.f === 'A2') copy.f = 'C4'
      moved[XLSX.utils.encode_cell({ r: old.r + 2, c: old.c + 2 })] = copy
    }
    moved['!ref'] = XLSX.utils.encode_range({ s: { r: 2, c: 2 }, e: { r: ref.e.r + 2, c: ref.e.c + 2 } })
    workbook.Sheets['Uurlonen_Salaires horaires'] = moved
    const parsed = parseMatrices(workbook)
    expect(parsed.issues.filter(i => i.blocking)).toEqual([])
    const values = parsed.values.filter(v => v.source.sheet === 'Uurlonen_Salaires horaires')
    expect(values).toHaveLength(781)
    expect(new Set(values.map(v => v.key)).size).toBe(781)
  })

  it('bloque un code hors contrat, une cellule de taux manquante et une collision d’axe', () => {
    const badCode = load()
    badCode.Sheets['Uurlonen_Salaires horaires'].C8 = { t: 'n', v: 128 }
    expect(parseMatrices(badCode).issues.some(i => i.code === 'unknown_hourly_code')).toBe(true)

    const missing = load()
    delete missing.Sheets['Uurlonen_Salaires horaires'].D8
    expect(parseMatrices(missing).issues.some(i => i.code === 'missing_hourly_rate' && i.cell === 'D8')).toBe(true)

    const collision = load()
    collision.Sheets['Uurlonen_Salaires horaires'].N7 = { t: 'n', v: 35.5 }
    expect(parseMatrices(collision).issues.some(i => i.code === 'duplicate_semantic_identity')).toBe(true)
  })

  it('ne confond pas montants et dates et préserve toute la précision cache', () => {
    const workbook=load(), sheet=workbook.Sheets['Loonschijven_Tranches salariale']
    sheet.B9={...sheet.B9,v:123.456789,w:'123.46'}
    const parsed=parseMatrices(workbook)
    expect(parsed.values.find(v=>v.source.sheet==='Loonschijven_Tranches salariale'&&v.source.cell==='B9')?.value).toBe('123.456789')
    expect(parsed.issues.filter(i=>i.blocking)).toEqual([])

    const unknown=load()
    unknown.Sheets['TW-CT_JS'].Z50={t:'n',v:45292,w:'45292'}
    expect(parseMatrices(unknown).issues.some(i=>i.code==='unmapped_sheet_value'&&i.cell==='Z50')).toBe(true)

    const noCache=load()
    noCache.Sheets['TW-CT_JS'].B8={...noCache.Sheets['TW-CT_JS'].B8,v:undefined}
    expect(parseMatrices(noCache).issues.some(i=>i.code==='formula_without_cached_result'&&i.cell==='B8')).toBe(true)
  })

  it('reconnaît les rôles salariaux par formule après insertion d’une colonne vide', () => {
    const workbook=load(), sheet=workbook.Sheets['Loonschijven_Tranches salariale']
    const shifted:XLSX.WorkSheet={'!ref':'A1:S106'}
    const shiftFormula=(formula:string)=>formula.replace(/\$?([A-Z]{1,3})\$?(\d+)/g,(_all,col,row)=>{
      const index=XLSX.utils.decode_col(col)
      return `${index>=14?XLSX.utils.encode_col(index+1):col}${row}`
    })
    for(const key of Object.keys(sheet).filter(k=>!k.startsWith('!'))){
      const point=XLSX.utils.decode_cell(key),next={...sheet[key]}
      if(next.f)next.f=shiftFormula(next.f)
      shifted[XLSX.utils.encode_cell({r:point.r,c:point.c>=14?point.c+1:point.c})]=next
    }
    workbook.Sheets['Loonschijven_Tranches salariale']=shifted
    const baseline=parseMatrices(load()).values.filter(v=>v.source.sheet==='Loonschijven_Tranches salariale'&&v.table.includes('Paramètres'))
    const after=parseMatrices(workbook).values.filter(v=>v.source.sheet==='Loonschijven_Tranches salariale'&&v.table.includes('Paramètres'))
    expect(new Set(after.map(v=>v.key))).toEqual(new Set(baseline.map(v=>v.key)))
    expect(after).toHaveLength(296)
  })

  it('bloque les axes horaires incomplets et une formule auxiliaire TW altérée',()=>{
    const noHours=load(),hourly=noHours.Sheets['Uurlonen_Salaires horaires']
    for(const key of Object.keys(hourly)) if(/^(N)(\d+)$/.test(key)) delete hourly[key]
    expect(parseMatrices(noHours).issues.some(i=>i.code==='unknown_or_missing_hourly_hours')).toBe(true)

    const noFinalCode=load(),rates=noFinalCode.Sheets['Uurlonen_Salaires horaires']
    delete rates.C78
    for(let c=3;c<=13;c++) delete rates[XLSX.utils.encode_cell({r:77,c})]
    expect(parseMatrices(noFinalCode).issues.some(i=>i.code==='missing_hourly_code')).toBe(true)

    const badHelper=load(),tw=badHelper.Sheets['TW-CT_JS']
    tw.M8={...tw.M8,f:'ROUND(C8/3,2)'}
    expect(parseMatrices(badHelper).issues.some(i=>i.code==='unknown_daily_auxiliary'&&i.cell==='M8')).toBe(true)
    tw.M8={...tw.M8,f:'ROUND(C8/2,2)',v:1}
    expect(parseMatrices(badHelper).issues.some(i=>i.code==='unknown_daily_auxiliary'&&i.cell==='M8')).toBe(true)
    tw.M8={...tw.M8,f:'ROUND(C8/2,2)',v:0}
    tw.C8={t:'n',v:1}
    expect(parseMatrices(badHelper).issues.some(i=>i.code==='unknown_daily_auxiliary'&&i.cell==='M8')).toBe(true)
  })

  it('bloque une série quotidienne supprimée et les derniers rangs absents',()=>{
    const noColumn=load(),tw=noColumn.Sheets['TW-CT_JS']
    for(const key of Object.keys(tw)) if(/^D\d+$/.test(key)) delete tw[key]
    expect(parseMatrices(noColumn).issues.some(i=>i.code==='missing_or_duplicate_daily_series')).toBe(true)

    const noLastRow=load(),daily=noLastRow.Sheets['TW-CT_JS']
    for(let c=0;c<=19;c++) delete daily[XLSX.utils.encode_cell({r:105,c})]
    expect(parseMatrices(noLastRow).issues.some(i=>i.code==='incomplete_rate_identities')).toBe(true)

    const noSpecialColumn=load(),special=noSpecialColumn.Sheets.SpecCat
    for(const key of Object.keys(special)) if(/^G\d+$/.test(key)) delete special[key]
    expect(parseMatrices(noSpecialColumn).issues.some(i=>i.code==='missing_or_duplicate_special_series')).toBe(true)

    const noSpecialFinal=load(),specialFinal=noSpecialFinal.Sheets.SpecCat
    for(let c=0;c<=23;c++) delete specialFinal[XLSX.utils.encode_cell({r:106,c})]
    expect(parseMatrices(noSpecialFinal).issues.some(i=>i.code==='incomplete_special_identities')).toBe(true)
  })
})
