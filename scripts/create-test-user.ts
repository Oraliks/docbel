import { prisma } from "@/lib/prisma"
import * as bcrypt from "bcryptjs"

async function main() {
  try {
    // Check if test user exists
    const existing = await prisma.user.findUnique({
      where: { email: "test@example.com" },
    })

    if (existing) {
      console.log("Test user already exists")
      return
    }

    // Create test user
    const hashedPassword = await bcrypt.hash("password123", 10)
    const user = await prisma.user.create({
      data: {
        name: "Test User",
        email: "test@example.com",
        password: hashedPassword,
        role: "user",
      },
    })

    console.log("Test user created successfully:")
    console.log(`Email: ${user.email}`)
    console.log(`Password: password123`)
    console.log(`Role: ${user.role}`)
  } catch (error) {
    console.error("Error creating test user:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
