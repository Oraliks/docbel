import { NextRequest, NextResponse } from "next/server"
import { COMMISSIONS_PARITAIRES } from "@/lib/docbel-data"

const VALID_API_KEYS = new Set([
  "api_792cfd4f6905bc06d6ef47821476e6fcba1639697bd2482644399eeb913e36db"
])

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
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

    const { code: codeStr } = await params
    const code = parseInt(codeStr)
    if (isNaN(code)) {
      return NextResponse.json(
        { success: false, error: "Invalid commission code" },
        { status: 400 }
      )
    }

    const commission = COMMISSIONS_PARITAIRES.find(c => c.code === code)
    if (!commission) {
      return NextResponse.json(
        { success: false, error: "Commission not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: commission
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 401 }
    )
  }
}
