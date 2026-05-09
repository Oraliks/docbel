import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { setFlaggedFlag, type Folder } from "@/lib/inbox/imap";

const VALID: Folder[] = ["INBOX", "SENT", "SPAM", "ARCHIVE", "TRASH"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  const { id } = await params;
  const body = await request.json();
  const isFlagged = Boolean(body.isFlagged);

  const email = await prisma.inboxEmail.findUnique({ where: { id } });
  if (!email) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }
  if (!VALID.includes(email.folder as Folder)) {
    return NextResponse.json({ error: "Invalid folder" }, { status: 400 });
  }

  try {
    await setFlaggedFlag(email.folder as Folder, email.uid, isFlagged);
    const updated = await prisma.inboxEmail.update({
      where: { id },
      data: { isFlagged },
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[inbox/star] failed:", err);
    const message = err instanceof Error ? err.message : "Action failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
