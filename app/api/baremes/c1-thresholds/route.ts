import { NextResponse } from "next/server";
import { getActiveBaremeData } from "@/lib/baremes/getActiveBaremeData";
import { getC1BaremeThresholds, formatC1BaremeSource } from "@/lib/baremes/c1-thresholds";

export async function GET() {
  const data = await getActiveBaremeData();
  const thresholds = getC1BaremeThresholds(data);
  return NextResponse.json(
    { ...thresholds, sourceLabel: formatC1BaremeSource(thresholds) },
    { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=600" } },
  );
}
