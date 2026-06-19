import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  loadLastScan,
  runDeadImageScan,
  saveScanResult,
} from "@/lib/media/dead-image-scan";

export const dynamic = "force-dynamic";
// Un scan ping N URLs externes en série de pool : on autorise large.
export const maxDuration = 120;

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role !== "admin") return null;
  return session;
}

/** GET — dernier scan persisté (AppSetting). */
export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const last = await loadLastScan();
  return NextResponse.json({ last });
}

/** POST — lance un nouveau scan, le persiste, et le renvoie. */
export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    // Origine de l'app → permet de vérifier aussi les URLs relatives
    // (fichiers servis localement, ex. /uploads/...).
    const baseUrl = new URL(request.url).origin;
    const result = await runDeadImageScan({ baseUrl });
    const updatedBy =
      session.user?.email ?? session.user?.name ?? null;
    await saveScanResult(result, updatedBy);
    return NextResponse.json({
      last: {
        result,
        updatedAt: result.scannedAt,
        updatedBy,
      },
    });
  } catch (error) {
    console.error("[dead-images] scan failed:", error);
    return NextResponse.json({ error: "Scan échoué" }, { status: 500 });
  }
}
