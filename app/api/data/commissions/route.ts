import { NextResponse } from "next/server";
import { prisma, withDbRetry } from "@/lib/prisma";
import { serializeCommission } from "@/lib/commissions";
import { getSetting, SETTING_KEYS } from "@/lib/app-settings";

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
};

export const revalidate = 300;

export async function GET() {
  try {
    const [items, lastUpdated] = await Promise.all([
      withDbRetry(() =>
        prisma.commissionParitaire.findMany({
          orderBy: [{ code: "asc" }],
        })
      ),
      getSetting(SETTING_KEYS.COMMISSIONS_LAST_UPDATED),
    ]);

    return NextResponse.json(
      {
        count: items.length,
        lastUpdated,
        items: items.map(serializeCommission),
      },
      { headers: jsonHeaders }
    );
  } catch (error) {
    console.error("Error fetching commissions data:", error);
    return NextResponse.json(
      { error: "Failed to fetch commissions" },
      { status: 500 }
    );
  }
}
