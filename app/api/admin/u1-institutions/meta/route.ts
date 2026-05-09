import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth-check";
import { logActivity } from "@/lib/activity-logger";
import { getSetting, setSetting, SETTING_KEYS } from "@/lib/app-settings";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET() {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;
  const lastUpdated = await getSetting(SETTING_KEYS.U1_INSTITUTIONS_LAST_UPDATED);
  return NextResponse.json({ lastUpdated }, { headers: jsonHeaders });
}

export async function PATCH(req: NextRequest) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: jsonHeaders }
    );
  }

  const raw = (body ?? {}) as Record<string, unknown>;
  const lastUpdated = typeof raw.lastUpdated === "string" ? raw.lastUpdated.trim() : "";

  if (!DATE_RE.test(lastUpdated)) {
    return NextResponse.json(
      { error: "Date invalide (format attendu : YYYY-MM-DD)" },
      { status: 400, headers: jsonHeaders }
    );
  }

  const parsed = new Date(`${lastUpdated}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return NextResponse.json(
      { error: "Date invalide" },
      { status: 400, headers: jsonHeaders }
    );
  }

  await setSetting(SETTING_KEYS.U1_INSTITUTIONS_LAST_UPDATED, lastUpdated, authCheck.user.id);
  await logActivity(
    authCheck.user.name,
    "updated",
    "setting",
    "Date de mise à jour des institutions U1",
    SETTING_KEYS.U1_INSTITUTIONS_LAST_UPDATED,
    `→ ${lastUpdated}`
  );

  return NextResponse.json({ lastUpdated }, { headers: jsonHeaders });
}
