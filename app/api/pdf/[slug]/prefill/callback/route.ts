import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCodeForPrefill } from "@/lib/pdf-forms/integrations/itsme";

/// GET — callback OIDC itsme. Vérifie le state, échange le code contre les
/// claims, puis redirige vers le formulaire. Les données de prefill seront
/// transmises via cookie court (à finaliser avec l'accès itsme réel).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const store = await cookies();
  const expectedState = store.get("itsme_state")?.value;
  const back = (status: string) => NextResponse.redirect(new URL(`/pdf/${slug}?prefill=${status}`, req.url));

  if (!code || !state || state !== expectedState) {
    return back("error");
  }

  try {
    const prefill = await exchangeCodeForPrefill(code);
    // TODO(itsme): persister `prefill` dans un cookie court signé, lu par le
    // front au montage pour pré-remplir le formulaire. Bloqué sur l'accès itsme.
    void prefill;
    return back("ok");
  } catch {
    return back("unavailable");
  } finally {
    store.delete("itsme_state");
    store.delete("itsme_nonce");
    store.delete("itsme_slug");
  }
}
