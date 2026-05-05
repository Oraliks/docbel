import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { resolveStoredFilePath } from "@/lib/file-storage";
import { unlink } from "fs/promises";
import { existsSync } from "fs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  try {
    const { id } = await params;
    const body = await req.json();
    const { name, isPrivate, parentId } = body;

    const updateData: { name?: string; isPrivate?: boolean; parentId?: string | null } = {};
    if (name) updateData.name = name;
    if (isPrivate !== undefined) updateData.isPrivate = isPrivate;

    if (parentId !== undefined) {
      const file = await prisma.file.findUnique({
        where: { id },
      });

      if (!file) {
        return NextResponse.json(
          { error: "File not found" },
          { status: 404 }
        );
      }

      if (parentId === id) {
        return NextResponse.json(
          { error: "Cannot move file to itself" },
          { status: 400 }
        );
      }

      if (file.type === "folder") {
        const targetParent = await prisma.file.findUnique({
          where: { id: parentId },
        });

        if (targetParent && targetParent.parentId === id) {
          return NextResponse.json(
            { error: "Cannot move folder into its own children" },
            { status: 400 }
          );
        }
      }

      const existingFiles = await prisma.file.findMany({
        where: { parentId },
      });

      const existingNames = existingFiles.map(f => f.name);
      let finalName = file.name;

      if (existingNames.includes(file.name)) {
        const lastDotIndex = file.name.lastIndexOf(".");
        let nameWithoutExt: string;
        let ext: string;

        if (lastDotIndex > 0) {
          nameWithoutExt = file.name.substring(0, lastDotIndex);
          ext = file.name.substring(lastDotIndex);
        } else {
          nameWithoutExt = file.name;
          ext = "";
        }

        let counter = 1;
        while (existingNames.includes(`${nameWithoutExt} (${counter})${ext}`)) {
          counter++;
        }
        finalName = `${nameWithoutExt} (${counter})${ext}`;
      }

      updateData.parentId = parentId;
      if (finalName !== file.name) {
        updateData.name = finalName;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "Nothing to update" },
        { status: 400 }
      );
    }

    console.log("Updating file:", id, "with data:", updateData);

    const file = await prisma.file.update({
      where: { id },
      data: updateData,
    });

    console.log("File updated successfully:", file);

    return NextResponse.json(file);
  } catch (error) {
    console.error("PATCH /api/files/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update file", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  try {
    const { id } = await params;
    const file = await prisma.file.findUnique({
      where: { id },
      include: { usage: true, children: true },
    });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Vérifier si le fichier est utilisé
    if (file.usage.length > 0) {
      return NextResponse.json(
        {
          error: "File is in use",
          message: `Ce fichier est utilisé sur ${file.usage.length} page(s)`,
          usage: file.usage,
        },
        { status: 409 }
      );
    }

    // Si c'est un dossier avec des enfants, empêcher la suppression
    if (file.type === "folder" && file.children.length > 0) {
      return NextResponse.json(
        { error: "Folder is not empty" },
        { status: 409 }
      );
    }

    // Supprimer le fichier du disque si c'est un fichier
    if (file.type === "file" && file.filePath) {
      const fullPath = resolveStoredFilePath(file.filePath);
      try {
        if (fullPath && existsSync(fullPath)) {
          await unlink(fullPath);
        }
      } catch (fsError) {
        console.error("Error deleting file from disk:", fsError);
      }
    }

    // Supprimer de la DB
    await prisma.file.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/files/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
}
