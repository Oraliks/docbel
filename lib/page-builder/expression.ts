// =====================================================================
//  Évaluateur d'expressions arithmétiques SÛR (page-builder / calculatrice).
//
//  Remplace l'ancien `new Function(...)` du bloc calculatrice : au lieu de
//  compiler puis exécuter du JavaScript arbitraire (filtré par regex), on
//  tokenise et on évalue nous-mêmes une grammaire STRICTE et FERMÉE :
//    nombres · + - * / % ** · parenthèses · variables numériques ·
//    une whitelist de fonctions Math (round, min, max, pow, sqrt, …) ·
//    les constantes Math.PI / Math.E.
//
//  Rien d'autre n'est reconnu : pas d'accès membre libre, pas d'appel de
//  méthode hors whitelist, pas d'affectation, de séquence, de template
//  string, de ternaire, de logique — donc aucune surface d'exécution de
//  code. Toute entrée hors grammaire → `null` (comme l'ancien contrat).
// =====================================================================

/** Fonctions Math autorisées (déterministes, purement numériques). */
const FUNCS: Record<string, (...args: number[]) => number> = {
  abs: Math.abs,
  ceil: Math.ceil,
  floor: Math.floor,
  round: Math.round,
  trunc: Math.trunc,
  sign: Math.sign,
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  pow: Math.pow,
  exp: Math.exp,
  log: Math.log,
  log2: Math.log2,
  log10: Math.log10,
  min: Math.min,
  max: Math.max,
  hypot: Math.hypot,
}

/** Constantes Math autorisées (accès `Math.PI`, `Math.E`). */
const CONSTS: Record<string, number> = {
  PI: Math.PI,
  E: Math.E,
}

type Tok =
  | { t: 'num'; v: number }
  | { t: 'id'; v: string }
  | { t: 'op'; v: string }

/** Découpe l'expression en jetons. Lève sur tout caractère non reconnu. */
function tokenize(input: string): Tok[] {
  const toks: Tok[] = []
  let i = 0
  const n = input.length
  while (i < n) {
    const c = input[i]
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      i++
      continue
    }
    // Nombre : 12, 12.5, .5, 1e3
    if ((c >= '0' && c <= '9') || (c === '.' && /[0-9]/.test(input[i + 1] ?? ''))) {
      let j = i
      while (j < n && /[0-9.]/.test(input[j])) j++
      // Exposant scientifique optionnel.
      if (input[j] === 'e' || input[j] === 'E') {
        j++
        if (input[j] === '+' || input[j] === '-') j++
        while (j < n && /[0-9]/.test(input[j])) j++
      }
      const raw = input.slice(i, j)
      const v = Number(raw)
      if (!Number.isFinite(v)) throw new Error(`nombre invalide: ${raw}`)
      toks.push({ t: 'num', v })
      i = j
      continue
    }
    // Identifiant : lettres / chiffres / _
    if (/[A-Za-z_]/.test(c)) {
      let j = i
      while (j < n && /[A-Za-z0-9_]/.test(input[j])) j++
      toks.push({ t: 'id', v: input.slice(i, j) })
      i = j
      continue
    }
    // Opérateur `**` (avant `*`).
    if (c === '*' && input[i + 1] === '*') {
      toks.push({ t: 'op', v: '**' })
      i += 2
      continue
    }
    if ('+-*/%(),.'.includes(c)) {
      toks.push({ t: 'op', v: c })
      i++
      continue
    }
    throw new Error(`caractère non autorisé: ${c}`)
  }
  return toks
}

/**
 * Parseur/évaluateur à descente récursive. Précédence (faible → forte) :
 * additif → multiplicatif → puissance → unaire → primaire.
 */
class Parser {
  private pos = 0
  constructor(
    private toks: Tok[],
    private vars: Record<string, number | string>
  ) {}

  private peek(): Tok | undefined {
    return this.toks[this.pos]
  }

  private isOp(v: string): boolean {
    const t = this.peek()
    return !!t && t.t === 'op' && t.v === v
  }

