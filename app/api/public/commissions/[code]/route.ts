import { NextRequest, NextResponse } from "next/server"
import { prisma, withDbRetry } from "@/lib/prisma"
import { verifyApiKey } from "@/lib/api-auth"
import { serializeCommission } from "@/lib/commissions"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    await verifyApiKey(req.headers.get("authorization"))

    const { code } = await params
    if (!/^\d{1,7}$/.test(code)) {
      return NextResponse.json(
        { success: false, error: "Invalid commission code" },
        { status: 400 }
      )
    }

    const commission = await withDbRetry(() =>
      prisma.commissionParitaire.findUnique({ where: { code } })
    )
    if (!commission) {
      return NextResponse.json(
        { success: false, error: "Commission not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: serializeCommission(commission),
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
