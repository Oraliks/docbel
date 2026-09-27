import { NextRequest } from "next/server";
import { requireAdminAuth } from "@/lib/auth-check";
import { apiError, apiOk } from "@/lib/api/response";
import { changeFilePrivacy, FilePrivacyError, MAX_PRIVACY_FILES } from "@/lib/storage/file-privacy";

// Flat selection. Recursive descendants are handled by /bulk-update.
export async function PATCH(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;
  try {
    const { ids, isPrivate } = await req.json();
    if (!Array.isArray(ids) || !ids.length || ids.some((id) => typeof id !== "string") || typeof isPrivate !== "boolean") {
      return apiError(400, "ids[] and isPrivate are required");
    }
    if (ids.length > MAX_PRIVACY_FILES) return apiError(413, "Too many files");
    const result = await changeFilePrivacy(ids, isPrivate);
    return apiOk({ success: true, ...result });
  } catch (error) {
    if (error instanceof FilePrivacyError) return apiError(error.status, error.code, { code: error.code });
    console.error("PATCH /api/files/bulk-privacy failed");
    return apiError(500, "Failed to bulk-update privacy");
  }
}
