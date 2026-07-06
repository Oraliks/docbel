import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth-check";
import { listReports } from "@/lib/reports/engine";

const json = { "Content-Type": "application/json; charset=utf-8" };

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const sp = req.nextUrl.searchParams;
  const items = await listReports({
    type: sp.get("type") ?? undefined,
    status: sp.get("status") ?? "pending",
    limit: Number(sp.get("limit")) || 50,
  });

  return NextResponse.json({ items, total: items.length }, { headers: json });
}
