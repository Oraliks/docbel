import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-logger"
import { requireAdminAuth } from "@/lib/auth-check"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const LIMITS = {
  name: { min: 2, max: 100 },
  email: { min: 5, max: 200 },
  subject: { min: 3, max: 200 },
  message: { min: 10, max: 5000 },
} as const

export async function GET() {
  const authCheck = await requireAdminAuth()
  if (!authCheck.isAuthorized) return authCheck.error

  try {
    const messages = await prisma.contactMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
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
    const name = typeof body.name === "string" ? body.name.trim() : ""
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    const subject = typeof body.subject === "string" ? body.subject.trim() : ""
    const message = typeof body.message === "string" ? body.message.trim() : ""

    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: "Tous les champs sont obligatoires" },
        { status: 400 }
      )
    }

    if (name.length < LIMITS.name.min || name.length > LIMITS.name.max) {
      return NextResponse.json({ error: "Nom invalide" }, { status: 400 })
    }
    if (email.length > LIMITS.email.max || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Email invalide" }, { status: 400 })
    }
    if (subject.length < LIMITS.subject.min || subject.length > LIMITS.subject.max) {
      return NextResponse.json({ error: "Sujet invalide" }, { status: 400 })
    }
    if (message.length < LIMITS.message.min || message.length > LIMITS.message.max) {
      return NextResponse.json({ error: "Message invalide" }, { status: 400 })
    }

    const newMessage = await prisma.contactMessage.create({
      data: { name, email, subject, message, status: "NEW" },
    })

    await logActivity(
      "Contact Form",
      "received",
      "message",
      `${name} (${email})`,
      newMessage.id,
      `Sujet: ${subject}`
    )

    return NextResponse.json(
      { id: newMessage.id, status: "ok" },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating contact message:", error)
    return NextResponse.json(
      { error: "Failed to create contact message" },
      { status: 500 }
    )
  }
}
