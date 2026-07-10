import { NextRequest } from "next/server";
import { requireAdminAuth } from "@/lib/auth-check";
import { recordSnapshot } from "@/lib/health/checks";
import { apiOk } from "@/lib/api/response";

export const dynamic = "force-dynamic";

// Enregistre un instantané de santé. Déclencheur : Vercel Cron
// (Authorization: Bearer <CRON_SECRET>) OU un admin connecté (déclenchement
// manuel). Même convention que /api/inbox/sync.
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const isCron = cronSecret && bearer === cronSecret;

  if (!isCron) {
    const authCheck = await requireAdminAuth();
    if (!authCheck.isAuthorized) return authCheck.error;
  }

  await recordSnapshot();
  return apiOk({ ok: true });
}
