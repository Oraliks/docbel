import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { buildStoredFilePath, getUploadDirectory } from "@/lib/file-storage";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

const ALLOWED_EXTENSIONS = new Set([
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "jpg", "jpeg", "png", "gif", "webp", "svg",
  "zip", "rar", "7z",
  "mp4", "mov", "avi", "webm",
  "txt", "csv",
]);

const ALLOWED_MIME_PREFIXES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/zip",
  "application/x-zip-compressed",
  "application/x-rar-compressed",
  "application/x-7z-compressed",
  "image/",
  "video/",
  "text/plain",
  "text/csv",
];

function isAllowedMime(mime: string) {
  if (!mime) return false;
  return ALLOWED_MIME_PREFIXES.some((p) => mime.startsWith(p));
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
}

export async function POST(req: NextRequest) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const parentId = formData.get("parentId") as string | null;
    const isPrivate = formData.get("isPrivate") === "true";

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024} MB)` },
        { status: 413 }
      );
    }

    const fileExt = file.name.split(".").pop()?.toLowerCase() || "";
    if (!ALLOWED_EXTENSIONS.has(fileExt)) {
      return NextResponse.json(
        { error: `File extension .${fileExt} is not allowed` },
        { status: 415 }
      );
    }

    if (!isAllowedMime(file.type)) {
      return NextResponse.json(
        { error: `MIME type ${file.type || "unknown"} is not allowed` },
        { status: 415 }
      );
    }

    const buffer = await file.arrayBuffer();
    const safeName = sanitizeFileName(file.name);
    const fileType = getFileType(fileExt);

    const { relativeDir, absoluteDir } = getUploadDirectory(isPrivate);

    if (!existsSync(absoluteDir)) {
      await mkdir(absoluteDir, { recursive: true });
    }

    const uniqueName = `${Date.now()}-${safeName}`;
    const filePath = buildStoredFilePath(relativeDir, uniqueName);
    const fullPath = join(absoluteDir, uniqueName);

    await writeFile(fullPath, Buffer.from(buffer));

    const dbFile = await prisma.file.create({
      data: {
        name: file.name,
        type: "file",
        fileType,
        size: buffer.byteLength,
        parentId: parentId || null,
        isPrivate,
        filePath,
        createdBy: authCheck.user?.id || "unknown",
      },
    });

    return NextResponse.json(dbFile, { status: 201 });
  } catch (error) {
    console.error("POST /api/files/upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}

function getFileType(ext: string): string {
  const typeMap: Record<string, string> = {
    pdf: "pdf",
    doc: "docx",
    docx: "docx",
    xls: "xlsx",
    xlsx: "xlsx",
    ppt: "pptx",
    pptx: "pptx",
    jpg: "image",
    jpeg: "image",
    png: "image",
    gif: "image",
    webp: "image",
    svg: "image",
    zip: "archive",
    rar: "archive",
    "7z": "archive",
    mp4: "video",
    mov: "video",
    avi: "video",
    webm: "video",
    txt: "text",
    csv: "text",
  };
  return typeMap[ext] || "file";
}
