import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireAdminAuth } from "@/lib/auth-check"
import { logActivity } from "@/lib/activity-logger"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdminAuth()
  if (!authCheck.isAuthorized) return authCheck.error

  try {
    const { id } = await params
    const page = await prisma.page.findFirst({
      where: { id, deletedAt: null },
    })

    if (!page) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 })
    }

    const newStatus = page.status === "published" ? "draft" : "published"

    const updated = await prisma.page.update({
      where: { id },
      data: { status: newStatus },
    })

    const actor = authCheck.user.email || authCheck.user.name || 'Admin'
    await logActivity(
      actor,
      newStatus === 'published' ? 'published' : 'unpublished',
      'page',
      updated.title,
      updated.id,
      `Page ${newStatus === 'published' ? 'publiée' : 'remise en brouillon'}`
    )

    if (updated.slug) revalidatePath(`/${updated.slug}`)
    revalidatePath('/[slug]', 'page')

    return NextResponse.json({ ...updated, blocks: updated.content })
  } catch (error) {
    console.error("POST /api/pages/[id]/publish error:", error)
    return NextResponse.json(
      { error: "Failed to toggle publish status" },
      { status: 500 }
    )
  }
}
