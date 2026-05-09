import { NextRequest, NextResponse } from "next/server";
import { syncAllFolders } from "@/lib/inbox/imap";
import { requireAdminAuth } from "@/lib/auth-check";
import { logActivity } from "@/lib/activity-logger";

/**
 * Cron-triggered or admin-triggered IMAP sync (all folders).
 *
 * Auth: either
 *   - Vercel cron header (Authorization: Bearer <CRON_SECRET>) — for daily run
 *   - admin session — for on-demand sync from /admin/messagerie
 */
async function handleSync(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const isCron = cronSecret && bearer === cronSecret;

  let triggeredBy = "cron";
  if (!isCron) {
    const authCheck = await requireAdminAuth();
    if (!authCheck.isAuthorized) return authCheck.error;
    triggeredBy = `admin:${authCheck.user.email}`;
  }

  try {
    const result = await syncAllFolders();
    if (result.imported > 0 || result.deleted > 0 || result.updated > 0) {
      await logActivity(
        triggeredBy,
        "synced",
        "inbox",
        "all",
        undefined,
        `Imported ${result.imported}, updated ${result.updated}, deleted ${result.deleted}, errors ${result.errors}`
      );
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("[inbox/sync] failed:", err);
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handleSync(req);
}
export async function POST(req: NextRequest) {
  return handleSync(req);
}
