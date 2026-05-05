import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminAuth } from "@/lib/auth-check"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdminAuth()
  if (!authCheck.isAuthorized) return authCheck.error

  try {
    const { id } = await params
    const page = await prisma.page.findUnique({
      where: { id },
    })

    if (!page) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 })
    }

    const newStatus = page.status === "published" ? "draft" : "published"

    const updated = await prisma.page.update({
      where: { id },
      data: { status: newStatus },
    })

    return NextResponse.json({
      ...updated,
      blocks: JSON.parse(updated.content),
    })
  } catch (error) {
    console.error("POST /api/pages/[id]/publish error:", error)
    return NextResponse.json(
      { error: "Failed to toggle publish status" },
      { status: 500 }
    )
  }
}
