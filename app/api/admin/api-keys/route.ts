import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"
import { requireAdminAuth } from "@/lib/auth-check"

function maskApiKey(key: string) {
  if (key.length <= 12) return key
  return `${key.slice(0, 8)}...${key.slice(-4)}`
}

export async function GET() {
  const authCheck = await requireAdminAuth()
  if (!authCheck.isAuthorized) return authCheck.error

  try {
    const apiKeys = await prisma.apiKey.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        key: true,
        name: true,
        active: true,
        lastUsedAt: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: apiKeys.map((apiKey) => ({
        id: apiKey.id,
        name: apiKey.name,
        active: apiKey.active,
        lastUsedAt: apiKey.lastUsedAt,
        createdAt: apiKey.createdAt,
        keyPreview: maskApiKey(apiKey.key),
      })),
    })
  } catch (error) {
    console.error("GET /api/admin/api-keys error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  const authCheck = await requireAdminAuth()
  if (!authCheck.isAuthorized) return authCheck.error

  try {
    const { name } = await req.json()

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "API key name is required" },
        { status: 400 }
      )
    }

    if (!authCheck.user?.id) {
      return NextResponse.json(
        { success: false, error: "Authenticated user id is missing" },
        { status: 500 }
      )
    }

    const key = `api_${randomBytes(32).toString("hex")}`
    const newKey = await prisma.apiKey.create({
      data: {
        key,
        name: name.trim(),
        createdBy: authCheck.user.id,
      },
      select: {
        id: true,
        key: true,
        name: true,
        createdAt: true,
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: newKey,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("POST /api/admin/api-keys error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
