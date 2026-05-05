import { NextRequest, NextResponse } from "next/server"
import { COMMISSIONS_PARITAIRES } from "@/lib/docbel-data"
import { verifyApiKey } from "@/lib/api-auth"

export async function GET(req: NextRequest) {
  try {
    await verifyApiKey(req.headers.get("authorization"))

    const q = req.nextUrl.searchParams.get("q")
    const code = req.nextUrl.searchParams.get("code")

    let filtered = COMMISSIONS_PARITAIRES

    if (code) {
      filtered = filtered.filter((commission) => commission.code === parseInt(code, 10))
    } else if (q) {
      filtered = filtered.filter((commission) =>
        commission.label.toLowerCase().includes(q.toLowerCase())
      )
    }

    return NextResponse.json({
      success: true,
      data: filtered,
      count: filtered.length,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Invalid or inactive API key",
      },
      { status: 401 }
    )
  }
}
