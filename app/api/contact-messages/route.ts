import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-logger"
import { requireAdminAuth } from "@/lib/auth-check"

export async function GET() {
  const authCheck = await requireAdminAuth()
  if (!authCheck.isAuthorized) return authCheck.error

  try {
    const messages = await prisma.contactMessage.findMany({
      orderBy: {
        createdAt: "desc",
      },
    })
    return NextResponse.json(messages)
  } catch (error) {
    console.error("Error fetching contact messages:", error)
    return NextResponse.json(
      { error: "Failed to fetch contact messages" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, subject, message } = body

    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Create contact message
    const newMessage = await prisma.contactMessage.create({
      data: {
        name,
        email,
        subject,
        message,
        status: "NEW",
      },
    })

    // Log activity
    await logActivity(
      "Contact Form",
      "received",
      "message",
      `${name} (${email})`,
      newMessage.id,
      `Sujet: ${subject}`
    )

    return NextResponse.json(newMessage, { status: 201 })
  } catch (error) {
    console.error("Error creating contact message:", error)
    return NextResponse.json(
      { error: "Failed to create contact message" },
      { status: 500 }
    )
  }
}
