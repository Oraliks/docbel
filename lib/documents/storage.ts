import { writeFile, readFile, mkdir, unlink } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import {
  buildStoredFilePath,
  getUploadDirectory,
  resolveStoredFilePath,
} from "@/lib/file-storage";
import {
  isBlobsEnabled,
  isBlobsPath,
  saveBlob,
  getBlob,
  deleteBlob,
} from "./blob-storage";

export async function getFileBuffer(fileId: string): Promise<Buffer | null> {
  const file = await prisma.file.findUnique({ where: { id: fileId } });
  if (!file?.filePath) return null;

  if (isBlobsPath(file.filePath)) {
    return getBlob(file.filePath);
  }

  const fullPath = resolveStoredFilePath(file.filePath);
  if (!fullPath || !existsSync(fullPath)) return null;
  return readFile(fullPath);
}

export async function saveGeneratedDocument(
  buffer: Buffer,
  filename: string,
  fileType: string,
  createdBy: string | null
): Promise<{ id: string; filePath: string }> {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);

  let filePath: string;

  if (isBlobsEnabled()) {
    const key = `generated/${nanoid()}-${safeName}`;
    filePath = await saveBlob(buffer, key);
  } else {
    const { relativeDir, absoluteDir } = getUploadDirectory(true);
    if (!existsSync(absoluteDir)) {
      await mkdir(absoluteDir, { recursive: true });
    }
    const uniqueName = `${Date.now()}-${safeName}`;
    filePath = buildStoredFilePath(relativeDir, uniqueName);
    const fullPath = join(absoluteDir, uniqueName);
    await writeFile(fullPath, buffer);
  }

  const dbFile = await prisma.file.create({
    data: {
      name: filename,
      type: "file",
      fileType,
      size: buffer.byteLength,
      isPrivate: true,
      filePath,
      createdBy: createdBy || "system",
    },
  });
  return { id: dbFile.id, filePath };
}

export async function deleteStoredFile(fileId: string): Promise<void> {
  const file = await prisma.file.findUnique({ where: { id: fileId } });
  if (!file) return;

  if (file.filePath) {
    if (isBlobsPath(file.filePath)) {
      try {
        await deleteBlob(file.filePath);
      } catch {
        // ignore
      }
    } else {
      const fullPath = resolveStoredFilePath(file.filePath);
      if (fullPath && existsSync(fullPath)) {
        try {
          await unlink(fullPath);
        } catch {
          // ignore
        }
      }
    }
  }
  await prisma.file.delete({ where: { id: fileId } }).catch(() => {});
}
