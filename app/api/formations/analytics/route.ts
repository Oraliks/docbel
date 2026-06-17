import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { trackEvent } from "@/lib/formations/analytics";
import { isFlagEnabled } from "@/lib/formations/module";

/** Beacon analytics côté client (events non sensibles uniquement). */
const schema = z.object({
  eventType: z.enum(["VIEW", "EXTERNAL_PAYMENT_CLICKED"]),
  trainingId: z.string().max(40).optional(),
  source: z.string().max(40).optional(),
});

export async function POST(req: Request) {
  if (!(await isFlagEnabled("analytics"))) return new NextResponse(null, { status: 204 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new NextResponse(null, { status: 204 });

  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  await trackEvent(parsed.data.eventType, {
    trainingId: parsed.data.trainingId ?? null,
    userId: session?.user?.id ?? null,
    source: parsed.data.source ?? "client",
  });
  return new NextResponse(null, { status: 204 });
}
