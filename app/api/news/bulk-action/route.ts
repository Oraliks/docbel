import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logActivity, type ActivityAction } from "@/lib/activity-logger"
import { requireAdminAuth } from "@/lib/auth-check"

export async function POST(req: NextRequest) {
  const authCheck = await requireAdminAuth()
  if (!authCheck.isAuthorized) return authCheck.error

  try {
    const body = await req.json()
    const { action, ids } = body

    if (!action || !ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "action and ids array are required" },
        { status: 400 }
      )
    }

    let updateData: Record<string, unknown> = {}
    let activityAction: ActivityAction = "updated"
    let activityDetails = `${ids.length} articles`

    switch (action) {
      case "publish":
        updateData = { status: "published", publishedAt: new Date() }
        activityAction = "published"
        activityDetails = `${ids.length} articles publies`
        break
      case "unpublish":
        updateData = { status: "draft", publishedAt: null, scheduledAt: null }
        activityAction = "unpublished"
        activityDetails = `${ids.length} articles depublies`
        break
      case "archive":
        updateData = { status: "archived" }
        activityDetails = `${ids.length} articles archives`
        break
      case "delete":
        await prisma.news.deleteMany({
          where: { id: { in: ids } },
        })

        await logActivity("Admin", "deleted", "news", `${ids.length} articles`, "", `${ids.length} articles supprimes`)

        return NextResponse.json(
          { success: true, count: ids.length },
          { headers: { "Content-Type": "application/json; charset=utf-8" } }
        )
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    const result = await prisma.news.updateMany({
      where: { id: { in: ids } },
      data: updateData,
    })

    await logActivity("Admin", activityAction, "news", `${result.count} articles`, "", activityDetails)

    return NextResponse.json(
      { success: true, count: result.count },
      { headers: { "Content-Type": "application/json; charset=utf-8" } }
    )
  } catch (error) {
    console.error("Error performing bulk action:", error)
    return NextResponse.json(
      { error: "Failed to perform bulk action" },
      { status: 500 }
    )
  }
}
