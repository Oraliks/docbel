import { NextRequest, NextResponse } from "next/server"
import { requireAdminAuth } from "@/lib/auth-check"
import { apiError } from "@/lib/api/response"
import { resolveStoredFilePath } from "@/lib/file-storage"
import { prisma } from "@/lib/prisma"
import { readFile } from "fs/promises"
import { existsSync } from "fs"
import { isBlobsPath, isPrivateBlobPath, getBlob } from "@/lib/storage/blob-storage"

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  mov: "video/quicktime",
  avi: "video/x-msvideo",
  webm: "video/webm",
  zip: "application/zip",
  rar: "application/vnd.rar",
  "7z": "application/x-7z-compressed",
  txt: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
}

// Forced as attachment because they can carry active content (XSS, etc).
const FORCE_ATTACHMENT_EXTS = new Set(["svg", "html", "htm", "xhtml", "xml"])

function getExtension(name: string): string {
  const idx = name.lastIndexOf(".")
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : ""
}

function buildContentDisposition(name: string, mode: "inline" | "attachment"): string {
  const fallback = name.replace(/[\r\n"\\]/g, "_")
  // RFC 5987: encode non-ASCII as UTF-8 percent-encoding. encodeURIComponent
  // already covers everything we need without the deprecated escape().
  const encoded = encodeURIComponent(name)
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
  return `${mode}; filename="${fallback}"; filename*=UTF-8''${encoded}`
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const file = await prisma.file.findUnique({
      where: { id },
    })

    if (!file) {
      return apiError(404, "File not found")
    }

    const isPrivate = file.isPrivate || Boolean(file.filePath && isPrivateBlobPath(file.filePath))
    if (isPrivate) {
      const authCheck = await requireAdminAuth()
      if (!authCheck.isAuthorized) return authCheck.error
    }

    if (!file.filePath) {
      return apiError(400, "File has no path")
    }

    let fileContent: Buffer

    if (isBlobsPath(file.filePath)) {
      const buf = await getBlob(file.filePath)
      if (!buf) {
        return apiError(404, "File not found in Blobs")
      }
      fileContent = buf
    } else {
      const fullPath = resolveStoredFilePath(file.filePath)

      if (!fullPath) {
        return apiError(400, "Unsupported file path")
      }

      if (!existsSync(fullPath)) {
        return apiError(404, "File not found on disk")
      }

      fileContent = await readFile(fullPath)
    }

    const ext = getExtension(file.name)
    const contentType =
      file.mimeType || MIME_BY_EXT[ext] || "application/octet-stream"

    const downloadParam = req.nextUrl.searchParams.get("download")
    const wantsDownload = downloadParam === "1" || downloadParam === "true"
    const mustForceAttachment = FORCE_ATTACHMENT_EXTS.has(ext)
    const disposition: "inline" | "attachment" =
      wantsDownload || mustForceAttachment ? "attachment" : "inline"

    const cacheControl = isPrivate
      ? "private, no-store"
      : "public, max-age=3600"

    return new NextResponse(fileContent as unknown as BodyInit, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": buildContentDisposition(file.name, disposition),
        "Cache-Control": cacheControl,
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    console.error("GET /api/files/[id]/download error:", error)
    return apiError(500, "Failed to serve file")
  }
}
