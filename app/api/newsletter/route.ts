import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminAuth } from "@/lib/auth-check"
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit"
import { ensureWriteAllowed } from "@/lib/admin/readonly-guard"

export async function GET() {
  const authCheck = await requireAdminAuth()
  if (!authCheck.isAuthorized) return authCheck.error

  try {
    const subscribers = await prisma.newsletterSubscriber.findMany({
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json(subscribers, {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    })
  } catch (error) {
    console.error("Error fetching newsletter subscribers:", error)
    return NextResponse.json({ error: "Failed to fetch subscribers" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const writeBlock = await ensureWriteAllowed()
  if (writeBlock) return writeBlock

  try {
    // Rate-limit anti-spam : 5 inscriptions / 10 min / IP
    const ip = getClientIp(request)
    const rl = checkRateLimit(`newsletter:${ip}`, { windowMs: 10 * 60_000, max: 5 })
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Trop de requêtes — réessayez dans quelques minutes" },
        { status: 429, headers: { "Content-Type": "application/json; charset=utf-8" } }
      )
    }

    const body = await request.json()
    const { email } = body

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Email invalide" }, { status: 400 })
    }

    const existing = await prisma.newsletterSubscriber.findUnique({ where: { email } })

    if (existing) {
      if (existing.status === "unsubscribed") {
        await prisma.newsletterSubscriber.update({
          where: { email },
          data: { status: "active" },
        })
        return NextResponse.json({ message: "Réabonnement confirmé" }, { status: 200 })
      }
      return NextResponse.json({ message: "Déjà inscrit" }, { status: 200 })
    }

    const subscriber = await prisma.newsletterSubscriber.create({
      data: { email, source: "actualites" },
    })

    return NextResponse.json(subscriber, {
      status: 201,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    })
  } catch (error) {
    console.error("Error subscribing to newsletter:", error)
    return NextResponse.json({ error: "Failed to subscribe" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const authCheck = await requireAdminAuth()
  if (!authCheck.isAuthorized) return authCheck.error

  try {
    const body = await request.json()
    const { id, status } = body

    if (!id || !["active", "unsubscribed"].includes(status)) {
      return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 })
    }

    const updated = await prisma.newsletterSubscriber.update({
      where: { id },
      data: { status },
    })

    return NextResponse.json(updated, {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    })
  } catch (error) {
    console.error("Error updating subscriber:", error)
    return NextResponse.json({ error: "Failed to update subscriber" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const authCheck = await requireAdminAuth()
  if (!authCheck.isAuthorized) return authCheck.error

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 })
    }

    await prisma.newsletterSubscriber.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting subscriber:", error)
    return NextResponse.json({ error: "Failed to delete subscriber" }, { status: 500 })
  }
}
