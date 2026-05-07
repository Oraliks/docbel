import { prisma } from "@/lib/prisma"
import * as bcrypt from "bcryptjs"

async function main() {
  try {
    const email = process.env.DOCBEL_MEMBER_EMAIL?.trim().toLowerCase() || "member@docbel.local"
    const password = process.env.DOCBEL_MEMBER_PASSWORD || "Member123456!"
    const passwordHash = await bcrypt.hash(password, 10)

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name: "Membre Docbel",
        password: passwordHash,
        role: "user",
        status: "active",
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
      create: {
        name: "Membre Docbel",
        email,
        password: passwordHash,
        role: "user",
        status: "active",
      },
    })

    await prisma.account.upsert({
      where: {
        providerId_accountId: { providerId: "credential", accountId: user.id },
      },
      update: { password: passwordHash },
      create: {
        id: `acc_${user.id}_credential`,
        accountId: user.id,
        providerId: "credential",
        userId: user.id,
        password: passwordHash,
      },
    })

    console.log("Member user ready")
    console.log(`Email: ${email}`)
    console.log(`Password: ${password}`)
    console.log(`Role: ${user.role}`)
  } catch (error) {
    console.error("Error creating member user:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
