import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { isLocalStoredPath, moveStoredFile } from "@/lib/file-storage";
import { isBlobsPath, moveBlob } from "@/lib/storage/blob-storage";

export async function PATCH(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  try {
    const body = await req.json();
    const { parentId, isPrivate } = body;

    if (parentId === undefined || isPrivate === undefined) {
      return NextResponse.json(
        { error: "Missing parentId or isPrivate" },
        { status: 400 }
      );
    }

    // Walk the subtree once with a BFS to collect every descendant id, then
    // update flags + physical asset locations together.
    const descendants: { id: string; type: string; filePath: string | null; isPrivate: boolean }[] = [];
    let frontier: string[] = [parentId];
    const seen = new Set<string>([parentId]);

    while (frontier.length > 0) {
      const children = await prisma.file.findMany({
        where: { parentId: { in: frontier } },
        select: { id: true, type: true, filePath: true, isPrivate: true },
      });
      for (const c of children) {
        descendants.push(c);
      }
      frontier = children
        .filter((c) => c.type === "folder")
        .map((c) => c.id)
        .filter((id) => {
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        });
    }

    // Move physical files first; if anything fails we abort before mutating DB.
    type Move = { id: string; oldPath: string; newPath: string };
    const moves: Move[] = [];
    for (const node of descendants) {
      if (node.type !== "file" || !node.filePath) continue;
      if (node.isPrivate === isPrivate) continue;
      try {
        let newPath = node.filePath;
        if (isBlobsPath(node.filePath)) {
          newPath = await moveBlob(node.filePath, isPrivate);
        } else if (isLocalStoredPath(node.filePath)) {
          newPath = await moveStoredFile(node.filePath, isPrivate);
        }
        if (newPath !== node.filePath) {
          moves.push({ id: node.id, oldPath: node.filePath, newPath });
        }
      } catch (error) {
        console.error("bulk-update: failed to move file", node.id, error);
        return NextResponse.json(
          { error: "Failed to move some files" },
          { status: 500 }
        );
      }
    }

    const allIds = descendants.map((d) => d.id);

    const result = await prisma.$transaction([
      prisma.file.updateMany({
        where: { id: { in: allIds } },
        data: { isPrivate },
      }),
      ...moves.map((m) =>
        prisma.file.update({
          where: { id: m.id },
          data: { filePath: m.newPath },
        })
      ),
    ]);

    return NextResponse.json({
      success: true,
      updated: result[0].count,
      moved: moves.length,
    });
  } catch (error) {
    console.error("PATCH /api/files/bulk-update error:", error);
    return NextResponse.json(
      { error: "Failed to update files" },
      { status: 500 }
    );
  }
}
