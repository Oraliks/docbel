import { NextRequest, NextResponse } from "next/server"
import { prisma, withDbRetry } from "@/lib/prisma"
import { verifyApiKey } from "@/lib/api-auth"
import { serializeCommission } from "@/lib/commissions"

export async function GET(req: NextRequest) {
  try {
    await verifyApiKey(req.headers.get("authorization"))

    const q = req.nextUrl.searchParams.get("q")
    const code = req.nextUrl.searchParams.get("code")

    const items = await withDbRetry(() =>
      prisma.commissionParitaire.findMany({
        where: code
          ? { code }
          : q
          ? {
              OR: [
                { code: { contains: q, mode: "insensitive" } },
                { numero: { contains: q, mode: "insensitive" } },
                { nom: { contains: q, mode: "insensitive" } },
                { searchText: { contains: q.toLowerCase() } },
              ],
            }
          : undefined,
        orderBy: [{ code: "asc" }],
      })
    )

    return NextResponse.json({
      success: true,
      data: items.map(serializeCommission),
      count: items.length,
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
