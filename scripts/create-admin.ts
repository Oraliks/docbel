import { prisma } from "@/lib/prisma"
import * as bcrypt from "bcryptjs"

async function main() {
  const adminEmail = process.env.DOCBEL_ADMIN_EMAIL?.trim().toLowerCase() || "admin@docbel.local"
  const adminPassword = process.env.DOCBEL_ADMIN_PASSWORD || "Admin123456!"

  try {
    const passwordHash = await bcrypt.hash(adminPassword, 10)

    const admin = await prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        name: "Admin Docbel",
        password: passwordHash,
        role: "admin",
        status: "active",
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
      create: {
        name: "Admin Docbel",
        email: adminEmail,
        password: passwordHash,
        role: "admin",
        status: "active",
      },
    })

    console.log("Admin user ready")
    console.log(`Email: ${adminEmail}`)
    console.log(`Password: ${adminPassword}`)
    console.log(`Role: ${admin.role}`)
    console.log(`User ID: ${admin.id}`)
  } catch (error) {
    console.error("Error creating admin user:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
