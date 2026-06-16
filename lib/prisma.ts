import { PrismaClient, Prisma } from '@prisma/client'

const globalForPrisma = global as unknown as {
  prismaBase: PrismaClient | undefined
}
const logLevel = process.env.DATABASE_LOG_LEVEL

function makeClient(): PrismaClient {
  return new PrismaClient({
    log: logLevel === 'query' ? ['query', 'error', 'warn'] : ['error', 'warn'],
  })
}

// Client DE BASE — non étendu. Mis en cache global :
//   - en dev pour ne pas exploser le pool entre rebuilds HMR
//   - en prod pour partager une instance entre invocations chaudes Vercel
// On garde une référence dédiée (base) pour pouvoir le $disconnect() à la
// main depuis withDbRetry — le client étendu n'expose pas un $disconnect
// fortement typé identique.
const base: PrismaClient = globalForPrisma.prismaBase ?? makeClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prismaBase = base

function isTransientConnectionError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return ['P1001', 'P1002', 'P1008', 'P1017'].includes(err.code)
  }
  if (err instanceof Prisma.PrismaClientInitializationError) return true
  if (err instanceof Error) {
    return /closed|connection|timeout|Can't reach|reset by peer/i.test(err.message)
  }
  return false
}

/**
 * Retry wrapper for transient connection errors (Neon cold start, pgbouncer
 * reset, brief outage). Forces a fresh client on connection-closed errors so
 * subsequent retries don't keep hitting a stale pool.
 *
 * Note : `prisma` auto-retry désormais chaque opération individuelle (cf.
 * extension plus bas). Les call-sites existants qui font
 * `withDbRetry(() => prisma.x.find())` deviennent largement redondants, mais
 * restent sans danger — l'inner retry de l'extension succède d'abord et
 * `withDbRetry` ne voit jamais d'erreur. On conserve l'export pour la
 * rétro-compatibilité et pour les cas où le retry doit englober plusieurs
 * opérations indépendantes (ex. `auth.api.getSession` côté admin).
 */
export async function withDbRetry<T>(
  fn: () => Promise<T>,
  attempts = 8
): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (!isTransientConnectionError(err) || i === attempts - 1) throw err
      // Reset la connexion pour ne pas retomber sur un pool fermé.
      try {
        await base.$disconnect()
      } catch {
        // ignore — disconnect peut planter si le pool est déjà coupé
      }
      // 300 ms → 5 s, rapide au début puis polling régulier pour le cold-start Neon
      const delay = Math.min(5000, 300 * Math.pow(2, i))
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw lastErr
}

/// Retry interne pour l'extension : 4 essais, ~3 s max (200 / 400 / 800 / 1600 ms).
/// Pas de $disconnect entre essais — le pool Prisma se reconnecte tout seul ;
/// on parie sur le réveil du compute Neon scale-to-zero, qui répond
/// typiquement en < 2 s. Pour les pannes plus longues, l'erreur remonte
/// normalement (et le caller peut, lui, wrapper dans `withDbRetry` pour plus
/// d'essais).
async function retryOpOnTransient<T>(fn: () => Promise<T>): Promise<T> {
  const maxAttempts = 4
  let lastErr: unknown
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (!isTransientConnectionError(err) || i === maxAttempts - 1) throw err
      const delay = Math.min(1600, 200 * Math.pow(2, i))
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw lastErr
}

/**
 * Client Prisma utilisé partout dans l'app. Wrap par `$extends` : chaque
 * opération de modèle est automatiquement retentée sur erreur de connexion
 * transitoire. Couvre EN UNE FOIS :
 *   - tous les `prisma.X.find/create/update/delete` du code app
 *   - better-auth (passé via `prismaAdapter(prisma, …)` dans lib/auth.ts) →
 *     plus de « Failed to get session » sur cold-start
 *   - les routes cron qui n'utilisent pas explicitement `withDbRetry`
 *
 * Le retry est court (~3 s max) et silencieux — pensé pour absorber les
 * cold-starts Neon, pas pour masquer une vraie panne. Au-delà, l'erreur
 * remonte normalement.
 *
 * NB : les opérations à l'intérieur d'un `prisma.$transaction(async tx => …)`
 * passent par le contexte `tx`, pas par ce client étendu — donc pas
 * d'auto-retry au sein d'une transaction (volontaire : on ne veut pas rejouer
 * une op partiellement appliquée).
 */
const extended = base.$extends({
  query: {
    $allOperations: ({ args, query }) => retryOpOnTransient(() => query(args)),
  },
})

// `$extends` renvoie un type nominalement différent de `PrismaClient` mais
// structurellement identique pour les opérations modèle (on n'ajoute QUE du
// retry sur `query`, pas de `result` ni `model` qui changeraient les types).
// On le ré-expose comme `PrismaClient` pour que les ~80 call-sites existants
// continuent de compiler sans modification.
export const prisma: PrismaClient = extended as unknown as PrismaClient
