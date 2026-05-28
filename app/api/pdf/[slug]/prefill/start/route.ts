import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { isItsmeConfigured, buildAuthorizationUrl } from "@/lib/pdf-forms/integrations/itsme";

/// GET — démarre le flux de pré-remplissage itsme (redirection OIDC).
/// 503 tant qu'itsme n'est pas configuré (accès partenaire en attente).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if (!isItsmeConfigured()) {
    return NextResponse.json(
      { error: "Pré-remplissage itsme bientôt disponible" },
      { status: 503 }
    );
  }

  const state = randomBytes(16).toString("base64url");
  const nonce = randomBytes(16).toString("base64url");
  const store = await cookies();
  const opts = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 600 };
  store.set("itsme_state", state, opts);
  store.set("itsme_nonce", nonce, opts);
  store.set("itsme_slug", slug, opts);

  return NextResponse.redirect(buildAuthorizationUrl({ state, nonce }));
}
