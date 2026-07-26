import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { orgApplicationSchema } from "@/lib/formations/schemas";
import { createOrgApplication } from "@/lib/formations/org-signup";
import { blockIfFlagOff } from "@/lib/formations/module-guard";

export const runtime = "nodejs";
const json = { "Content-Type": "application/json; charset=utf-8" };

/**
 * POST /api/formations/organismes — demande publique d'inscription d'un
 * organisme de formation. Pas d'allowlist (contrairement à l'inscription
 * partenaire) : c'est la validation admin qui filtre.
 */
export async function POST(req: Request) {
  const blocked = await blockIfFlagOff("organizationCreation");
  if (blocked) return blocked;

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const rl = checkRateLimit(`org-apply:${ip}`, { windowMs: 60 * 60 * 1000, max: 5 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de demandes. Réessayez plus tard." },
      { status: 429, headers: json },
    );
  }

  const parsed = orgApplicationSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", issues: parsed.error.flatten() },
      { status: 400, headers: json },
    );
  }

  const result = await createOrgApplication(parsed.data);
  if (!result.ok) {
    const status = result.error.code === "internal" ? 500 : 409;
    return NextResponse.json({ error: result.error.message }, { status, headers: json });
  }

  return NextResponse.json(
    {
      ok: true,
      slug: result.data.slug,
      enterpriseVerified: result.data.enterpriseVerified,
      verificationMessage: result.data.verificationMessage,
    },
    { status: 201, headers: json },
  );
}
