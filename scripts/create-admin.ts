import { prisma } from "@/lib/prisma"
import * as bcrypt from "bcryptjs"

async function main() {
  const adminEmail = "admin@beldoc.fr"
  const adminPassword = "admin123456"

  try {
    // Check if admin already exists
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail },
    })

    if (existingAdmin) {
      console.log("Admin user already exists!")
      return
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(adminPassword, 10)

    // Create admin user
    const admin = await prisma.user.create({
      data: {
        name: "Admin",
        email: adminEmail,
        password: hashedPassword,
        role: "admin",
      },
    })

    console.log("✅ Admin user created successfully!")
    console.log(`Email: ${adminEmail}`)
    console.log(`Password: ${adminPassword}`)
    console.log(`User ID: ${admin.id}`)
  } catch (error) {
    console.error("Error creating admin user:", error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
