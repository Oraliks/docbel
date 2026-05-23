import { describe, it, expect } from 'vitest'
import {
  parseCellNumber,
  parseCellInteger,
  parseCodeCell,
  normalizeUnit,
  parseBelgianDate,
  extractValidFromFileName,
} from '../normalize'

describe('parseCellNumber', () => {
  it('retourne null pour les cellules vides', () => {
    expect(parseCellNumber('')).toBeNull()
    expect(parseCellNumber('   ')).toBeNull()
    expect(parseCellNumber(null)).toBeNull()
    expect(parseCellNumber(undefined)).toBeNull()
  })

  it('retourne null pour les cellules d’erreur Excel', () => {
    expect(parseCellNumber('#REF!')).toBeNull()
    expect(parseCellNumber('#N/A')).toBeNull()
    expect(parseCellNumber('#DIV/0!')).toBeNull()
  })

  it('parse le format US (2,189.81)', () => {
    expect(parseCellNumber('2,189.81')).toBeCloseTo(2189.81, 4)
  })

  it('parse le format belge (2.189,81 et 62,0788)', () => {
    expect(parseCellNumber('2.189,81')).toBeCloseTo(2189.81, 4)
    expect(parseCellNumber('62,0788')).toBeCloseTo(62.0788, 4)
  })

  it('parse un nombre simple', () => {
    expect(parseCellNumber('76.55')).toBeCloseTo(76.55, 2)
    expect(parseCellNumber('29')).toBe(29)
  })

  it('rejette le texte non numérique', () => {
    expect(parseCellNumber('abc')).toBeNull()
    expect(parseCellNumber('76.55 EUR')).toBeNull()
  })
})

describe('parseCellInteger', () => {
  it('accepte uniquement les entiers stricts', () => {
    expect(parseCellInteger('29')).toBe(29)
    expect(parseCellInteger('  42  ')).toBe(42)
    expect(parseCellInteger('29.5')).toBeNull()
    expect(parseCellInteger('29,5')).toBeNull()
    expect(parseCellInteger('abc')).toBeNull()
    expect(parseCellInteger('')).toBeNull()
  })
})

describe('parseCodeCell', () => {
  it('retourne les codes individuels (multi-lignes)', () => {
    expect(parseCodeCell('AA1')).toEqual(['AA1'])
    expect(parseCodeCell('AB\nAX')).toEqual(['AB', 'AX'])
    expect(parseCodeCell('NB\r\nNX')).toEqual(['NB', 'NX'])
    expect(parseCodeCell('')).toEqual([])
    expect(parseCodeCell(null)).toEqual([])
  })
})

describe('normalizeUnit', () => {
  it('normalise les unités NL et FR vers une forme canonique', () => {
    expect(normalizeUnit('maand')).toBe('monthly')
    expect(normalizeUnit('Maand')).toBe('monthly')
    expect(normalizeUnit('mois')).toBe('monthly')
    expect(normalizeUnit('dag')).toBe('daily')
    expect(normalizeUnit('jour')).toBe('daily')
    expect(normalizeUnit('jaar')).toBe('yearly')
    expect(normalizeUnit('année')).toBe('yearly')
    expect(normalizeUnit('uur')).toBe('hourly')
  })

  it('passe les unités inconnues telles quelles', () => {
    expect(normalizeUnit('semestre')).toBe('semestre')
    expect(normalizeUnit('')).toBeNull()
    expect(normalizeUnit(null)).toBeNull()
  })
})

describe('parseBelgianDate', () => {
  it('parse les formats DD/MM/YYYY', () => {
    const d = parseBelgianDate('1/03/2026')
    expect(d).not.toBeNull()
    expect(d!.getUTCFullYear()).toBe(2026)
    expect(d!.getUTCMonth()).toBe(2) // mars
    expect(d!.getUTCDate()).toBe(1)
  })

  it('parse les années à 2 chiffres', () => {
    const d = parseBelgianDate('3/1/26')
    expect(d!.getUTCFullYear()).toBe(2026)
    expect(d!.getUTCMonth()).toBe(0)
    expect(d!.getUTCDate()).toBe(3)
  })

  it('rejette les formats invalides', () => {
    expect(parseBelgianDate('not a date')).toBeNull()
    expect(parseBelgianDate('32/13/2026')).toBeNull()
    expect(parseBelgianDate('')).toBeNull()
  })
})

describe('extractValidFromFileName', () => {
  it('extrait la date du format DDMMYYYY', () => {
    const d = extractValidFromFileName('barema-new-01042026.xlsx')
    expect(d!.getUTCFullYear()).toBe(2026)
    expect(d!.getUTCMonth()).toBe(3) // avril
    expect(d!.getUTCDate()).toBe(1)
  })

  it('extrait la date du format DD-MM-YYYY', () => {
    const d = extractValidFromFileName('bareme-01-04-2026.xlsx')
    expect(d!.getUTCFullYear()).toBe(2026)
    expect(d!.getUTCMonth()).toBe(3)
    expect(d!.getUTCDate()).toBe(1)
  })

  it('ignore les timestamps epoch en préfixe du nom (avant le -)', () => {
    // Cas réel : la route upload ajoute Date.now() en préfixe avec un -
    const d = extractValidFromFileName('1777763910366-barema-new-01042026.xlsx')
    expect(d!.getUTCFullYear()).toBe(2026)
    expect(d!.getUTCMonth()).toBe(3)
    expect(d!.getUTCDate()).toBe(1)
  })

  it('retourne null si aucune date détectable', () => {
    expect(extractValidFromFileName('mon-fichier.xlsx')).toBeNull()
    expect(extractValidFromFileName('1777763910366.xlsx')).toBeNull()
  })
})
