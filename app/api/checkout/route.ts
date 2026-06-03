import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/documents/rate-limit";

/**
 * Stripe Checkout session creator for the page-builder "checkout" action.
 *
 * Uses the Stripe REST API directly via fetch (no SDK dependency). Returns
 * `{ url }` to redirect the buyer to. Graceful 503 if STRIPE_SECRET_KEY isn't
 * configured, so the action degrades cleanly (the client shows a toast).
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`pagebuilder:checkout:${ip}`, {
    windowMs: 60_000,
    max: 10,
  });
  if (!rl.ok) {
    return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 });
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return NextResponse.json(
      { error: "Paiement non configuré (STRIPE_SECRET_KEY)" },
      { status: 503 }
    );
  }

  let body: { priceId?: string; mode?: string; quantity?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const priceId = typeof body.priceId === "string" ? body.priceId.trim() : "";
  if (!priceId || !/^price_[A-Za-z0-9]+$/.test(priceId)) {
    return NextResponse.json({ error: "priceId invalide" }, { status: 400 });
  }
  const mode = body.mode === "subscription" ? "subscription" : "payment";
  const quantity =
    typeof body.quantity === "number" && body.quantity > 0
      ? Math.min(Math.floor(body.quantity), 99)
      : 1;

  const origin =
    request.headers.get("origin") ||
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL ||
    process.env.BETTER_AUTH_URL ||
    "";

  const params = new URLSearchParams();
  params.set("mode", mode);
  params.set("line_items[0][price]", priceId);
  params.set("line_items[0][quantity]", String(quantity));
  params.set("success_url", `${origin}/?checkout=success`);
  params.set("cancel_url", `${origin}/?checkout=cancel`);

  try {
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const data = (await res.json().catch(() => ({}))) as {
      url?: string;
      error?: { message?: string };
    };
    if (!res.ok) {
      console.error("[checkout] Stripe error:", data?.error?.message || res.status);
      return NextResponse.json(
        { error: "Échec de la création du paiement" },
        { status: 502 }
      );
    }
    return NextResponse.json({ url: data.url });
  } catch (err) {
    console.error("[checkout] failed:", err);
    return NextResponse.json({ error: "Échec du paiement" }, { status: 502 });
  }
}
