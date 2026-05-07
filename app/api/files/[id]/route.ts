import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { resolveStoredFilePath } from "@/lib/file-storage";
import { isBlobsPath, deleteBlob } from "@/lib/documents/blob-storage";
import { unlink } from "fs/promises";
import { existsSync } from "fs";

async function isDescendantOf(
  candidateId: string,
  ancestorId: string
): Promise<boolean> {
  let cursor: string | null = candidateId;
  const seen = new Set<string>();
  while (cursor) {
    if (seen.has(cursor)) return false;
    seen.add(cursor);
    if (cursor === ancestorId) return true;
    const parent: { parentId: string | null } | null =
      await prisma.file.findUnique({
        where: { id: cursor },
        select: { parentId: true },
      });
    cursor = parent?.parentId ?? null;
  }
  return false;
}

async function deleteStoredContent(filePath: string | null) {
  if (!filePath) return;
  if (isBlobsPath(filePath)) {
    try {
      await deleteBlob(filePath);
    } catch (error) {
      console.error("Error deleting blob:", error);
    }
    return;
  }
  const fullPath = resolveStoredFilePath(filePath);
  if (!fullPath) return;
  try {
    if (existsSync(fullPath)) await unlink(fullPath);
  } catch (error) {
    console.error("Error deleting file from disk:", error);
  }
}

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

      if (file.type === "folder" && parentId) {
        const targetExists = await prisma.file.findUnique({
          where: { id: parentId },
          select: { id: true },
        });
        if (!targetExists) {
          return NextResponse.json(
            { error: "Target folder not found" },
            { status: 404 }
          );
        }
        if (await isDescendantOf(parentId, id)) {
          return NextResponse.json(
            { error: "Cannot move folder into its own descendant" },
            { status: 400 }
          );
        }
      }

      const existingFiles = await prisma.file.findMany({
        where: { parentId },
        select: { name: true },
      });

      const existingNames = new Set(existingFiles.map((f) => f.name));
      let finalName = file.name;

      if (existingNames.has(file.name)) {
        const lastDotIndex = file.name.lastIndexOf(".");
        const nameWithoutExt =
          lastDotIndex > 0 ? file.name.substring(0, lastDotIndex) : file.name;
        const ext = lastDotIndex > 0 ? file.name.substring(lastDotIndex) : "";

        let counter = 1;
        while (existingNames.has(`${nameWithoutExt} (${counter})${ext}`)) {
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

    const file = await prisma.file.update({
      where: { id },
      data: updateData,
    });

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
      include: { usage: true, children: { select: { id: true } } },
    });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

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

    if (file.type === "folder" && file.children.length > 0) {
      return NextResponse.json(
        {
          error: "Folder is not empty",
          message: "Le dossier doit être vide avant suppression",
        },
        { status: 409 }
      );
    }

    if (file.type === "file") {
      await deleteStoredContent(file.filePath);
    }

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
