import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminAuth } from "@/lib/auth-check"

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdminAuth()
  if (!authCheck.isAuthorized) return authCheck.error

  try {
    const { id } = await params
    const apiKey = await prisma.apiKey.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "API key not found" },
        { status: 404 }
      )
    }

    await prisma.apiKey.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: "API key deleted",
    })
  } catch (error) {
    console.error("DELETE /api/admin/api-keys/[id] error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
