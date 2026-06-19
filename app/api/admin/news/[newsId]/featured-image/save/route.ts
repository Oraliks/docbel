import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/auth-check";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

const bodySchema = z.object({
  url: z.string().min(1).max(2048),
});

function json(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, { status, headers: JSON_HEADERS });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ newsId: string }> }
) {
  // 1. Admin guard
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  // 2. Parse and validate body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "URL invalide." }, 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "URL invalide." }, 400);
  }

  const { url } = parsed.data;
  const { newsId } = await params;

  // 3. Persist the featured image URL
  try {
    await prisma.news.update({
      where: { id: newsId },
      data: { image: url },
    });
    return json({ ok: true, url }, 200);
  } catch (err) {
    // 4. Prisma P2025 = record not found
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2025"
    ) {
      return json({ error: "Article introuvable." }, 404);
    }
    console.error("[featured-image save]", err);
    return json({ error: "Échec de l'enregistrement." }, 500);
  }
}
