import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteStoredFile } from "@/lib/documents/storage";

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET || process.env.CRON_PURGE_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET non configuré" },
      { status: 500 }
    );
  }
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const customSecret = req.headers.get("x-cron-secret");
  if (bearer !== secret && customSecret !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const expired = await prisma.generatedDocument.findMany({
    where: { expiresAt: { lt: new Date() } },
    select: { id: true, outputFileId: true },
  });

  let deletedFiles = 0;
  for (const doc of expired) {
    if (doc.outputFileId) {
      await deleteStoredFile(doc.outputFileId).catch(() => {});
      deletedFiles++;
    }
  }
  await prisma.generatedDocument.deleteMany({
    where: { id: { in: expired.map((e) => e.id) } },
  });

  return NextResponse.json({
    purgedDocuments: expired.length,
    deletedFiles,
  });
}

// Vercel Cron envoie des requêtes GET, on délègue à POST.
export async function GET(req: NextRequest) {
  return POST(req);
}
