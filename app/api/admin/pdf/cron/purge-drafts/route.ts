import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/// Purge des brouillons expirés (RGPD : les brouillons contiennent des
/// données nominatives → suppression dès expiration). Protégé par CRON_SECRET.
/// Vercel Cron (GET) délègue à POST.
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET || process.env.CRON_PURGE_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET non configuré" }, { status: 500 });

  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (bearer !== secret && req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await prisma.pdfFormDraft.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return NextResponse.json({ purgedDrafts: result.count });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
