import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"

// Mock in-memory API keys store (replace with database later)
interface ApiKeyRecord {
  id: string
  key: string
  name: string
  active: boolean
  lastUsedAt: string | null
  createdAt: string
  createdBy: string
}

const mockApiKeys: Map<string, ApiKeyRecord> = new Map([
  ["api_792cfd4f6905bc06d6ef47821476e6fcba1639697bd2482644399eeb913e36db", {
    id: "test-key-1",
    key: "api_792cfd4f6905bc06d6ef47821476e6fcba1639697bd2482644399eeb913e36db",
    name: "Test Key",
    active: true,
    lastUsedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    createdBy: "test-user"
  }]
])

// Simple session validation (in production, use proper NextAuth)
function checkAuth(req: NextRequest): boolean {
  // Check if user has admin session via cookie or header
  // For now, accept any authenticated request
  const authCookie = req.headers.get("cookie")?.includes("next-auth.session-token")
  return authCookie ? true : false
}

export async function GET(req: NextRequest) {
  try {
    // Simple auth check - in production use proper NextAuth
    const authCookie = req.headers.get("cookie")
    if (!authCookie?.includes("next-auth.session-token")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized - please login first" },
        { status: 401 }
      )
    }

    const apiKeys = Array.from(mockApiKeys.values()).map(key => ({
      id: key.id,
      key: key.key,
      name: key.name,
      active: key.active,
      lastUsedAt: key.lastUsedAt,
      createdAt: key.createdAt
    }))

    return NextResponse.json({
      success: true,
      data: apiKeys
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
  try {
    // Simple auth check
    const authCookie = req.headers.get("cookie")
    if (!authCookie?.includes("next-auth.session-token")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized - please login first" },
        { status: 401 }
      )
    }

    const { name } = await req.json()
    if (!name || typeof name !== "string" || name.length === 0) {
      return NextResponse.json(
        { success: false, error: "API key name is required" },
        { status: 400 }
      )
    }

    const apiKey = `api_${randomBytes(32).toString("hex")}`
    const newKey: ApiKeyRecord = {
      id: randomBytes(16).toString("hex"),
      key: apiKey,
      name,
      active: true,
      lastUsedAt: null,
      createdAt: new Date().toISOString(),
      createdBy: "current-user"
    }

    mockApiKeys.set(apiKey, newKey)

    return NextResponse.json(
      {
        success: true,
        data: {
          id: newKey.id,
          key: newKey.key,
          name: newKey.name,
          createdAt: newKey.createdAt
        }
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
