import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";
import { trackBundleEvent } from "@/lib/bundles/analytics";
import { isClientBundleEvent } from "@/lib/bundles/analytics-events";

const BUNDLE_COOKIE = "beldoc-bundle-session";

const BodySchema = z.object({
  eventType: z.string(),
  bundleId: z.string().max(64).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/// Borne la metadata pour éviter l'abus : max 10 clés, valeurs string/number/bool,
/// strings tronquées à 200 caractères.
function sanitizeMetadata(
  input: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!input) return {};
  const out: Record<string, unknown> = {};
  let n = 0;
  for (const [k, v] of Object.entries(input)) {
    if (n >= 10) break;
    if (typeof v === "string") out[k] = v.slice(0, 200);
    else if (typeof v === "number" || typeof v === "boolean") out[k] = v;
    else continue;
    n++;
  }
  return out;
}

/// POST /api/bundles/events — ingestion des événements analytics client.
/// Best-effort : répond 204 même en cas de payload invalide (pas de bruit
/// d'erreur côté client). Rate-limité par IP. Non authentifié.
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`bundle-events:${ip}`, { windowMs: 60_000, max: 60 });
  if (!rl.ok) return new NextResponse(null, { status: 429 });

  let parsed: z.infer<typeof BodySchema>;
  try {
    parsed = BodySchema.parse(await req.json());
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  if (!isClientBundleEvent(parsed.eventType)) {
    return new NextResponse(null, { status: 204 });
  }

  const sessionId = (await cookies()).get(BUNDLE_COOKIE)?.value ?? null;

  await trackBundleEvent(parsed.eventType, {
    bundleId: parsed.bundleId ?? null,
    sessionId,
    source: "web",
    metadata: sanitizeMetadata(parsed.metadata),
  });

  return new NextResponse(null, { status: 204 });
}
