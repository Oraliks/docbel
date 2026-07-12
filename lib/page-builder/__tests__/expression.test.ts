import { describe, it, expect } from 'vitest'
import { evalFormula } from '../expression'

describe('evalFormula — arithmétique sûre', () => {
  it('respecte la priorité des opérateurs', () => {
    expect(evalFormula('2 + 3 * 4', {})).toBe(14)
    expect(evalFormula('(2 + 3) * 4', {})).toBe(20)
    expect(evalFormula('10 - 2 - 3', {})).toBe(5) // associativité gauche
  })

  it('gère le modulo et la division', () => {
    expect(evalFormula('10 % 3', {})).toBe(1)
    expect(evalFormula('9 / 2', {})).toBe(4.5)
  })

  it('gère l’unaire moins et plus', () => {
    expect(evalFormula('-5 + 2', {})).toBe(-3)
    expect(evalFormula('3 * -2', {})).toBe(-6)
    expect(evalFormula('+4', {})).toBe(4)
  })

  it('gère l’exponentiation ** (droite-associative)', () => {
    expect(evalFormula('2 ** 10', {})).toBe(1024)
    expect(evalFormula('2 ** 3 ** 2', {})).toBe(512)
  })

  it('gère les décimaux', () => {
    expect(evalFormula('0.1 + 0.2', {})).toBeCloseTo(0.3, 10)
    expect(evalFormula('.5 * 2', {})).toBe(1)
  })

  it('résout les variables numériques', () => {
    expect(evalFormula('salary * 0.65', { salary: 2000 })).toBe(1300)
    expect(evalFormula('a + b', { a: 3, b: 4 })).toBe(7)
  })

  it('coerce les variables chaîne numériques', () => {
    expect(evalFormula('x * 2', { x: '21' })).toBe(42)
  })

  it('n’échoue pas sur une variable non numérique NON référencée', () => {
    expect(evalFormula('a + 1', { a: 2, choix: 'texte' })).toBe(3)
  })
})

describe('evalFormula — fonctions Math whitelistées', () => {
  it('supporte Math.round / floor / ceil / abs', () => {
    expect(evalFormula('Math.round(2.6)', {})).toBe(3)
    expect(evalFormula('Math.floor(2.9)', {})).toBe(2)
    expect(evalFormula('Math.ceil(2.1)', {})).toBe(3)
    expect(evalFormula('Math.abs(-7)', {})).toBe(7)
  })

  it('supporte Math.min / max / pow / sqrt (variadique)', () => {
    expect(evalFormula('Math.max(1, 9, 4)', {})).toBe(9)
    expect(evalFormula('Math.min(1, 9, 4)', {})).toBe(1)
    expect(evalFormula('Math.pow(2, 8)', {})).toBe(256)
    expect(evalFormula('Math.sqrt(144)', {})).toBe(12)
  })

  it('supporte les constantes Math.PI et Math.E', () => {
    expect(evalFormula('Math.PI', {})).toBeCloseTo(Math.PI, 10)
    expect(evalFormula('Math.E', {})).toBeCloseTo(Math.E, 10)
  })

  it('supporte les fonctions sans préfixe Math.', () => {
    expect(evalFormula('round(2.5)', {})).toBe(3)
    expect(evalFormula('max(a, b)', { a: 5, b: 12 })).toBe(12)
  })

  it('imbrique fonctions et arithmétique', () => {
    expect(evalFormula('Math.round(salary * 0.6537)', { salary: 2000 })).toBe(1307)
  })
})

describe('evalFormula — refus des entrées invalides ou hostiles', () => {
  it('renvoie null sur division par zéro (non fini)', () => {
    expect(evalFormula('1 / 0', {})).toBeNull()
    expect(evalFormula('0 / 0', {})).toBeNull()
  })

  it('renvoie null pour une variable inconnue', () => {
    expect(evalFormula('inconnu * 2', {})).toBeNull()
  })

  it('renvoie null pour une variable référencée non numérique', () => {
    expect(evalFormula('x + 1', { x: 'abc' })).toBeNull()
  })

  it('renvoie null sur les tentatives d’accès à du code', () => {
    const hostile = [
      'constructor',
      'this.constructor.constructor("return process")()',
      'process.exit(1)',
      'globalThis',
      'window.alert(1)',
      'fetch("http://evil")',
      '(() => 1)()',
      'a["b"]',
      'x.y',
      '`${x}`',
      'eval("1")',
      '1 && 2',
      '1 ? 2 : 3',
      'x = 1',
    ]
    for (const expr of hostile) {
      expect(evalFormula(expr, { x: 1, a: 1 }), `devrait refuser: ${expr}`).toBeNull()
    }
  })

  it('renvoie null pour une syntaxe malformée', () => {
    expect(evalFormula('2 + (3', {})).toBeNull()
    expect(evalFormula('2 + 2 foo', {})).toBeNull()
    expect(evalFormula('* 5', {})).toBeNull()
    expect(evalFormula('', {})).toBeNull()
    expect(evalFormula('   ', {})).toBeNull()
    expect(evalFormula('2 3', {})).toBeNull()
  })

  it('refuse une fonction Math non whitelistée', () => {
    expect(evalFormula('Math.constructor(1)', {})).toBeNull()
    expect(evalFormula('Math.random()', {})).toBeNull() // non déterministe → hors whitelist
  })

  it('refuse un point-virgule / séquence', () => {
    expect(evalFormula('1; 2', {})).toBeNull()
  })
})
