import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma, withDbRetry } from "@/lib/prisma"
import { requireAdminAuth } from "@/lib/auth-check"
import { logActivity } from "@/lib/activity-logger"

// Bulk-action schema kept local: it describes the batch *operation*, not block
// content, so it stays out of lib/page-builder/validation.ts (block schemas).
const BulkActionSchema = z.object({
  ids: z.array(z.string().min(1).max(64)).min(1).max(200),
  action: z.enum(["publish", "unpublish", "delete"]),
})

export async function PATCH(req: NextRequest) {
  const authCheck = await requireAdminAuth()
  if (!authCheck.isAuthorized) return authCheck.error

  try {
    const body = await req.json()
    const { ids, action } = BulkActionSchema.parse(body)

    const actor = authCheck.user.email || authCheck.user.name || "Admin"

    // Resolve the slugs we touch up-front so we can revalidate their public
    // routes afterwards (mirrors the per-item routes' cache invalidation).
    const affected = await withDbRetry(() =>
      prisma.page.findMany({
        where: { id: { in: ids }, deletedAt: null },
        select: { id: true, slug: true },
      })
    )
    const slugs = affected.map((p) => p.slug).filter(Boolean) as string[]

    if (action === "delete") {
      const [updated] = await withDbRetry(() =>
        prisma.$transaction([
          prisma.page.updateMany({
            where: { id: { in: ids }, deletedAt: null },
            data: { deletedAt: new Date() },
          }),
          // Drop file references owned by these pages so deleted pages don't keep
          // their attached assets pinned (same rationale as DELETE /api/pages/[id]).
          prisma.fileUsage.deleteMany({ where: { pageId: { in: ids } } }),
        ])
      )

      const count = updated.count
      await logActivity(
        actor,
        "deleted_bulk",
        "page",
        `${count} page${count > 1 ? "s" : ""}`,
        undefined,
        `${count} page${count > 1 ? "s" : ""} supprimée${count > 1 ? "s" : ""} en masse`
      )

      for (const slug of slugs) revalidatePath(`/${slug}`)
      revalidatePath("/[slug]", "page")

      return NextResponse.json({ deleted: count })
    }

    const status = action === "publish" ? "published" : "draft"
    const updated = await withDbRetry(() =>
      prisma.page.updateMany({
        where: { id: { in: ids }, deletedAt: null },
        data: { status },
      })
    )

    const count = updated.count
    await logActivity(
      actor,
      action === "publish" ? "published_bulk" : "unpublished_bulk",
      "page",
      `${count} page${count > 1 ? "s" : ""}`,
      undefined,
      action === "publish"
        ? `${count} page${count > 1 ? "s" : ""} publiée${count > 1 ? "s" : ""} en masse`
        : `${count} page${count > 1 ? "s" : ""} dépubliée${count > 1 ? "s" : ""} en masse`
    )

    for (const slug of slugs) revalidatePath(`/${slug}`)
    revalidatePath("/[slug]", "page")

    return NextResponse.json({ updated: count })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("PATCH /api/pages/bulk error:", errorMessage)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to process bulk action" }, { status: 500 })
  }
}
