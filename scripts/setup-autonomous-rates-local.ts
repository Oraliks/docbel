/** Local disposable database only. Never reads .env.local or seeds production. */
import { PrismaClient } from '@prisma/client'
import { randomBytes } from 'node:crypto'
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import * as bcrypt from 'bcryptjs'

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? '')
  if (url.hostname !== '127.0.0.1' || url.port !== '55433' || url.pathname !== '/autonomous_rates_test') throw new Error('LOCAL_DISPOSABLE_DATABASE_REQUIRED')
  const prisma = new PrismaClient()
  try {
    if (process.env.AUTONOMOUS_RATES_RESET_TEST === '1') {
      await prisma.$transaction(async tx => {
        await tx.autonomousRatePublication.deleteMany({})
        await tx.autonomousRateRegistry.update({ where: { id: 'autonomous-rates' }, data: { versionId: null, generation: 0 } })
        await tx.autonomousRateVersion.deleteMany({})
      })
    }
    const password = randomBytes(20).toString('base64url')
    const hash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({ data: { email: `autonomous-${Date.now()}@local.test`, name: 'Recette locale', role: 'admin', status: 'active', emailVerified: true, password: hash } })
    await prisma.account.create({ data: { id: `autonomous-${user.id}`, accountId: user.id, userId: user.id, providerId: 'credential', password: hash } })
    mkdirSync('private/backups/autonomous-rates-test', { recursive: true })
    writeFileSync('private/backups/autonomous-rates-test/credentials.json', JSON.stringify({ email: user.email, password, userId: user.id }))
    console.info('Local test admin created; credentials stored only in ignored private test storage.')
    if (process.env.AUTONOMOUS_RATES_PREVIEW_XLSX) {
      const { importVersion } = await import('../lib/baremes-autonome/service')
      const { prisma: serviceClient } = await import('../lib/prisma')
      try {
        const version = await importVersion(readFileSync(process.env.AUTONOMOUS_RATES_PREVIEW_XLSX), 'barema20260901-new.xlsx', user.id)
        console.info(`Local preview: http://localhost:3010/admin/baremes-autonome?version=${version.id}`)
      } finally { await serviceClient.$disconnect() }
    }
  } finally { await prisma.$disconnect() }
}
void main()
