import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import {
  diffXlsxBuffers,
  extractLatestBaremeRefFromHtml,
  checkOnemForNewBareme,
  type XlsxDiff,
} from '../onemSync'

/**
 * Tests du CŒUR de onemSync : le diff cellule-par-cellule de deux workbooks
 * Excel construits EN MÉMOIRE (aucun réseau).
 *
 * On fabrique les xlsx avec la lib `xlsx` (déjà dépendance) :
 *   XLSX.utils.aoa_to_sheet(rows) → feuille depuis un array-of-arrays
 *   XLSX.write({type:'buffer'})   → Buffer Node lisible par parseBaremaFile
 *
 * NB : parseBaremaFile normalise les nombres via `.w` (chaîne formatée par
 * SheetJS). Pour des valeurs stables et comparables on utilise des CHAÎNES
 * dans les cellules de test (codes, libellés), ce qui suffit à exercer
 * cellule-modifiée / feuille-ajoutée / identité.
 */

type Rows = (string | number)[][]

/** Construit un Buffer xlsx depuis un dict { nomFeuille: rows }. */
function makeXlsx(sheets: Record<string, Rows>): Buffer {
  const wb = XLSX.utils.book_new()
  for (const [name, rows] of Object.entries(sheets)) {
    const ws = XLSX.utils.aoa_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, name)
  }
  const out = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return Buffer.isBuffer(out) ? out : Buffer.from(out)
}

const BASE_SHEETS: Record<string, Rows> = {
  A_N_B_vol_plein: [
    ['Code', 'Libellé', 'Montant'],
    ['AA1', 'Chef de ménage', '1500.00'],
    ['AA2', 'Isolé', '1200.00'],
  ],
  Basisbedragen: [
    ['Param', 'Valeur'],
    ['Multiplicateur', '1.9999'],
  ],
}

describe('diffXlsxBuffers', () => {
  it('identité : 0 diff quand les deux fichiers sont identiques', () => {
    const ours = makeXlsx(BASE_SHEETS)
    const theirs = makeXlsx(BASE_SHEETS)

    const diff: XlsxDiff = diffXlsxBuffers(ours, theirs)

    expect(diff.identical).toBe(true)
    expect(diff.onlyInOurs).toEqual([])
    expect(diff.onlyInTheirs).toEqual([])
    expect(diff.changedSheets).toEqual([])
    expect(diff.counts.changedCells).toBe(0)
    expect(diff.counts.commonSheets).toBe(2)
    expect(diff.unchangedSheets).toContain('A_N_B_vol_plein')
    expect(diff.unchangedSheets).toContain('Basisbedragen')
  })

  it('détecte une cellule modifiée (et la localise précisément)', () => {
    const ours = makeXlsx(BASE_SHEETS)
    // Même structure, un seul montant changé : 1500.00 → 1525.50 en C2.
    const modified: Record<string, Rows> = {
      ...BASE_SHEETS,
      A_N_B_vol_plein: [
        ['Code', 'Libellé', 'Montant'],
        ['AA1', 'Chef de ménage', '1525.50'],
        ['AA2', 'Isolé', '1200.00'],
      ],
    }
    const theirs = makeXlsx(modified)

    const diff = diffXlsxBuffers(ours, theirs)

    expect(diff.identical).toBe(false)
    expect(diff.onlyInOurs).toEqual([])
    expect(diff.onlyInTheirs).toEqual([])
    expect(diff.counts.changedCells).toBe(1)
    expect(diff.changedSheets).toHaveLength(1)

    const sheetDiff = diff.changedSheets[0]
    expect(sheetDiff.sheet).toBe('A_N_B_vol_plein')
    expect(sheetDiff.diffCount).toBe(1)
    expect(sheetDiff.sample).toHaveLength(1)

    const cell = sheetDiff.sample[0]
    // Ligne 2 (0-based r=1), colonne C (0-based c=2) → "C2".
    expect(cell.cell).toBe('C2')
    expect(cell.rowIndex).toBe(1)
    expect(cell.colIndex).toBe(2)
    expect(cell.ours).toBe('1500.00')
    expect(cell.theirs).toBe('1525.50')

    // L'autre feuille reste identique.
    expect(diff.unchangedSheets).toContain('Basisbedragen')
  })

  it('détecte une feuille ajoutée chez « theirs » (publiée par l’ONEM)', () => {
    const ours = makeXlsx(BASE_SHEETS)
    const withExtra: Record<string, Rows> = {
      ...BASE_SHEETS,
      TW_CT_JS: [
        ['Code', 'Montant'],
        ['CT1', '999.99'],
      ],
    }
    const theirs = makeXlsx(withExtra)

    const diff = diffXlsxBuffers(ours, theirs)

    expect(diff.identical).toBe(false)
    expect(diff.onlyInTheirs).toEqual(['TW_CT_JS'])
    expect(diff.onlyInOurs).toEqual([])
    expect(diff.counts.onlyInTheirs).toBe(1)
    // Les feuilles communes restent identiques → aucun changement cellulaire.
    expect(diff.counts.changedCells).toBe(0)
    expect(diff.counts.commonSheets).toBe(2)
  })

  it('détecte une feuille présente seulement chez nous (supprimée côté ONEM)', () => {
    const ours = makeXlsx(BASE_SHEETS)
    const onlyOne: Record<string, Rows> = {
      A_N_B_vol_plein: BASE_SHEETS.A_N_B_vol_plein,
    }
    const theirs = makeXlsx(onlyOne)

    const diff = diffXlsxBuffers(ours, theirs)

    expect(diff.identical).toBe(false)
    expect(diff.onlyInOurs).toEqual(['Basisbedragen'])
    expect(diff.onlyInTheirs).toEqual([])
    expect(diff.counts.commonSheets).toBe(1)
  })

  it('signale un changement de dimensions quand une ligne est ajoutée', () => {
    const ours = makeXlsx(BASE_SHEETS)
    const extraRow: Record<string, Rows> = {
      ...BASE_SHEETS,
      A_N_B_vol_plein: [
        ['Code', 'Libellé', 'Montant'],
        ['AA1', 'Chef de ménage', '1500.00'],
        ['AA2', 'Isolé', '1200.00'],
        ['AA3', 'Cohabitant', '1000.00'],
      ],
    }
    const theirs = makeXlsx(extraRow)

    const diff = diffXlsxBuffers(ours, theirs)

    expect(diff.identical).toBe(false)
    const sheetDiff = diff.changedSheets.find((s) => s.sheet === 'A_N_B_vol_plein')
    expect(sheetDiff).toBeDefined()
    expect(sheetDiff!.dimensionsDiffer).toBe(true)
    // 3 cellules de la nouvelle ligne diffèrent (vide → valeur).
    expect(sheetDiff!.diffCount).toBe(3)
  })
})

