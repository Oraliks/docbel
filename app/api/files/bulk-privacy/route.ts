import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { isLocalStoredPath, moveStoredFile } from "@/lib/file-storage";
import { isBlobsPath, moveBlob } from "@/lib/storage/blob-storage";

// Toggle privacy for a flat selection of file/folder ids. For folders, the
// recursive descent is left to the existing /bulk-update endpoint — this route
// only handles the directly-selected items.
export async function PATCH(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  try {
    const body = await req.json();
    const ids: unknown = body?.ids;
    const isPrivate: unknown = body?.isPrivate;
    if (!Array.isArray(ids) || ids.length === 0 || typeof isPrivate !== "boolean") {
      return NextResponse.json(
        { error: "ids[] and isPrivate are required" },
        { status: 400 }
      );
    }
    const cleanIds = ids.filter((v): v is string => typeof v === "string");

    const items = await prisma.file.findMany({
      where: { id: { in: cleanIds } },
      select: { id: true, type: true, filePath: true, isPrivate: true },
    });

    type Move = { id: string; newPath: string };
    const moves: Move[] = [];
    for (const item of items) {
      if (item.isPrivate === isPrivate) continue;
      if (item.type !== "file" || !item.filePath) continue;
      try {
        let newPath = item.filePath;
        if (isBlobsPath(item.filePath)) {
          newPath = await moveBlob(item.filePath, isPrivate);
        } else if (isLocalStoredPath(item.filePath)) {
          newPath = await moveStoredFile(item.filePath, isPrivate);
        }
        if (newPath !== item.filePath) {
          moves.push({ id: item.id, newPath });
        }
      } catch (error) {
        console.error("bulk-privacy: failed to move", item.id, error);
        return NextResponse.json(
          { error: "Failed to move some files" },
          { status: 500 }
        );
      }
    }

    const result = await prisma.$transaction([
      prisma.file.updateMany({
        where: { id: { in: cleanIds } },
        data: { isPrivate },
      }),
      ...moves.map((m) =>
        prisma.file.update({ where: { id: m.id }, data: { filePath: m.newPath } })
      ),
    ]);

    return NextResponse.json({
      success: true,
      updated: result[0].count,
      moved: moves.length,
    });
  } catch (error) {
    console.error("PATCH /api/files/bulk-privacy error:", error);
    return NextResponse.json(
      { error: "Failed to bulk-update privacy" },
      { status: 500 }
    );
  }
}
