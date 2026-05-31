import { NextResponse } from "next/server";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { requireAdminAuth } from "@/lib/auth-check";

const json = { "Content-Type": "application/json; charset=utf-8" };

/// Liste les PDFs sources commités sous private/pdfs/ — utilisés pour le
/// seed des dossiers codés. Admin-only.
export async function GET() {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const dir = join(process.cwd(), "private", "pdfs");
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".pdf"));
  } catch {
    return NextResponse.json({ items: [], dir }, { headers: json });
  }
  files.sort();

  const items = files.map((name) => {
    const s = statSync(join(dir, name));
    return { name, sizeBytes: s.size, modifiedAt: s.mtime.toISOString() };
  });
  return NextResponse.json({ items, dir }, { headers: json });
}
