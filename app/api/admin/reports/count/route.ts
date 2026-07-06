import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";

const json = { "Content-Type": "application/json; charset=utf-8" };

/// Alimente le badge sidebar (Task 11). Défaut : compte les "pending".
export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const status = req.nextUrl.searchParams.get("status") ?? "pending";
  const count = await prisma.report.count({ where: { status } });

  return NextResponse.json({ count }, { headers: json });
}
