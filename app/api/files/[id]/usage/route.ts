import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  try {
    const { id } = await params;
    const usage = await prisma.fileUsage.findMany({
      where: { fileId: id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(usage);
  } catch (error) {
    console.error("GET /api/files/[id]/usage error:", error);
    return NextResponse.json(
      { error: "Failed to fetch usage" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  try {
    const body = await req.json();
    const { pageSlug, context } = body;

    if (!pageSlug) {
      return NextResponse.json(
        { error: "pageSlug is required" },
        { status: 400 }
      );
    }

    const { id } = await params;
    const usage = await prisma.fileUsage.create({
      data: {
        fileId: id,
        pageSlug,
        context,
      },
    });

    return NextResponse.json(usage, { status: 201 });
  } catch (error) {
    console.error("POST /api/files/[id]/usage error:", error);
    return NextResponse.json(
      { error: "Failed to create usage record" },
      { status: 500 }
    );
  }
}
