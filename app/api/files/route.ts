import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

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
    const includeUsage = searchParams.get("withUsage") === "true";

    const limitRaw = Number(searchParams.get("limit"));
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(limitRaw, MAX_LIMIT)
        : DEFAULT_LIMIT;
    const cursor = searchParams.get("cursor") || undefined;

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
      include: {
        children: { select: { id: true } },
        ...(includeUsage ? { usage: true } : {}),
      },
      orderBy: [{ type: "desc" }, { name: "asc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = files.length > limit;
    const page = hasMore ? files.slice(0, limit) : files;
    const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;

    // Backward-compat: when no pagination params are given, return a bare array
    // (callers built before pagination existed still work).
    if (!searchParams.has("limit") && !cursor) {
      return NextResponse.json(page);
    }

    return NextResponse.json({ items: page, nextCursor, hasMore });
  } catch (error) {
    console.error("GET /api/files error:", error);
    return NextResponse.json(
      { error: "Failed to fetch files" },
      { status: 500 }
    );
  }
}
