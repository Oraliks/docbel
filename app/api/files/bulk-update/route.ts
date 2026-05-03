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

    // Récursivement mettre à jour tous les enfants
    async function updateChildren(folderId: string, newIsPrivate: boolean) {
      const children = await prisma.file.findMany({
        where: { parentId: folderId },
      });

      for (const child of children) {
        await prisma.file.update({
          where: { id: child.id },
          data: { isPrivate: newIsPrivate },
        });

        // Si c'est un dossier, mettre à jour ses enfants aussi
        if (child.type === "folder") {
          await updateChildren(child.id, newIsPrivate);
        }
      }
    }

    await updateChildren(parentId, isPrivate);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/files/bulk-update error:", error);
    return NextResponse.json(
      { error: "Failed to update files" },
      { status: 500 }
    );
  }
}
