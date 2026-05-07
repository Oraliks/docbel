import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdminAuth } from "@/lib/auth-check";
import { applyNewsTransition } from "@/lib/news/transitions";
import { actorLabel } from "@/lib/news/session";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  try {
    const { id } = await params;
    const article = await applyNewsTransition({
      id,
      data: { status: "published", publishedAt: new Date(), scheduledAt: null },
      action: "published",
      detailsTemplate: (title) => `Article publié: ${title}`,
      actor: actorLabel(authCheck.user),
      updatedBy: authCheck.user?.id,
    });

    return NextResponse.json(article, { headers: jsonHeaders });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Article not found" }, { status: 404, headers: jsonHeaders });
    }
    console.error("Error publishing article:", error);
    return NextResponse.json({ error: "Failed to publish article" }, { status: 500, headers: jsonHeaders });
  }
}
