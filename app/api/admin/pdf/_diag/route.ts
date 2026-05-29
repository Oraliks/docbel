import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth-check";

/// Diagnostic admin : vérifie que les variables d'env critiques pour le
/// module PDF Forms atteignent bien la fonction serverless.
/// À supprimer une fois la configuration validée en prod.
export async function GET() {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  return NextResponse.json({
    vercel: process.env.VERCEL ?? null,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    region: process.env.VERCEL_REGION ?? null,
    hasBlobToken: !!process.env.BLOB_READ_WRITE_TOKEN,
    blobTokenLength: process.env.BLOB_READ_WRITE_TOKEN?.length ?? 0,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    timestamp: new Date().toISOString(),
  });
}
