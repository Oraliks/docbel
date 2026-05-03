import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const parentId = formData.get("parentId") as string | null;
    const isPrivate = formData.get("isPrivate") === "true";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const fileName = file.name;
    const fileSize = buffer.byteLength;
    const fileExt = fileName.split(".").pop()?.toLowerCase() || "";
    const fileType = getFileType(fileExt);

    // Déterminer le chemin de sauvegarde
    const uploadDir = isPrivate ? "private/uploads" : "public/uploads";
    const fullDir = join(process.cwd(), uploadDir);

    // Créer le dossier s'il n'existe pas
    if (!existsSync(fullDir)) {
      await mkdir(fullDir, { recursive: true });
    }

    // Générer un nom de fichier unique
    const uniqueName = `${Date.now()}-${fileName}`;
    const filePath = join(uploadDir, uniqueName);
    const fullPath = join(process.cwd(), filePath);

    // Écrire le fichier
    await writeFile(fullPath, Buffer.from(buffer));

    // Créer l'enregistrement en DB
    const dbFile = await prisma.file.create({
      data: {
        name: fileName,
        type: "file",
        fileType,
        size: fileSize,
        parentId: parentId || null,
        isPrivate,
        filePath: filePath.replace(/\\/g, "/"),
        createdBy: auth.user?.email || "unknown",
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
    zip: "archive",
    rar: "archive",
    "7z": "archive",
    mp4: "video",
    avi: "video",
    mov: "video",
    ts: "code",
    js: "code",
    tsx: "code",
    jsx: "code",
    py: "code",
  };
  return typeMap[ext] || "file";
}
