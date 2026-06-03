import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth-check";
import { getNewsStats } from "@/lib/news/stats";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

export async function GET() {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  try {
    const payload = await getNewsStats();
    return NextResponse.json(payload, { headers: jsonHeaders });
  } catch (error) {
    console.error("Error fetching news stats:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500, headers: jsonHeaders });
  }
}
