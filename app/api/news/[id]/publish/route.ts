import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-logger"
import { requireAdminAuth } from "@/lib/auth-check"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdminAuth()
  if (!authCheck.isAuthorized) return authCheck.error

  try {
    const { id } = await params
    const article = await prisma.news.update({
      where: { id },
      data: {
        status: "published",
        publishedAt: new Date(),
        scheduledAt: null,
      },
    })

    await logActivity("Admin", "published", "news", article.title, article.id, `Article publie: ${article.title}`)

    return NextResponse.json(article, {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    })
  } catch (error) {
    console.error("Error publishing article:", error)
    return NextResponse.json({ error: "Failed to publish article" }, { status: 500 })
  }
}
