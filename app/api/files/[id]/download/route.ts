import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { resolveStoredFilePath } from "@/lib/file-storage"
import { prisma } from "@/lib/prisma"
import { readFile } from "fs/promises"
import { existsSync } from "fs"
import { isBlobsPath, getBlob } from "@/lib/storage/blob-storage"

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
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    if (file.isPrivate) {
      const session = await auth.api.getSession({ headers: await headers() })
      const role = (session?.user as { role?: string } | undefined)?.role

      if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      if (role !== "admin") {
        return NextResponse.json(
          { error: "Forbidden - Admin access required" },
          { status: 403 }
        )
      }
    }

    if (!file.filePath) {
      return NextResponse.json(
        { error: "File has no path" },
        { status: 400 }
      )
    }

    let fileContent: Buffer

    if (isBlobsPath(file.filePath)) {
      const buf = await getBlob(file.filePath)
      if (!buf) {
        return NextResponse.json(
          { error: "File not found in Blobs" },
          { status: 404 }
        )
      }
      fileContent = buf
    } else {
      const fullPath = resolveStoredFilePath(file.filePath)

      if (!fullPath) {
        return NextResponse.json(
          { error: "Unsupported file path" },
          { status: 400 }
        )
      }

      if (!existsSync(fullPath)) {
        return NextResponse.json(
          { error: "File not found on disk" },
          { status: 404 }
        )
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

    const cacheControl = file.isPrivate
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
    return NextResponse.json(
      { error: "Failed to serve file" },
      { status: 500 }
    )
  }
}
