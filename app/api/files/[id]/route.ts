import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import {
  isLocalStoredPath,
  moveStoredFile,
  resolveStoredFilePath,
} from "@/lib/file-storage";
import {
  isBlobsPath,
  deleteBlob,
  moveBlob,
} from "@/lib/documents/blob-storage";
import { unlink } from "fs/promises";
import { existsSync } from "fs";

const MAX_FOLDER_DEPTH = 16;

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

async function getDepth(folderId: string | null): Promise<number> {
  if (!folderId) return 0;
  let cursor: string | null = folderId;
  let depth = 0;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    depth += 1;
    const parent: { parentId: string | null } | null =
      await prisma.file.findUnique({
        where: { id: cursor },
        select: { parentId: true },
      });
    cursor = parent?.parentId ?? null;
  }
  return depth;
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

    const file = await prisma.file.findUnique({ where: { id } });
    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const updateData: {
      name?: string;
      isPrivate?: boolean;
      parentId?: string | null;
      filePath?: string;
    } = {};
    if (name) updateData.name = name;

    // Privacy change: also move the physical asset, otherwise the file stays in
    // /public/uploads and remains reachable via direct URL despite isPrivate=true.
    let newPathFromPrivacy: string | null = null;
    if (isPrivate !== undefined && isPrivate !== file.isPrivate) {
      updateData.isPrivate = isPrivate;
      if (file.type === "file" && file.filePath) {
        try {
          if (isBlobsPath(file.filePath)) {
            newPathFromPrivacy = await moveBlob(file.filePath, isPrivate);
          } else if (isLocalStoredPath(file.filePath)) {
            newPathFromPrivacy = await moveStoredFile(file.filePath, isPrivate);
          }
          if (newPathFromPrivacy && newPathFromPrivacy !== file.filePath) {
            updateData.filePath = newPathFromPrivacy;
          }
        } catch (error) {
          console.error("Error moving stored file on privacy change:", error);
          return NextResponse.json(
            { error: "Failed to move file when changing privacy" },
            { status: 500 }
          );
        }
      }
    } else if (isPrivate !== undefined) {
      updateData.isPrivate = isPrivate;
    }

    if (parentId !== undefined) {
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

      if (parentId) {
        const targetDepth = await getDepth(parentId);
        if (targetDepth + 1 > MAX_FOLDER_DEPTH) {
          return NextResponse.json(
            { error: `Maximum folder depth ${MAX_FOLDER_DEPTH} exceeded` },
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

    const updated = await prisma.file.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/files/[id] error:", error);
    return NextResponse.json(
      {
        error: "Failed to update file",
        details: error instanceof Error ? error.message : String(error),
      },
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
      const pageIds = Array.from(
        new Set(
          file.usage
            .map((u) => u.pageId)
            .filter((v): v is string => typeof v === "string")
        )
      );
      const pages = pageIds.length
        ? await prisma.page.findMany({
            where: { id: { in: pageIds } },
            select: { id: true, title: true, slug: true, status: true, deletedAt: true, ogImage: true },
          })
        : [];
      const pagesById = new Map(pages.map((p) => [p.id, p]));

      // Usage rows pointing at a deleted/missing page are stale — purge them
      // and don't count them as blocking. This also self-heals data that pre-dates
      // the page DELETE cleanup.
      const orphanIds: string[] = [];
      const liveUsage = file.usage.filter((u) => {
        if (!u.pageId) return true; // legacy slug-only rows: keep blocking
        const page = pagesById.get(u.pageId);
        if (!page || page.deletedAt) {
          orphanIds.push(u.id);
          return false;
        }
        return true;
      });

      if (orphanIds.length > 0) {
        await prisma.fileUsage.deleteMany({ where: { id: { in: orphanIds } } });
      }

      if (liveUsage.length === 0) {
        // All usages were orphans; fall through to the normal delete flow.
      } else {
        const enriched = liveUsage.map((u) => {
          const page = u.pageId ? pagesById.get(u.pageId) : null;
          return {
            id: u.id,
            pageId: u.pageId,
            pageSlug: u.pageSlug,
            context: u.context,
            page: page
              ? {
                  id: page.id,
                  title: page.title,
                  slug: page.slug,
                  status: page.status,
                  deleted: !!page.deletedAt,
                  ogImage: page.ogImage,
                }
              : null,
          };
        });

        return NextResponse.json(
          {
            error: "File is in use",
            message: `Ce fichier est utilisé sur ${liveUsage.length} page(s)`,
            usage: enriched,
          },
          { status: 409 }
        );
      }
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

    if (file.type === "file" && file.filePath) {
      // Dedup may share the same physical blob across rows. Only delete the
      // bytes when no other File row still points at this filePath.
      const otherUsers = await prisma.file.count({
        where: { filePath: file.filePath, id: { not: id } },
      });
      if (otherUsers === 0) {
        await deleteStoredContent(file.filePath);
      }
    }

    await prisma.file.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/files/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
}
