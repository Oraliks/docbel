import { NextRequest, NextResponse } from "next/server"
import { COMMISSIONS_PARITAIRES } from "@/lib/docbel-data"

// Simple API key validation (without database for now)
const VALID_API_KEYS = new Set([
  "api_792cfd4f6905bc06d6ef47821476e6fcba1639697bd2482644399eeb913e36db"
])

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Missing or invalid Authorization header" },
        { status: 401 }
      )
    }

    const key = authHeader.slice(7)
    if (!VALID_API_KEYS.has(key)) {
      return NextResponse.json(
        { success: false, error: "Invalid or inactive API key" },
        { status: 401 }
      )
    }

    const q = req.nextUrl.searchParams.get("q")
    const code = req.nextUrl.searchParams.get("code")

    let filtered = COMMISSIONS_PARITAIRES

    if (code) {
      filtered = filtered.filter(c => c.code === parseInt(code))
    } else if (q) {
      filtered = filtered.filter(c =>
        c.label.toLowerCase().includes(q.toLowerCase())
      )
    }

    return NextResponse.json({
      success: true,
      data: filtered,
      count: filtered.length
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 401 }
    )
  }
}
