import { NextRequest, NextResponse } from "next/server";
import { syncInbox } from "@/lib/inbox/imap";
import { requireAdminAuth } from "@/lib/auth-check";
import { logActivity } from "@/lib/activity-logger";

/**
 * Cron-triggered or admin-triggered IMAP sync.
 *
 * Auth: either
 *   - Vercel cron header (Authorization: Bearer <CRON_SECRET>) — for daily run
 *   - admin session — for on-demand sync from /admin/inbox
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
    const result = await syncInbox();
    if (result.imported > 0) {
      await logActivity(
        triggeredBy,
        "synced",
        "inbox",
        "INBOX",
        undefined,
        `Imported ${result.imported}, errors ${result.errors}`
      );
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("[inbox/sync] failed:", err);
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Vercel cron sends GET; admin UI sends POST. Both delegate to the same handler.
export async function GET(req: NextRequest) {
  return handleSync(req);
}
export async function POST(req: NextRequest) {
  return handleSync(req);
}
