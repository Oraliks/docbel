import { PrismaClient, Prisma } from '@prisma/client'

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined
}
const logLevel = process.env.DATABASE_LOG_LEVEL

function makeClient(): PrismaClient {
  return new PrismaClient({
    log: logLevel === 'query' ? ['query', 'error', 'warn'] : ['error', 'warn'],
  })
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? makeClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

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
 * Retry wrapper for transient connection errors (Neon cold start, pgbouncer reset).
 * Forces a fresh client on connection-closed errors so subsequent retries don't
 * keep hitting a stale pool.
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
      // Reset the connection so the next retry doesn't reuse a closed pool
      try {
        await prisma.$disconnect()
      } catch {
        // ignore — disconnect can fail if the pool is already gone
      }
      // 300ms → 5s cap, fast at first, then steady polling for Neon cold start
      const delay = Math.min(5000, 300 * Math.pow(2, i))
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw lastErr
}
