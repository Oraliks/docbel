import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-logger"
import { requireAdminAuth } from "@/lib/auth-check"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdminAuth()
  if (!authCheck.isAuthorized) return authCheck.error

  try {
    const { id } = await params
    const body = await req.json()
    const name = typeof body.name === "string" ? body.name.trim() : body.name
    const color = typeof body.color === "string" ? body.color.trim() : body.color
    const illustrationUrl =
      "illustrationUrl" in body
        ? typeof body.illustrationUrl === "string" && body.illustrationUrl.trim()
          ? body.illustrationUrl.trim()
          : null
        : undefined

    const category = await prisma.category.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(color !== undefined && { color }),
        ...(illustrationUrl !== undefined && { illustrationUrl }),
      },
    })

    await logActivity("Admin", "updated", "category", category.name, category.id, `Categorie mise a jour: ${category.name}`)

    return NextResponse.json(category, {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    })
  } catch (error) {
    console.error("Error updating category:", error)
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Cette categorie existe deja" }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdminAuth()
  if (!authCheck.isAuthorized) return authCheck.error

  try {
    const { id } = await params
    const category = await prisma.category.findUnique({
      where: { id },
    })

    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 })
    }

    await prisma.category.delete({
      where: { id },
    })

    await logActivity("Admin", "deleted", "category", category.name, category.id, `Categorie supprimee: ${category.name}`)

    return NextResponse.json(
      { success: true },
      { headers: { "Content-Type": "application/json; charset=utf-8" } }
    )
  } catch (error) {
    console.error("Error deleting category:", error)
    return NextResponse.json({ error: "Failed to delete category" }, { status: 500 })
  }
}
