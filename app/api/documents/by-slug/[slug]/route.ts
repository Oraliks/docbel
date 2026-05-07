import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const tool = await prisma.tool.findUnique({
    where: { slug },
    include: {
      documentTemplate: true,
      section: { select: { id: true, name: true } },
    },
  });

  if (!tool || tool.type !== "doc_generator" || !tool.documentTemplate) {
    return NextResponse.json({ error: "Outil introuvable" }, { status: 404 });
  }

  if (tool.documentTemplate.status !== "published") {
    return NextResponse.json(
      { error: "Outil non publié" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    tool: {
      id: tool.id,
      name: tool.name,
      slug: tool.slug,
      description: tool.description,
      icon: tool.icon,
      sectionName: tool.section.name,
    },
    template: {
      id: tool.documentTemplate.id,
      sourceType: tool.documentTemplate.sourceType,
      schema: tool.documentTemplate.schema,
      rgpdNotice: tool.documentTemplate.rgpdNotice,
      outputFilenameTpl: tool.documentTemplate.outputFilenameTpl,
      version: tool.documentTemplate.version,
    },
  });
}
