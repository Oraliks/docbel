import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { checkRateLimit, getClientIp } from "@/lib/documents/rate-limit";

/**
 * POST — record a page view (public, fire-and-forget beacon). Fail-soft: never
 * throws back to the visitor; a failed insert just returns ok:false.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`pageview:${ip}`, { windowMs: 60_000, max: 60 });
    if (!rl.ok) return NextResponse.json({ ok: false }, { status: 429 });

    let body: { slug?: string; referrer?: string; device?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const slug = typeof body.slug === "string" ? body.slug.slice(0, 200) : "";
    if (!slug) return NextResponse.json({ ok: false }, { status: 400 });
    const device =
      body.device === "mobile" || body.device === "tablet" || body.device === "desktop"
        ? body.device
        : undefined;
    const referrer =
      typeof body.referrer === "string" ? body.referrer.slice(0, 500) || undefined : undefined;

    await prisma.pageView.create({ data: { slug, device, referrer } });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("[page-views] POST failed:", err);
    // Fail-soft for a tracking beacon — don't surface errors.
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

/**
 * GET — aggregated view counts per slug (admin only). Returns { counts, total }.
 */
export async function GET() {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;
  try {
    const grouped = await prisma.pageView.groupBy({
      by: ["slug"],
      _count: { _all: true },
    });
    const counts: Record<string, number> = {};
    let total = 0;
    for (const g of grouped) {
      counts[g.slug] = g._count._all;
      total += g._count._all;
    }
    return NextResponse.json({ counts, total });
  } catch (err) {
    console.error("[page-views] GET failed:", err);
    return NextResponse.json({ counts: {}, total: 0 });
  }
}
