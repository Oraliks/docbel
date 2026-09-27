import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk } from "@/lib/api/response";

/// Purge des brouillons expirés (RGPD : les brouillons contiennent des
/// données nominatives → suppression dès expiration). Protégé par CRON_SECRET.
/// Vercel Cron (GET) délègue à POST.
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET || process.env.CRON_PURGE_SECRET;
  if (!secret) return apiError(500, "CRON_SECRET non configuré");

  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (bearer !== secret && req.headers.get("x-cron-secret") !== secret) {
    return apiError(403, "Forbidden");
  }

  const result = await prisma.pdfFormDraft.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return apiOk({ purgedDrafts: result.count });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
