import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { apiError, apiOk } from "@/lib/api/response";
import { changeFilePrivacy, FilePrivacyError, MAX_PRIVACY_FILES } from "@/lib/storage/file-privacy";

export async function PATCH(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;
  try {
    const { parentId, isPrivate } = await req.json();
    if (typeof parentId !== "string" || typeof isPrivate !== "boolean") {
      return apiError(400, "parentId and boolean isPrivate are required");
    }
    const ids: string[] = [];
    let frontier = [parentId];
    const seen = new Set([parentId]);
    while (frontier.length) {
      const children = await prisma.file.findMany({
        where: { parentId: { in: frontier } },
        select: { id: true, type: true }, take: MAX_PRIVACY_FILES + 1,
      });
      const fresh = children.filter((child) => !seen.has(child.id));
      for (const child of fresh) { seen.add(child.id); ids.push(child.id); }
      if (ids.length > MAX_PRIVACY_FILES) return apiError(413, "Too many files; select a smaller folder");
      frontier = fresh.filter((child) => child.type === "folder").map((child) => child.id);
    }
    const result = await changeFilePrivacy(ids, isPrivate);
    return apiOk({ success: true, ...result });
  } catch (error) {
    if (error instanceof FilePrivacyError) return apiError(error.status, error.code, { code: error.code });
    console.error("PATCH /api/files/bulk-update failed");
    return apiError(500, "Failed to update files");
  }
}
