import { prisma } from "@/lib/prisma";

export type ActivityAction = "created" | "updated" | "deleted" | "published" | "unpublished" | "error" | "scheduled" | "received" | "synced" | "replied" | "created_bulk" | "published_bulk" | "unpublished_bulk" | "deleted_bulk";
export type ActivityResource = "page" | "user" | "comment" | "setting" | "news" | "category" | "message" | "file" | "inbox" | "email";

export async function logActivity(
  user: string,
  action: ActivityAction,
  resource: ActivityResource,
  resourceName: string,
  resourceId?: string,
  details?: string
) {
  try {
    await prisma.activity.create({
      data: {
        user,
        action,
        resource,
        resourceName,
        resourceId,
        details,
      },
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
}
