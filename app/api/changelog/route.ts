import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import { requireAdminAuth } from "@/lib/auth-check";
import { actorLabel } from "@/lib/news/session";
import {
  changelogCreateSchema,
  changelogListQuerySchema,
} from "@/lib/changelog/validation";
import { sanitizeChangelogHtml } from "@/lib/changelog/sanitize";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = changelogListQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", issues: parsed.error.issues },
        { status: 400, headers: jsonHeaders },
      );
    }

    const { limit, since } = parsed.data;
    const where: Prisma.ChangelogWhereInput = {};
    if (since) where.publishedAt = { gt: new Date(since) };

    const entries = await prisma.changelog.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ entries }, { headers: jsonHeaders });
  } catch (error) {
    console.error("[changelog] list failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch changelog" },
      { status: 500, headers: jsonHeaders },
    );
  }
}

export async function POST(req: NextRequest) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  try {
    const json = await req.json();
    const parsed = changelogCreateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", issues: parsed.error.issues },
        { status: 400, headers: jsonHeaders },
      );
    }
    const data = parsed.data;

    const entry = await prisma.changelog.create({
      data: {
        version: data.version,
        publishedAt: new Date(data.publishedAt),
        type: data.type,
        title: data.title,
        description: sanitizeChangelogHtml(data.description ?? ""),
        changes: data.changes as unknown as Prisma.InputJsonValue,
        createdBy: authCheck.user?.id ?? null,
        updatedBy: authCheck.user?.id ?? null,
      },
    });

    await logActivity(
      actorLabel(authCheck.user),
      "created",
      "changelog",
      entry.title,
      entry.id,
      `Changelog ${entry.version} créé`,
    );

    return NextResponse.json(entry, { status: 201, headers: jsonHeaders });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "Cette version existe déjà" },
        { status: 409, headers: jsonHeaders },
      );
    }
    console.error("[changelog] create failed:", error);
    return NextResponse.json(
      { error: "Failed to create changelog" },
      { status: 500, headers: jsonHeaders },
    );
  }
}
