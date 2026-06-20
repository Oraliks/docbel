import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import { requireAdminAuth } from "@/lib/auth-check";
import { actorLabel } from "@/lib/news/session";
import { newsUpdateSchema } from "@/lib/news/validation";
import { slugify } from "@/lib/news/slug";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

// Admin-only endpoint. Public pages read articles directly via Prisma in Server Components.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  try {
    const { id } = await params;
    const article = await prisma.news.findUnique({ where: { id } });
    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404, headers: jsonHeaders });
    }
    return NextResponse.json(article, { headers: jsonHeaders });
  } catch (error) {
    console.error("Error fetching article:", error);
    return NextResponse.json({ error: "Failed to fetch article" }, { status: 500, headers: jsonHeaders });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  try {
    const { id } = await params;
    const json = await req.json();
    const parsed = newsUpdateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", issues: parsed.error.issues },
        { status: 400, headers: jsonHeaders }
      );
    }
    const body = parsed.data;

    let nextSlug: string | undefined;
    if (body.slug !== undefined) {
      nextSlug = slugify(body.slug);
      if (!nextSlug) {
        return NextResponse.json({ error: "Slug invalide" }, { status: 400, headers: jsonHeaders });
      }
      const conflict = await prisma.news.findFirst({
        where: { slug: nextSlug, NOT: { id } },
        select: { id: true },
      });
      if (conflict) {
        return NextResponse.json(
          { error: "Un article avec ce slug existe déjà" },
          { status: 409, headers: jsonHeaders }
        );
      }
    }

    if (body.status === "scheduled") {
      const when = body.scheduledAt;
      if (!when || new Date(when).getTime() <= Date.now()) {
        return NextResponse.json(
          { error: "scheduledAt doit être dans le futur" },
          { status: 400, headers: jsonHeaders }
        );
      }
    }

    const data: Prisma.NewsUpdateInput = {
      ...(body.title !== undefined && { title: body.title }),
      ...(nextSlug !== undefined && { slug: nextSlug }),
      ...(body.excerpt !== undefined && { excerpt: body.excerpt }),
      ...(body.content !== undefined && { content: body.content }),
      ...(body.category !== undefined && { category: body.category }),
      ...(body.color !== undefined && { color: body.color }),
      ...(body.emoji !== undefined && { emoji: body.emoji }),
      ...(body.image !== undefined && { image: body.image || null }),
      ...(body.heroIllustration !== undefined && { heroIllustration: body.heroIllustration || null }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.featured !== undefined && { featured: body.featured }),
      ...(body.readingTime !== undefined && { readingTime: body.readingTime }),
      ...(body.scheduledAt !== undefined && {
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
      }),
      ...(body.publishedAt !== undefined && {
        publishedAt: body.publishedAt ? new Date(body.publishedAt) : null,
      }),
      ...(body.keyTakeaway !== undefined && { keyTakeaway: body.keyTakeaway ?? null }),
      // Colonnes JSONB : Prisma refuse un null brut → Prisma.JsonNull pour vider.
      ...(body.summary !== undefined && { summary: body.summary ?? Prisma.JsonNull }),
      ...(body.linkedDocs !== undefined && { linkedDocs: body.linkedDocs ?? Prisma.JsonNull }),
      ...(body.faqs !== undefined && { faqs: body.faqs ?? Prisma.JsonNull }),
      updatedBy: authCheck.user?.id ?? null,
    };

    const article = await prisma.news.update({ where: { id }, data });

    await logActivity(
      actorLabel(authCheck.user),
      "updated",
      "news",
      article.title,
      article.id,
      `Article mis à jour: ${article.title}`
    );

    return NextResponse.json(article, { headers: jsonHeaders });
  } catch (error) {
    console.error("Error updating article:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json(
          { error: "Un article avec ce slug existe déjà" },
          { status: 409, headers: jsonHeaders }
        );
      }
      if (error.code === "P2025") {
        return NextResponse.json({ error: "Article not found" }, { status: 404, headers: jsonHeaders });
      }
    }
    return NextResponse.json({ error: "Failed to update article" }, { status: 500, headers: jsonHeaders });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  try {
    const { id } = await params;
    const article = await prisma.news.findUnique({ where: { id } });
    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404, headers: jsonHeaders });
    }

    await prisma.news.delete({ where: { id } });

    await logActivity(
      actorLabel(authCheck.user),
      "deleted",
      "news",
      article.title,
      article.id,
      `Article supprimé: ${article.title}`
    );

    return NextResponse.json({ success: true }, { headers: jsonHeaders });
  } catch (error) {
    console.error("Error deleting article:", error);
    return NextResponse.json({ error: "Failed to delete article" }, { status: 500, headers: jsonHeaders });
  }
}
