import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth-check";
import { getSetting, setSetting, SETTING_KEYS } from "@/lib/app-settings";

/**
 * GET /api/inbox/settings — returns the messagerie-specific settings
 * (signature only, for now).
 *
 * PUT /api/inbox/settings — body: { signature?: string }
 */
export async function GET() {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  const signature = await getSetting(SETTING_KEYS.CONTACT_SIGNATURE);
  return NextResponse.json({ signature });
}

export async function PUT(request: NextRequest) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  const body = await request.json();
  if (typeof body.signature === "string") {
    await setSetting(SETTING_KEYS.CONTACT_SIGNATURE, body.signature, authCheck.user.email);
  }
  const signature = await getSetting(SETTING_KEYS.CONTACT_SIGNATURE);
  return NextResponse.json({ signature });
}
