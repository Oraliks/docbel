import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { resolveStoredFilePath } from "@/lib/file-storage";
import { isBlobsPath, deleteBlob } from "@/lib/storage/blob-storage";
import { unlink } from "fs/promises";
import { existsSync } from "fs";

async function deleteStored(filePath: string | null) {
  if (!filePath) return;
  if (isBlobsPath(filePath)) {
    try {
      await deleteBlob(filePath);
    } catch (error) {
      console.error("bulk-delete: blob delete failed:", error);
    }
    return;
  }
  const fullPath = resolveStoredFilePath(filePath);
  if (!fullPath) return;
  try {
    if (existsSync(fullPath)) await unlink(fullPath);
  } catch (error) {
    console.error("bulk-delete: disk delete failed:", error);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  try {
    const body = await req.json();
    const ids: unknown = body?.ids;
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids required" }, { status: 400 });
    }
    const cleanIds = ids.filter((v): v is string => typeof v === "string");

    const targets = await prisma.file.findMany({
      where: { id: { in: cleanIds } },
      include: {
        usage: { select: { id: true, pageSlug: true } },
        children: { select: { id: true } },
      },
    });

    const blocked: { id: string; name: string; reason: string }[] = [];
    const deletable: typeof targets = [];

    for (const file of targets) {
      if (file.usage.length > 0) {
        blocked.push({
          id: file.id,
          name: file.name,
          reason: `Utilisé sur ${file.usage.length} page(s)`,
        });
        continue;
      }
      if (file.type === "folder" && file.children.length > 0) {
        blocked.push({
          id: file.id,
          name: file.name,
          reason: "Dossier non vide",
        });
        continue;
      }
      deletable.push(file);
    }

    if (deletable.length === 0) {
      return NextResponse.json(
        { deleted: 0, blocked },
        { status: blocked.length > 0 ? 409 : 200 }
      );
    }

    const pathsToFree: string[] = [];
    for (const f of deletable) {
      if (f.type !== "file" || !f.filePath) continue;
      const otherUsers = await prisma.file.count({
        where: { filePath: f.filePath, id: { notIn: deletable.map((d) => d.id) } },
      });
      if (otherUsers === 0) pathsToFree.push(f.filePath);
    }

    await prisma.file.deleteMany({
      where: { id: { in: deletable.map((d) => d.id) } },
    });

    await Promise.all(pathsToFree.map(deleteStored));

    return NextResponse.json({
      deleted: deletable.length,
      blocked,
    });
  } catch (error) {
    console.error("POST /api/files/bulk-delete error:", error);
    return NextResponse.json(
      { error: "Failed to bulk-delete files" },
      { status: 500 }
    );
  }
}
