import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { applyNewsTransition } from "@/lib/news/transitions";
import { actorLabel } from "@/lib/news/session";
import { scheduleSchema } from "@/lib/news/validation";
import { HERO_REQUIRED_MESSAGE, hasHeroIllustration } from "@/lib/news/publish-guard";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  try {
    const { id } = await params;
    const json = await req.json();
    const parsed = scheduleSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "scheduledAt is required (ISO datetime)", issues: parsed.error.issues },
        { status: 400, headers: jsonHeaders }
      );
    }
    const scheduledDate = new Date(parsed.data.scheduledAt);
    if (scheduledDate.getTime() <= Date.now()) {
      return NextResponse.json(
        { error: "scheduledAt doit être dans le futur" },
        { status: 400, headers: jsonHeaders }
      );
    }

    // Garde : une planification débouche sur une publication → illustration
    // de hero obligatoire dès la planification.
    const existing = await prisma.news.findUnique({
      where: { id },
      select: { heroIllustration: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Article not found" }, { status: 404, headers: jsonHeaders });
    }
    if (!hasHeroIllustration(existing.heroIllustration)) {
      return NextResponse.json({ error: HERO_REQUIRED_MESSAGE }, { status: 422, headers: jsonHeaders });
    }

    const article = await applyNewsTransition({
      id,
      data: { status: "scheduled", scheduledAt: scheduledDate, publishedAt: null },
      action: "scheduled",
      detailsTemplate: (title) => `Article planifié (${title}) pour ${scheduledDate.toISOString()}`,
      actor: actorLabel(authCheck.user),
      updatedBy: authCheck.user?.id,
    });

    return NextResponse.json(article, { headers: jsonHeaders });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Article not found" }, { status: 404, headers: jsonHeaders });
    }
    console.error("Error scheduling article:", error);
    return NextResponse.json({ error: "Failed to schedule article" }, { status: 500, headers: jsonHeaders });
  }
}
