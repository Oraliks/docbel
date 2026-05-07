import { prisma } from "@/lib/prisma"

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, password: true, createdAt: true, updatedAt: true },
  })

  let created = 0
  let skipped = 0
  let missingPassword = 0

  for (const user of users) {
    if (!user.password || user.password.length === 0) {
      missingPassword++
      console.warn(`- skipped (no password): ${user.email}`)
      continue
    }

    const existing = await prisma.account.findUnique({
      where: {
        providerId_accountId: { providerId: "credential", accountId: user.id },
      },
      select: { id: true },
    })

    if (existing) {
      skipped++
      continue
    }

    await prisma.account.create({
      data: {
        id: `acc_${user.id}_credential`,
        accountId: user.id,
        providerId: "credential",
        userId: user.id,
        password: user.password,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    })

    created++
    console.log(`+ created credential account for: ${user.email}`)
  }

  console.log("")
  console.log(`Done. created=${created} skipped=${skipped} missingPassword=${missingPassword}`)
}

main()
  .catch((error) => {
    console.error("Backfill failed:", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
