import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as { prisma: PrismaClient }
const logLevel = process.env.DATABASE_LOG_LEVEL

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: logLevel === 'query' ? ['query', 'error', 'warn'] : ['error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
