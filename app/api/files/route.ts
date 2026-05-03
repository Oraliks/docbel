import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  try {
    const { searchParams } = new URL(req.url);
    const parentId = searchParams.get("parentId") || null;

    const files = await prisma.file.findMany({
      where: { parentId },
      include: { children: true, usage: true },
      orderBy: [{ type: "desc" }, { name: "asc" }],
    });

    return NextResponse.json(files);
  } catch (error) {
    console.error("GET /api/files error:", error);
    return NextResponse.json(
      { error: "Failed to fetch files" },
      { status: 500 }
    );
  }
}
