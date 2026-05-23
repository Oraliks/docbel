import { describe, expect, it } from 'vitest'
import { parseOnemCode } from '../parseOnemCode'

describe('parseOnemCode', () => {
  it('returns null for empty input', () => {
    expect(parseOnemCode('')).toBeNull()
    expect(parseOnemCode('   ')).toBeNull()
  })

  it('returns null for free text', () => {
    expect(parseOnemCode('cohabitant')).toBeNull()
    expect(parseOnemCode('bruxelles')).toBeNull()
  })

  it('decomposes 01/43AA1 (chômage complet, situation A, phase 1)', () => {
    const a = parseOnemCode('01/43AA1')
    expect(a).not.toBeNull()
    expect(a?.kind).toBe('signaletic-compensation')
    expect(a?.parts.map((p) => p.value)).toEqual(['01', '43', 'A', 'A1'])
    expect(a?.parts[0].description).toBe('Chômage complet')
    expect(a?.parts[3].description).toContain('1ère période')
  })

  it('decomposes 01/42A (sans phase)', () => {
    const a = parseOnemCode('01/42A')
    expect(a?.kind).toBe('signaletic-compensation')
    expect(a?.parts.map((p) => p.label)).toEqual(['Type', 'Ligne', 'Situation familiale'])
  })

  it('decomposes 01/43BX (cohabitant privilégié)', () => {
    const a = parseOnemCode('01/43BX')
    expect(a?.kind).toBe('signaletic-compensation')
    const phase = a?.parts.find((p) => p.label === 'Phase / Période')
    expect(phase?.value).toBe('X')
    expect(phase?.description).toContain('cohabitant privilégié')
  })

  it('decomposes 01/43NB (2ème période)', () => {
    const a = parseOnemCode('01/43NB')
    const phase = a?.parts.find((p) => p.label === 'Phase / Période')
    expect(phase?.description).toContain('2ème période')
  })

  it('handles bare 01/43 (no situation / no phase)', () => {
    const a = parseOnemCode('01/43')
    expect(a?.kind).toBe('signaletic-compensation')
    expect(a?.parts.length).toBe(2)
  })

  // ─── Variations de séparateurs ───────────────────────────────────────────
  it('tolère le format sans slash (0145AA1)', () => {
    const a = parseOnemCode('0145AA1')
    expect(a?.kind).toBe('signaletic-compensation')
    expect(a?.parts.map((p) => p.value)).toEqual(['01', '45', 'A', 'A1'])
  })

  it('tolère un slash supplémentaire (01/45A/A1)', () => {
    const a = parseOnemCode('01/45A/A1')
    expect(a?.kind).toBe('signaletic-compensation')
    expect(a?.parts.map((p) => p.value)).toEqual(['01', '45', 'A', 'A1'])
  })

  it('tolère tirets (01-45-A-A1)', () => {
    const a = parseOnemCode('01-45-A-A1')
    expect(a?.kind).toBe('signaletic-compensation')
    expect(a?.parts.map((p) => p.value)).toEqual(['01', '45', 'A', 'A1'])
  })

  it('tolère espaces (01 45 A A1)', () => {
    const a = parseOnemCode('01 45 A A1')
    expect(a?.kind).toBe('signaletic-compensation')
    expect(a?.parts.map((p) => p.value)).toEqual(['01', '45', 'A', 'A1'])
  })

  it('tolère casse mixte (01/45aa1)', () => {
    const a = parseOnemCode('01/45aa1')
    expect(a?.kind).toBe('signaletic-compensation')
    expect(a?.parts.map((p) => p.value)).toEqual(['01', '45', 'A', 'A1'])
  })

  it('tolère slash multiples ou points (01//45.A.A1)', () => {
    const a = parseOnemCode('01//45.A.A1')
    expect(a?.kind).toBe('signaletic-compensation')
    expect(a?.parts.map((p) => p.value)).toEqual(['01', '45', 'A', 'A1'])
  })

  it('détecte ligne à 3 chiffres si nécessaire (01/145BX)', () => {
    const a = parseOnemCode('01/145BX')
    expect(a?.kind).toBe('signaletic-compensation')
    expect(a?.parts[1].value).toBe('145')
  })

  it('préserve le raw original pour l\'affichage', () => {
    expect(parseOnemCode('01/45AA1')?.raw).toBe('01/45AA1')
    expect(parseOnemCode('01-45-A-A1')?.raw).toBe('01-45-A-A1')
    expect(parseOnemCode('  0145AA1  ')?.raw).toBe('0145AA1')
  })

  it('tolère séparateurs sur S-flow (S-04, s.31)', () => {
    expect(parseOnemCode('S-04')?.parts[0].value).toBe('S04')
    expect(parseOnemCode('s.31')?.parts[0].value).toBe('S31')
  })

  it('tolère séparateurs sur code postal (1 000, 1.000)', () => {
    expect(parseOnemCode('1 000')?.kind).toBe('postal')
    expect(parseOnemCode('1.000')?.kind).toBe('postal')
  })

  it('decomposes S-flow S04', () => {
    const a = parseOnemCode('S04')
    expect(a?.kind).toBe('s-flow')
    expect(a?.parts[0].value).toBe('S04')
  })

  it('decomposes S-flow with lowercase and space', () => {
    expect(parseOnemCode('s 04')?.parts[0].value).toBe('S04')
    expect(parseOnemCode('s31')?.parts[0].value).toBe('S31')
  })

  it('decomposes Belgian postal code', () => {
    const a = parseOnemCode('1000')
    expect(a?.kind).toBe('postal')
    expect(a?.parts[0].value).toBe('1000')
    expect(a?.parts[0].description).toBe('Bruxelles-Capitale')
  })

  it('suggests relevant tables for postal codes', () => {
    const a = parseOnemCode('4000')
    expect(a?.suggestedTables).toContain('localite')
  })

  it('rejects postal codes outside the 1000-9999 range', () => {
    expect(parseOnemCode('0500')).toBeNull()
  })

  it('rejects unknown formats', () => {
    expect(parseOnemCode('xyz')).toBeNull()
    expect(parseOnemCode('99/99/99')).toBeNull()
  })
})
