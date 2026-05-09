import { NextRequest, NextResponse } from "next/server";
import { headers, cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "beldoc-bundle-session";

async function resolveSessionId(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(COOKIE_NAME)?.value;
  if (existing && existing.length >= 10) return existing;
  const fresh = `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  cookieStore.set(COOKIE_NAME, fresh, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    httpOnly: false,
    sameSite: "lax",
  });
  return fresh;
}

/// GET → retourne le run en cours (ou null) pour un bundle.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id || null;
  const sessionId = await resolveSessionId();

  const where = userId ? { bundleId: id, userId, status: "in_progress" } : { bundleId: id, sessionId, status: "in_progress" };
  const run = await prisma.bundleRun.findFirst({
    where,
    orderBy: { startedAt: "desc" },
  });

  return NextResponse.json(run);
}

/// POST → démarre (ou récupère) un run pour ce bundle.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const bundle = await prisma.documentBundle.findUnique({ where: { id } });
  if (!bundle || !bundle.active) {
    return NextResponse.json({ error: "Bundle indisponible" }, { status: 404 });
  }

  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id || null;
  const sessionId = await resolveSessionId();

  // Récupérer un run existant in_progress pour cet utilisateur/session
  const existingWhere = userId
    ? { bundleId: id, userId, status: "in_progress" }
    : { bundleId: id, sessionId, status: "in_progress" };
  const existing = await prisma.bundleRun.findFirst({ where: existingWhere });
  if (existing) return NextResponse.json(existing);

  const run = await prisma.bundleRun.create({
    data: { bundleId: id, userId, sessionId },
  });
  return NextResponse.json(run, { status: 201 });
}