/**
 * Test PUR du sélecteur HTML du hub (aucun réseau : on lui passe un fragment
 * HTML en dur). Vérifie qu'on retient le .xlsx « barema » le plus récent.
 */
describe('extractLatestBaremeRefFromHtml (sélecteur, hors ligne)', () => {
  const HUB = 'https://www.onem.be/documentation/montants'

  it('repère le lien barema-new-*.xlsx et extrait la date du nom', () => {
    const html = `
      <html><body>
        <a href="/fr/documentation/feuille.pdf">Une circulaire</a>
        <a href="https://cdn.onem.be/abcd1234/barema-new-01042026.xlsx">Barème avril 2026</a>
        <a href="/static/style.css">style</a>
      </body></html>
    `
    const ref = extractLatestBaremeRefFromHtml(html, HUB)
    expect(ref).not.toBeNull()
    expect(ref!.fileName).toBe('barema-new-01042026.xlsx')
    expect(ref!.url).toBe('https://cdn.onem.be/abcd1234/barema-new-01042026.xlsx')
    // 01042026 = 1er avril 2026.
    expect(ref!.validFrom?.getFullYear()).toBe(2026)
    expect(ref!.validFrom?.getMonth()).toBe(3) // avril = 3 (0-based)
    expect(ref!.validFrom?.getDate()).toBe(1)
  })

  it('choisit le plus récent quand plusieurs barèmes sont listés', () => {
    const html = `
      <a href="/x/barema-new-01012025.xlsx">2025</a>
      <a href="/y/barema-new-01042026.xlsx">avril 2026</a>
      <a href="/z/barema-new-01012026.xlsx">janvier 2026</a>
    `
    const ref = extractLatestBaremeRefFromHtml(html, HUB)
    expect(ref!.fileName).toBe('barema-new-01042026.xlsx')
  })

  it('retourne null si aucun lien xlsx « barema »', () => {
    const html = `<a href="/foo.pdf">pdf</a><a href="/bar.xlsx">autre.xlsx</a>`
    expect(extractLatestBaremeRefFromHtml(html, HUB)).toBeNull()
  })
})

/**
 * Test de la logique de comparaison d'URL SANS réseau : on injecte un fetch
 * factice qui renvoie un HTML connu. (Ce n'est pas un appel réseau réel — on
 * stub `fetch` — donc conforme à « ne teste pas le réseau ».)
 */
describe('checkOnemForNewBareme (logique, fetch stubbé)', () => {
  function stubFetchReturning(html: string): typeof fetch {
    return (async () =>
      new Response(html, {
        status: 200,
        headers: { 'content-type': 'text/html' },
      })) as unknown as typeof fetch
  }

  const HTML_APRIL = '<a href="https://cdn.onem.be/h1/barema-new-01042026.xlsx">x</a>'
  const HTML_JULY = '<a href="https://cdn.onem.be/h2/barema-new-01072026.xlsx">x</a>'

  it('first_seen : aucune URL connue → hasNew=false mais latest renseigné', async () => {
    const r = await checkOnemForNewBareme(null, stubFetchReturning(HTML_APRIL))
    expect(r.reason).toBe('first_seen')
    expect(r.hasNew).toBe(false)
    expect(r.latest?.fileName).toBe('barema-new-01042026.xlsx')
  })

  it('unchanged : même URL → hasNew=false', async () => {
    const known = 'https://cdn.onem.be/h1/barema-new-01042026.xlsx'
    const r = await checkOnemForNewBareme(known, stubFetchReturning(HTML_APRIL))
    expect(r.reason).toBe('unchanged')
    expect(r.hasNew).toBe(false)
  })

  it('changed : URL différente (hash + date) → hasNew=true', async () => {
    const known = 'https://cdn.onem.be/h1/barema-new-01042026.xlsx'
    const r = await checkOnemForNewBareme(known, stubFetchReturning(HTML_JULY))
    expect(r.reason).toBe('changed')
    expect(r.hasNew).toBe(true)
    expect(r.latest?.fileName).toBe('barema-new-01072026.xlsx')
  })

  it('fetch_failed : fetch qui throw → hasNew=false, latest=null (best-effort)', async () => {
    const throwingFetch = (async () => {
      throw new Error('network blocked')
    }) as unknown as typeof fetch
    const r = await checkOnemForNewBareme('whatever', throwingFetch)
    expect(r.reason).toBe('fetch_failed')
    expect(r.hasNew).toBe(false)
    expect(r.latest).toBeNull()
  })
})
