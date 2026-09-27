import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";
import { CONSENT_COOKIE, parseConsent } from "@/lib/cookie-consent/consent";
import { apiError, apiOk } from "@/lib/api/response";
import { tooManyRequests } from "@/lib/api/rate-limit-response";

function referrerOrigin(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 2048) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

/**
 * POST — record a page view (public, fire-and-forget beacon). Fail-soft: never
 * throws back to the visitor; a failed insert just returns ok:false.
 */
export async function POST(req: NextRequest) {
  // Le gating UI ne suffit pas : un ancien onglet ou un appel direct ne doit
  // pas enregistrer de visite après refus/retrait du consentement.
  const consent = parseConsent(req.cookies.get(CONSENT_COOKIE)?.value);
  if (consent?.analytics !== true) return apiOk({ ok: false, skipped: true });
  try {
    const ip = getClientIp(req);
    const rl = await checkRateLimit(`pageview:${ip}`, { windowMs: 60_000, max: 60 });
    if (!rl.ok) return tooManyRequests({ limit: 60, resetAt: rl.resetAt });

    let body: { slug?: string; referrer?: string; device?: string };
    try {
      body = await req.json();
    } catch {
      return apiError(400, "Données invalides");
    }

    const slug = typeof body.slug === "string" ? body.slug.slice(0, 200) : "";
    if (!slug) return apiError(400, "Page manquante");
    const device =
      body.device === "mobile" || body.device === "tablet" || body.device === "desktop"
        ? body.device
        : undefined;
    // Les chemins, paramètres et fragments peuvent contenir des emails,
    // codes de reprise ou tokens : seule l'origine est utile aux statistiques.
    const referrer = referrerOrigin(body.referrer);

    await prisma.pageView.create({ data: { slug, device, referrer } });
    return apiOk({ ok: true }, { status: 201 });
  } catch {
    console.error("[page-views] POST failed");
    // Fail-soft for a tracking beacon — don't surface errors.
    return apiOk({ ok: false });
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
    return apiOk({ counts, total });
  } catch (err) {
    console.error("[page-views] GET failed:", err);
    return apiOk({ counts: {}, total: 0 });
  }
}
