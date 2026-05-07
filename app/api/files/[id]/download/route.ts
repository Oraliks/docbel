import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { resolveStoredFilePath } from "@/lib/file-storage"
import { prisma } from "@/lib/prisma"
import { readFile } from "fs/promises"
import { existsSync } from "fs"

export async function GET(
  _req: NextRequest,
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

    const fileContent = await readFile(fullPath)

    const contentTypeMap: Record<string, string> = {
      pdf: "application/pdf",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      image: "image/jpeg",
      png: "image/png",
      jpg: "image/jpeg",
      gif: "image/gif",
      video: "video/mp4",
      archive: "application/zip",
      code: "text/plain",
    }

    const contentType = contentTypeMap[file.fileType || ""] || "application/octet-stream"

    return new NextResponse(fileContent, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${file.name}"`,
        "Cache-Control": "public, max-age=3600",
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