  private eat(): Tok {
    const t = this.toks[this.pos]
    if (!t) throw new Error('fin d’expression inattendue')
    this.pos++
    return t
  }

  private expectOp(v: string): void {
    if (!this.isOp(v)) throw new Error(`« ${v} » attendu`)
    this.pos++
  }

  parse(): number {
    const value = this.additive()
    if (this.pos !== this.toks.length) throw new Error('jeton résiduel')
    return value
  }

  private additive(): number {
    let left = this.multiplicative()
    while (this.isOp('+') || this.isOp('-')) {
      const op = this.eat().v
      const right = this.multiplicative()
      left = op === '+' ? left + right : left - right
    }
    return left
  }

  private multiplicative(): number {
    let left = this.unary()
    while (this.isOp('*') || this.isOp('/') || this.isOp('%')) {
      const op = this.eat().v
      const right = this.unary()
      left = op === '*' ? left * right : op === '/' ? left / right : left % right
    }
    return left
  }

  private unary(): number {
    if (this.isOp('+')) {
      this.eat()
      return this.unary()
    }
    if (this.isOp('-')) {
      this.eat()
      return -this.unary()
    }
    return this.power()
  }

  private power(): number {
    const base = this.primary()
    if (this.isOp('**')) {
      this.eat()
      // Droite-associatif : l'exposant peut porter un signe unaire.
      return Math.pow(base, this.unary())
    }
    return base
  }

  private primary(): number {
    if (this.isOp('(')) {
      this.eat()
      const v = this.additive()
      this.expectOp(')')
      return v
    }
    const t = this.peek()
    if (!t) throw new Error('expression incomplète')
    if (t.t === 'num') {
      this.eat()
      return t.v
    }
    if (t.t === 'id') {
      this.eat()
      // `Math.xxx` — appel de fonction whitelistée ou constante.
      if (t.v === 'Math') {
        this.expectOp('.')
        const member = this.eat()
        if (member.t !== 'id') throw new Error('membre Math invalide')
        if (this.isOp('(')) return this.callFunction(member.v)
        if (member.v in CONSTS) return CONSTS[member.v]
        throw new Error(`Math.${member.v} non autorisé`)
      }
      // `fn(...)` — fonction whitelistée sans préfixe Math.
      if (this.isOp('(')) return this.callFunction(t.v)
      // Sinon : variable numérique.
      return this.resolveVar(t.v)
    }
    throw new Error('jeton inattendu')
  }

  private callFunction(name: string): number {
    const fn = FUNCS[name]
    if (!fn) throw new Error(`fonction non autorisée: ${name}`)
    this.expectOp('(')
    const args: number[] = []
    if (!this.isOp(')')) {
      args.push(this.additive())
      while (this.isOp(',')) {
        this.eat()
        args.push(this.additive())
      }
    }
    this.expectOp(')')
    return fn(...args)
  }

  private resolveVar(name: string): number {
    if (!Object.prototype.hasOwnProperty.call(this.vars, name)) {
      throw new Error(`variable inconnue: ${name}`)
    }
    const raw = this.vars[name]
    const num = typeof raw === 'number' ? raw : Number(raw)
    if (!Number.isFinite(num)) throw new Error(`variable non numérique: ${name}`)
    return num
  }
}

/**
 * Évalue une expression arithmétique sûre.
 * @returns un nombre fini, ou `null` si l'expression est vide, malformée,
 *          hors grammaire, référence une variable inconnue/non numérique, ou
 *          produit un résultat non fini (ex. division par zéro).
 */
export function evalFormula(
  expression: string,
  vars: Record<string, number | string>
): number | null {
  if (typeof expression !== 'string' || expression.trim() === '') return null
  try {
    const toks = tokenize(expression)
    if (toks.length === 0) return null
    const result = new Parser(toks, vars).parse()
    return typeof result === 'number' && Number.isFinite(result) ? result : null
  } catch {
    return null
  }
}
