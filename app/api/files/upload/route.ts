import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { buildStoredFilePath, getUploadDirectory } from "@/lib/file-storage";
import { isBlobsEnabled, saveBlob } from "@/lib/documents/blob-storage";
import { matchesSignature } from "@/lib/file-signatures";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { createHash } from "crypto";
import { nanoid } from "nanoid";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
const DEFAULT_USER_QUOTA_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB

function getUserQuotaBytes(): number {
  const fromEnv = process.env.MAX_USER_STORAGE_BYTES;
  if (!fromEnv) return DEFAULT_USER_QUOTA_BYTES;
  const parsed = Number(fromEnv);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_USER_QUOTA_BYTES;
}

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
  "application/vnd.rar",
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

const SVG_DANGEROUS = /<script\b|on\w+\s*=|javascript:/i;

function svgLooksSafe(buffer: Buffer): boolean {
  // The download route serves SVG as attachment, but adding a content check
  // catches the most obvious payloads at intake time.
  const text = buffer.toString("utf8", 0, Math.min(buffer.length, 64 * 1024));
  return !SVG_DANGEROUS.test(text);
}

export async function POST(req: NextRequest) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const parentId = formData.get("parentId") as string | null;
    const requestedPrivate = formData.get("isPrivate") === "true";

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

    const userId = authCheck.user.id;
    const usage = await prisma.file.aggregate({
      where: { createdBy: userId, type: "file" },
      _sum: { size: true },
    });
    const currentBytes = usage._sum.size ?? 0;
    const quota = getUserQuotaBytes();
    if (currentBytes + file.size > quota) {
      return NextResponse.json(
        {
          error: "Storage quota exceeded",
          used: currentBytes,
          quota,
        },
        { status: 413 }
      );
    }

    const buffer = await file.arrayBuffer();
    const nodeBuffer = Buffer.from(buffer);

    if (!matchesSignature(nodeBuffer, fileExt)) {
      return NextResponse.json(
        { error: `File content does not match extension .${fileExt}` },
        { status: 415 }
      );
    }

    if (fileExt === "svg" && !svgLooksSafe(nodeBuffer)) {
      return NextResponse.json(
        { error: "SVG content appears to contain active code" },
        { status: 415 }
      );
    }

    // SVG always lives behind the API: any active payload bypassed by the static
    // text scan would otherwise execute when served from /public/uploads.
    const isPrivate = fileExt === "svg" ? true : requestedPrivate;

    const sha256 = createHash("sha256").update(nodeBuffer).digest("hex");

    // Dedup: when the same content is re-uploaded by the same user, point to the
    // existing blob instead of writing a second physical copy. We still create a
    // distinct DB row so each file-tree entry has its own id/parent/name.
    const dedupSource = await prisma.file.findFirst({
      where: { sha256, type: "file", createdBy: userId, isPrivate },
      select: { filePath: true, mimeType: true },
    });

    const safeName = sanitizeFileName(file.name);
    const fileType = getFileType(fileExt);

    let filePath: string;

    if (dedupSource?.filePath) {
      filePath = dedupSource.filePath;
    } else if (isBlobsEnabled()) {
      const folder = isPrivate ? "private" : "public";
      const key = `${folder}/${nanoid()}-${safeName}`;
      filePath = await saveBlob(nodeBuffer, key);
    } else {
      const { relativeDir, absoluteDir } = getUploadDirectory(isPrivate);

      if (!existsSync(absoluteDir)) {
        await mkdir(absoluteDir, { recursive: true });
      }

      const uniqueName = `${nanoid(12)}-${safeName}`;
      filePath = buildStoredFilePath(relativeDir, uniqueName);
      const fullPath = join(absoluteDir, uniqueName);

      await writeFile(fullPath, nodeBuffer);
    }

    const dbFile = await prisma.file.create({
      data: {
        name: file.name,
        type: "file",
        fileType,
        mimeType: file.type || null,
        size: nodeBuffer.byteLength,
        sha256,
        parentId: parentId || null,
        isPrivate,
        filePath,
        createdBy: userId,
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
