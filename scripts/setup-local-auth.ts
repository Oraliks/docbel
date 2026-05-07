import { prisma } from "@/lib/prisma"
import * as bcrypt from "bcryptjs"

type BootstrapUser = {
  name: string
  email: string
  password: string
  role: "admin" | "user"
}

async function upsertUser(user: BootstrapUser) {
  const passwordHash = await bcrypt.hash(user.password, 10)

  const saved = await prisma.user.upsert({
    where: { email: user.email },
    update: {
      name: user.name,
      password: passwordHash,
      role: user.role,
      status: "active",
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
    create: {
      name: user.name,
      email: user.email,
      password: passwordHash,
      role: user.role,
      status: "active",
    },
  })

  await prisma.account.upsert({
    where: {
      providerId_accountId: { providerId: "credential", accountId: saved.id },
    },
    update: { password: passwordHash },
    create: {
      id: `acc_${saved.id}_credential`,
      accountId: saved.id,
      providerId: "credential",
      userId: saved.id,
      password: passwordHash,
    },
  })

  return saved
}

async function main() {
  const adminEmail = process.env.DOCBEL_ADMIN_EMAIL?.trim().toLowerCase() || "admin@docbel.local"
  const adminPassword = process.env.DOCBEL_ADMIN_PASSWORD || "Admin123456!"
  const memberEmail = process.env.DOCBEL_MEMBER_EMAIL?.trim().toLowerCase() || "member@docbel.local"
  const memberPassword = process.env.DOCBEL_MEMBER_PASSWORD || "Member123456!"

  const users: BootstrapUser[] = [
    {
      name: "Admin Docbel",
      email: adminEmail,
      password: adminPassword,
      role: "admin",
    },
    {
      name: "Membre Docbel",
      email: memberEmail,
      password: memberPassword,
      role: "user",
    },
  ]

  console.log("Bootstrapping local auth users...")

  for (const user of users) {
    const saved = await upsertUser(user)
    console.log(`- ${saved.role}: ${saved.email}`)
  }

  console.log("")
  console.log("Identifiants locaux:")
  console.log(`Admin  : ${adminEmail} / ${adminPassword}`)
  console.log(`Membre : ${memberEmail} / ${memberPassword}`)
}

main()
  .catch((error) => {
    console.error("Failed to bootstrap local auth users:", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
