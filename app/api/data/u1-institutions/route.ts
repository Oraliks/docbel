import { NextResponse } from "next/server";
import { prisma, withDbRetry } from "@/lib/prisma";
import { serializeU1 } from "@/lib/u1-institutions";
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
        prisma.u1Institution.findMany({ orderBy: [{ country: "asc" }] })
      ),
      getSetting(SETTING_KEYS.U1_INSTITUTIONS_LAST_UPDATED),
    ]);

    return NextResponse.json(
      {
        count: items.length,
        lastUpdated,
        items: items.map(serializeU1),
      },
      { headers: jsonHeaders }
    );
  } catch (error) {
    console.error("Error fetching U1 institutions:", error);
    return NextResponse.json(
      { error: "Failed to fetch U1 institutions" },
      { status: 500 }
    );
  }
}
