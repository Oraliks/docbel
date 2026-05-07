import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  try {
    const { searchParams } = new URL(req.url);
    const all = searchParams.get("all") === "true";
    const parentId = searchParams.get("parentId") || null;
    const typeParam = searchParams.get("type");
    const isPrivateParam = searchParams.get("isPrivate");
    const q = searchParams.get("q")?.trim() ?? "";

    const where: Prisma.FileWhereInput = {};

    if (q.length >= 2) {
      where.name = { contains: q, mode: "insensitive" };
    } else if (!all) {
      where.parentId = parentId;
    }

    if (typeParam === "file" || typeParam === "folder") where.type = typeParam;
    if (isPrivateParam === "true") where.isPrivate = true;
    else if (isPrivateParam === "false") where.isPrivate = false;

    const files = await prisma.file.findMany({
      where,
      include: { children: { select: { id: true } }, usage: true },
      orderBy: [{ type: "desc" }, { name: "asc" }],
      take: q.length >= 2 ? 200 : undefined,
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
