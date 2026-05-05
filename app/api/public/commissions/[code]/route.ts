import { NextRequest, NextResponse } from "next/server"
import { COMMISSIONS_PARITAIRES } from "@/lib/docbel-data"
import { verifyApiKey } from "@/lib/api-auth"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    await verifyApiKey(req.headers.get("authorization"))

    const { code: codeParam } = await params
    const code = parseInt(codeParam, 10)

    if (isNaN(code)) {
      return NextResponse.json(
        { success: false, error: "Invalid commission code" },
        { status: 400 }
      )
    }

    const commission = COMMISSIONS_PARITAIRES.find((item) => item.code === code)
    if (!commission) {
      return NextResponse.json(
        { success: false, error: "Commission not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: commission,
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
