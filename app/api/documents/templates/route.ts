import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireAdminAuth } from "@/lib/auth-check";
import { getFileBuffer } from "@/lib/documents/storage";
import { parseAcroForm } from "@/lib/documents/pdf-acroform-parser";
import { extractDocxPlaceholders } from "@/lib/documents/docx-filler";
import { DocumentField, DocumentSourceType } from "@/lib/documents/types";

export async function GET() {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const templates = await prisma.documentTemplate.findMany({
    include: {
      tool: { select: { id: true, name: true, slug: true } },
      sourceFile: { select: { id: true, name: true, fileType: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { toolId, newTool, sourceFileId, rgpdNotice, retentionDays, outputFilenameTpl } = body || {};
  if (!sourceFileId) {
    return NextResponse.json({ error: "sourceFileId requis" }, { status: 400 });
  }

  let actualToolId: string | null = toolId || null;

  if (!actualToolId && newTool) {
    if (!newTool.name || !newTool.slug || !newTool.sectionId) {
      return NextResponse.json(
        { error: "newTool.name, newTool.slug et newTool.sectionId requis" },
        { status: 400 }
      );
    }
    const dupSlug = await prisma.tool.findUnique({ where: { slug: newTool.slug } });
    if (dupSlug) {
      return NextResponse.json(
        { error: `Le slug "${newTool.slug}" est déjà utilisé` },
        { status: 409 }
      );
    }
    const created = await prisma.tool.create({
      data: {
        sectionId: newTool.sectionId,
        name: newTool.name,
        slug: newTool.slug,
        description: newTool.description || "",
        type: "doc_generator",
        icon: newTool.icon || null,
        timeMin: typeof newTool.timeMin === "number" ? newTool.timeMin : null,
      },
    });
    actualToolId = created.id;
  }

  if (!actualToolId) {
    return NextResponse.json(
      { error: "toolId ou newTool requis" },
      { status: 400 }
    );
  }

  const tool = await prisma.tool.findUnique({ where: { id: actualToolId } });
  if (!tool) {
    return NextResponse.json({ error: "Tool introuvable" }, { status: 404 });
  }

  const file = await prisma.file.findUnique({ where: { id: sourceFileId } });
  if (!file) {
    return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
  }

  const existing = await prisma.documentTemplate.findUnique({
    where: { toolId: actualToolId },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Un template existe déjà pour cet outil" },
      { status: 409 }
    );
  }

  const buffer = await getFileBuffer(sourceFileId);
  if (!buffer) {
    return NextResponse.json(
      { error: "Impossible de lire le fichier source" },
      { status: 500 }
    );
  }

  let sourceType: DocumentSourceType = "pdf_flat";
  let schema: DocumentField[] = [];

  if (file.fileType === "pdf") {
    try {
      const parsed = await parseAcroForm(buffer);
      schema = parsed.fields;
      sourceType = parsed.fields.length > 0 ? "pdf_acroform" : "pdf_flat";
    } catch (err) {
      console.error("parseAcroForm error:", err);
      sourceType = "pdf_flat";
      schema = [];
    }
  } else if (file.fileType === "docx") {
    sourceType = "docx";
    try {
      const placeholders = extractDocxPlaceholders(buffer);
      schema = placeholders.map((p) => ({
        id: p,
        label: p,
        type: "text" as const,
        required: false,
      }));
    } catch (err) {
      console.error("extractDocxPlaceholders error:", err);
      schema = [];
    }
  } else {
    return NextResponse.json(
      { error: `Type de fichier non supporté: ${file.fileType}` },
      { status: 415 }
    );
  }

  const template = await prisma.documentTemplate.create({
    data: {
      toolId: actualToolId,
      sourceFileId,
      sourceType,
      schema: schema as unknown as Prisma.InputJsonValue,
      rgpdNotice: rgpdNotice ?? null,
      retentionDays: typeof retentionDays === "number" ? retentionDays : 30,
      outputFilenameTpl: outputFilenameTpl || "document-{{date}}.pdf",
      status: "draft",
    },
  });

  return NextResponse.json(template, { status: 201 });
}
