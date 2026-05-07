import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logActivity, type ActivityAction } from "@/lib/activity-logger";
import { requireAdminAuth } from "@/lib/auth-check";
import { actorLabel } from "@/lib/news/session";
import { bulkActionSchema } from "@/lib/news/validation";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

const ACTION_DETAILS: Record<
  "publish" | "unpublish" | "archive" | "delete",
  { activity: ActivityAction; label: string; data?: Prisma.NewsUpdateManyMutationInput }
> = {
  publish: {
    activity: "published",
    label: "publiés",
    data: { status: "published", publishedAt: new Date(), scheduledAt: null },
  },
  unpublish: {
    activity: "unpublished",
    label: "dépubliés",
    data: { status: "draft", publishedAt: null, scheduledAt: null },
  },
  archive: {
    activity: "updated",
    label: "archivés",
    data: { status: "archived" },
  },
  delete: {
    activity: "deleted",
    label: "supprimés",
  },
};

export async function POST(req: NextRequest) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  try {
    const json = await req.json();
    const parsed = bulkActionSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", issues: parsed.error.issues },
        { status: 400, headers: jsonHeaders }
      );
    }
    const { action, ids } = parsed.data;
    const config = ACTION_DETAILS[action];
    const actor = actorLabel(authCheck.user);

    const count = await prisma.$transaction(async (tx) => {
      let affected: number;
      if (action === "delete") {
        const result = await tx.news.deleteMany({ where: { id: { in: ids } } });
        affected = result.count;
      } else {
        const result = await tx.news.updateMany({
          where: { id: { in: ids } },
          data: { ...(config.data ?? {}), updatedBy: authCheck.user?.id ?? null },
        });
        affected = result.count;
      }

      await tx.activity.create({
        data: {
          user: actor,
          action: config.activity,
          resource: "news",
          resourceName: `${affected} articles`,
          resourceId: null,
          details: `${affected} articles ${config.label}`,
        },
      });

      return affected;
    });

    return NextResponse.json({ success: true, count }, { headers: jsonHeaders });
  } catch (error) {
    console.error("Error performing bulk action:", error);
    // Surface a degraded log entry if the transaction failed.
    try {
      await logActivity(actorLabel(authCheck.user), "error", "news", "bulk-action", undefined, "Bulk action failed");
    } catch {
      /* noop */
    }
    return NextResponse.json({ error: "Failed to perform bulk action" }, { status: 500, headers: jsonHeaders });
  }
}
