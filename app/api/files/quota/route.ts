import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";

const DEFAULT_USER_QUOTA_BYTES = 5 * 1024 * 1024 * 1024;

function getUserQuotaBytes(): number {
  const fromEnv = process.env.MAX_USER_STORAGE_BYTES;
  if (!fromEnv) return DEFAULT_USER_QUOTA_BYTES;
  const parsed = Number(fromEnv);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_USER_QUOTA_BYTES;
}

export async function GET() {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  try {
    const usage = await prisma.file.aggregate({
      where: { createdBy: auth.user.id, type: "file" },
      _sum: { size: true },
    });
    return NextResponse.json({
      used: usage._sum.size ?? 0,
      quota: getUserQuotaBytes(),
    });
  } catch (error) {
    console.error("GET /api/files/quota error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
