import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";

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

    let frontier: string[] = [parentId];
    let totalUpdated = 0;
    const seen = new Set<string>([parentId]);

    while (frontier.length > 0) {
      const result = await prisma.file.updateMany({
        where: { parentId: { in: frontier } },
        data: { isPrivate },
      });
      totalUpdated += result.count;

      const childFolders = await prisma.file.findMany({
        where: { parentId: { in: frontier }, type: "folder" },
        select: { id: true },
      });

      frontier = childFolders
        .map((f) => f.id)
        .filter((id) => {
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        });
    }

    return NextResponse.json({ success: true, updated: totalUpdated });
  } catch (error) {
    console.error("PATCH /api/files/bulk-update error:", error);
    return NextResponse.json(
      { error: "Failed to update files" },
      { status: 500 }
    );
  }
}
