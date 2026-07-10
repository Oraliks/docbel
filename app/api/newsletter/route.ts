import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminAuth } from "@/lib/auth-check"
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit"
import { ensureWriteAllowed } from "@/lib/admin/readonly-guard"
import { apiError, apiOk } from "@/lib/api/response"
import { tooManyRequests } from "@/lib/api/rate-limit-response"

export async function GET() {
  const authCheck = await requireAdminAuth()
  if (!authCheck.isAuthorized) return authCheck.error

  try {
    const subscribers = await prisma.newsletterSubscriber.findMany({
      orderBy: { createdAt: "desc" },
    })
    return apiOk(subscribers)
  } catch (error) {
    console.error("Error fetching newsletter subscribers:", error)
    return apiError(500, "Failed to fetch subscribers")
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
      return tooManyRequests({
        limit: 5,
        resetAt: rl.resetAt,
        message: "Trop de requêtes — réessayez dans quelques minutes",
      })
    }

    const body = await request.json()
    const { email } = body

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return apiError(400, "Email invalide")
    }

    const existing = await prisma.newsletterSubscriber.findUnique({ where: { email } })

    if (existing) {
      if (existing.status === "unsubscribed") {
        await prisma.newsletterSubscriber.update({
          where: { email },
          data: { status: "active" },
        })
        return apiOk({ message: "Réabonnement confirmé" })
      }
      return apiOk({ message: "Déjà inscrit" })
    }

    const subscriber = await prisma.newsletterSubscriber.create({
      data: { email, source: "actualites" },
    })

    return apiOk(subscriber, { status: 201 })
  } catch (error) {
    console.error("Error subscribing to newsletter:", error)
    return apiError(500, "Failed to subscribe")
  }
}

export async function PATCH(request: NextRequest) {
  const authCheck = await requireAdminAuth()
  if (!authCheck.isAuthorized) return authCheck.error

  try {
    const body = await request.json()
    const { id, status } = body

    if (!id || !["active", "unsubscribed"].includes(status)) {
      return apiError(400, "Paramètres invalides")
    }

    const updated = await prisma.newsletterSubscriber.update({
      where: { id },
      data: { status },
    })

    return apiOk(updated)
  } catch (error) {
    console.error("Error updating subscriber:", error)
    return apiError(500, "Failed to update subscriber")
  }
}

export async function DELETE(request: NextRequest) {
  const authCheck = await requireAdminAuth()
  if (!authCheck.isAuthorized) return authCheck.error

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return apiError(400, "ID requis")
    }

    await prisma.newsletterSubscriber.delete({ where: { id } })
    return apiOk({ success: true })
  } catch (error) {
    console.error("Error deleting subscriber:", error)
    return apiError(500, "Failed to delete subscriber")
  }
}
