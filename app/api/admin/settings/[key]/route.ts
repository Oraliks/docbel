import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth-check";
import { SETTING_KEYS, SettingKey, getSetting, setSetting, getDefault } from "@/lib/app-settings";

const VALID_KEYS = new Set<string>(Object.values(SETTING_KEYS));

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { key } = await params;
  if (!VALID_KEYS.has(key)) {
    return NextResponse.json({ error: "Clé inconnue" }, { status: 404 });
  }
  const k = key as SettingKey;
  const value = await getSetting(k);
  const defaultValue = getDefault(k);
  return NextResponse.json({ key, value, default: defaultValue });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { key } = await params;
  if (!VALID_KEYS.has(key)) {
    return NextResponse.json({ error: "Clé inconnue" }, { status: 404 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.value !== "string") {
    return NextResponse.json({ error: "value (string) requis" }, { status: 400 });
  }
  if (body.value.length > 50_000) {
    return NextResponse.json({ error: "Texte trop long (max 50000 chars)" }, { status: 413 });
  }

  await setSetting(key as SettingKey, body.value, auth.user?.id || null);
  return NextResponse.json({ ok: true });
}
