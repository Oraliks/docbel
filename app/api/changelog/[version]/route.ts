import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import { requireAdminAuth } from "@/lib/auth-check";
import { actorLabel } from "@/lib/news/session";
import { changelogUpdateSchema } from "@/lib/changelog/validation";
import { sanitizeChangelogHtml } from "@/lib/changelog/sanitize";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ version: string }> },
) {
  try {
    const { version } = await params;
    const entry = await prisma.changelog.findUnique({ where: { version } });
    if (!entry) {
      return NextResponse.json(
        { error: "Changelog not found" },
        { status: 404, headers: jsonHeaders },
      );
    }
    return NextResponse.json(entry, { headers: jsonHeaders });
  } catch (error) {
    console.error("[changelog] get failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch changelog" },
      { status: 500, headers: jsonHeaders },
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ version: string }> },
) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  try {
    const { version } = await params;
    const json = await req.json();
    const parsed = changelogUpdateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", issues: parsed.error.issues },
        { status: 400, headers: jsonHeaders },
      );
    }
    const body = parsed.data;

    const data: Prisma.ChangelogUpdateInput = {
      ...(body.version !== undefined && { version: body.version }),
      ...(body.publishedAt !== undefined && { publishedAt: new Date(body.publishedAt) }),
      ...(body.type !== undefined && { type: body.type }),
      ...(body.title !== undefined && { title: body.title }),
      ...(body.description !== undefined && {
        description: sanitizeChangelogHtml(body.description),
      }),
      ...(body.changes !== undefined && {
        changes: body.changes as unknown as Prisma.InputJsonValue,
      }),
      updatedBy: authCheck.user?.id ?? null,
    };

    const entry = await prisma.changelog.update({ where: { version }, data });

    await logActivity(
      actorLabel(authCheck.user),
      "updated",
      "changelog",
      entry.title,
      entry.id,
      `Changelog ${entry.version} mis à jour`,
    );

    return NextResponse.json(entry, { headers: jsonHeaders });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json(
          { error: "Cette version existe déjà" },
          { status: 409, headers: jsonHeaders },
        );
      }
      if (error.code === "P2025") {
        return NextResponse.json(
          { error: "Changelog not found" },
          { status: 404, headers: jsonHeaders },
        );
      }
    }
    console.error("[changelog] update failed:", error);
    return NextResponse.json(
      { error: "Failed to update changelog" },
      { status: 500, headers: jsonHeaders },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ version: string }> },
) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  try {
    const { version } = await params;
    const entry = await prisma.changelog.findUnique({ where: { version } });
    if (!entry) {
      return NextResponse.json(
        { error: "Changelog not found" },
        { status: 404, headers: jsonHeaders },
      );
    }

    await prisma.changelog.delete({ where: { version } });

    await logActivity(
      actorLabel(authCheck.user),
      "deleted",
      "changelog",
      entry.title,
      entry.id,
      `Changelog ${entry.version} supprimé`,
    );

    return NextResponse.json({ success: true }, { headers: jsonHeaders });
  } catch (error) {
    console.error("[changelog] delete failed:", error);
    return NextResponse.json(
      { error: "Failed to delete changelog" },
      { status: 500, headers: jsonHeaders },
    );
  }
}
