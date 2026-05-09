import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";

export async function GET() {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  try {
    const emails = await prisma.inboxEmail.findMany({
      where: { isArchived: false },
      orderBy: { receivedAt: "desc" },
      take: 200,
      select: {
        id: true,
        fromAddress: true,
        fromName: true,
        subject: true,
        textBody: true,
        isRead: true,
        isArchived: true,
        isReplied: true,
        receivedAt: true,
        attachments: true,
      },
    });
    return NextResponse.json(emails);
  } catch (err) {
    console.error("[inbox] list failed:", err);
    return NextResponse.json({ error: "Failed to fetch inbox" }, { status: 500 });
  }
}
