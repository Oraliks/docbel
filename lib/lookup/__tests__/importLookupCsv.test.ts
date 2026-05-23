import { describe, it, expect } from 'vitest'
import { parseCsv, detectColumns } from '../importLookupCsv'

describe('parseCsv (ONEM CSV)', () => {
  it('parse un CSV ONEM type avec 5 lignes meta puis en-tête', () => {
    const csv = `Liste des lookups: SignaleticCompensationArticle
;22/05/2026 19:55:46
Critères de recherche
Date valeur;22/05/2026
Date de fin;Les deux
Code;Date de début;Date de fin;Description française;Description néerlandaise;Description allemande;Description anglaise;Dernière modification;
    44;01/06/1992;;Pas privé de travail et/ou rémunération;Niet vrijwillig zonder arbeid of loon;;;05/06/2009;
    45;01/04/2006;;Droit aux allocations d'établissement ;Recht op vestigingsuitkeringen ;;;07/07/2006;
`
    const rows = parseCsv(csv)
    // 5 meta + 1 header + 2 data = 8 rows
    expect(rows.length).toBeGreaterThanOrEqual(7)
    // La ligne d'en-tête contient "Code" en première cellule
    const headerRow = rows.find((r) => (r[0] ?? '').toLowerCase().trim() === 'code')
    expect(headerRow).toBeDefined()
    expect(headerRow![3]).toBe('Description française')
  })

  it('détecte le séparateur ; correctement', () => {
    const csv = 'a;b;c\n1;2;3\n'
    const rows = parseCsv(csv)
    expect(rows).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ])
  })

  it('gère les valeurs avec guillemets contenant un séparateur', () => {
    const csv = 'code;desc\n1;"hello;world"\n'
    const rows = parseCsv(csv)
    expect(rows[1]).toEqual(['1', 'hello;world'])
  })

  it('gère le padding par espaces typique ONEM', () => {
    const csv = `Code;Date de début;Description française;
    44;01/06/1992;Pas privé;`
    const rows = parseCsv(csv)
    expect(rows[1][0]).toBe('    44')
    // Le trim final se fait dans le pipeline d'import, pas dans parseCsv
  })
})

describe('detectColumns (fallback BCPost-style)', () => {
  it('fallback labelFr sur 1ère colonne texte significative (cas BCPost)', () => {
    const header = [
      'Code postal', 'Date de début', 'Date de fin', 'Code INS', 'BC',
      'Régime linguistique', 'Région', 'lookup_label_commentLegal',
      'Dernière modification', ''
    ]
    const cols = detectColumns(header)
    expect(cols.code).toBe(0)
    expect(cols.validFrom).toBe(1)
    expect(cols.validUntil).toBe(2)
    // Pas de "Description française/néerlandaise" → fallback sur 1ère colonne texte
    // qui n'est pas Code/Date/lookup_label/modification → "Code INS" (col 3)
    expect(cols.labelFr).toBe(3)
    expect(cols.labelNl).toBe(-1)
  })

  it('détecte normalement "Description française" quand présent', () => {
    const header = [
      'Code', 'Date de début', 'Date de fin', 'Description française',
      'Description néerlandaise', 'Dernière modification'
    ]
    const cols = detectColumns(header)
    expect(cols.code).toBe(0)
    expect(cols.labelFr).toBe(3)
    expect(cols.labelNl).toBe(4)
  })

  it('détecte "Desc FR" abrégé (cas UnemploymentOffice)', () => {
    const header = ['Code', 'Date de début', 'Date de fin', 'Desc FR', 'Desc NL']
    const cols = detectColumns(header)
    expect(cols.labelFr).toBe(3)
    expect(cols.labelNl).toBe(4)
  })

  it('détecte "Nom" comme labelFr quand pas de description (ShelteredWorkshop)', () => {
    const header = [
      'Code numéro de reconnaissance', 'Date de début', 'Date de fin', 'Nom',
      'Fonds', 'Rue', 'Numéro', 'Code postal', 'Localité', 'Dernière modification'
    ]
    const cols = detectColumns(header)
    expect(cols.code).toBe(0)
    expect(cols.labelFr).toBe(3) // "Nom"
  })
})

describe('full pipeline expectations', () => {
  it('le findHeaderRow logique trouve la ligne Code malgré les meta lignes', () => {
    // On teste l'API publique via la fonction parseCsv puis on simule findHeaderRow
    const csv = `Liste des lookups: Foo
;22/05/2026 19:55:46
Critères de recherche
Date valeur;22/05/2026
Code;Date de début;Description française;Description néerlandaise;
    1;01/01/2020;Test FR;Test NL;
`
    const rows = parseCsv(csv)
    let headerIdx = -1
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].some((c) => /^code\b/i.test((c ?? '').trim()))) {
        headerIdx = i
        break
      }
    }
    expect(headerIdx).toBe(4)
    // Les data rows sont après
    const dataRows = rows.slice(headerIdx + 1)
    expect(dataRows[0][0].trim()).toBe('1')
    expect(dataRows[0][2]).toBe('Test FR')
  })
})
