import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { put } from "@vercel/blob";
import { prisma, withDbRetry } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { logActivity } from "@/lib/activity-logger";
import { scheduleAutoTranslate } from "@/lib/i18n/auto-translate";

/**
 * /api/admin/calculators/[slug]/assets
 *
 *  GET  → liste des assets attachés au calc (admin only)
 *  POST → crée un asset
 *         - multipart/form-data : upload PDF/image vers Vercel Blob
 *         - application/json    : URL externe (kind="url")
 *
 * L'auth admin est obligatoire. Pour les uploads on impose :
 *   - MIME type PDF (application/pdf) ou image (image/png|jpeg|webp)
 *   - Taille max 10 MB
 *   - BLOB_READ_WRITE_TOKEN configuré (sinon erreur 503 explicite)
 *
 * Note : on ne pose pas de FK sur Tool.slug — c'est volontaire pour rendre
 * le seed plus simple et tolérer les calculs sans entrée Tool en DB.
 */

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

const ALLOWED_MIME = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const VALID_KINDS = ["pdf", "url", "image"] as const;
type AssetKind = (typeof VALID_KINDS)[number];

const VALID_CATEGORIES = [
  "workbonus",
  "precompte",
  "css",
  "atn",
  "general",
] as const;

const createUrlSchema = z.object({
  kind: z.literal("url"),
  label: z.string().trim().min(2).max(200),
  description: z.string().trim().max(800).optional().nullable(),
  url: z.string().trim().url().max(2000),
  category: z.string().trim().max(40).optional().nullable(),
  year: z.number().int().min(1990).max(2100).optional().nullable(),
  order: z.number().int().min(0).max(9999).optional().nullable(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { slug } = await params;
  const assets = await withDbRetry(() =>
    prisma.calculatorAsset.findMany({
      where: { slug },
      orderBy: [{ order: "asc" }, { uploadedAt: "desc" }],
    }),
  );
  return NextResponse.json({ assets }, { headers: jsonHeaders });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { slug } = await params;
  const contentType = req.headers.get("content-type") ?? "";

  // ---------- Cas 1 : URL externe (JSON) -----------------------------------
  if (contentType.includes("application/json")) {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400, headers: jsonHeaders },
      );
    }

    const parsed = createUrlSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Body invalide", details: parsed.error.flatten() },
        { status: 400, headers: jsonHeaders },
      );
    }

    const created = await withDbRetry(() =>
      prisma.calculatorAsset.create({
        data: {
          slug,
          kind: "url",
          label: parsed.data.label,
          description: parsed.data.description ?? null,
          url: parsed.data.url,
          category: parsed.data.category ?? null,
          year: parsed.data.year ?? null,
          order: parsed.data.order ?? 0,
          uploadedBy: auth.user.id,
        },
      }),
    );

    // Auto-traduction NL/EN (label + description, statut "ia", à relire).
    scheduleAutoTranslate("CalculatorAsset", created.id);

    await logActivity(
      auth.user.email,
      "created",
      "file",
      `calc-asset:${slug}:${parsed.data.label}`,
      created.id,
      `kind=url category=${parsed.data.category ?? "—"}`,
    );

    return NextResponse.json({ asset: created }, { status: 201, headers: jsonHeaders });
  }

  // ---------- Cas 2 : Upload PDF / image (multipart) -----------------------
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Content-Type doit être application/json ou multipart/form-data" },
      { status: 400, headers: jsonHeaders },
    );
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        error:
          "Upload désactivé : BLOB_READ_WRITE_TOKEN n'est pas configuré. " +
          "Ajoute-le dans .env.local pour activer Vercel Blob, ou utilise une URL externe.",
      },
      { status: 503, headers: jsonHeaders },
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Multipart form invalide" },
      { status: 400, headers: jsonHeaders },
    );
  }

  const file = formData.get("file");
  const kindRaw = String(formData.get("kind") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const yearRaw = String(formData.get("year") ?? "").trim();
  const orderRaw = String(formData.get("order") ?? "").trim();

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Champ 'file' manquant" },
      { status: 400, headers: jsonHeaders },
    );
  }

  if (label.length < 2 || label.length > 200) {
    return NextResponse.json(
      { error: "Label requis (entre 2 et 200 caractères)" },
      { status: 400, headers: jsonHeaders },
    );
  }

  // Pour un upload, on n'accepte que pdf ou image (l'URL externe passe par
  // un autre code path, sans multipart). Si kindRaw est "url" ou autre, on
  // refuse explicitement.
  if (kindRaw !== "pdf" && kindRaw !== "image") {
    return NextResponse.json(
      { error: "kind doit être 'pdf' ou 'image' pour un upload" },
      { status: 400, headers: jsonHeaders },
    );
  }
  const kind: AssetKind = kindRaw;
  if (!VALID_KINDS.includes(kind)) {
    return NextResponse.json(
      { error: "kind invalide" },
      { status: 400, headers: jsonHeaders },
    );
  }

  if (!ALLOWED_MIME.includes(file.type as (typeof ALLOWED_MIME)[number])) {
    return NextResponse.json(
      {
        error: `Type MIME non supporté (${file.type}). Autorisés : ${ALLOWED_MIME.join(", ")}`,
      },
      { status: 400, headers: jsonHeaders },
    );
  }

  // Cohérence kind ↔ MIME
  if (kind === "pdf" && file.type !== "application/pdf") {
    return NextResponse.json(
      { error: "kind=pdf exige un fichier application/pdf" },
      { status: 400, headers: jsonHeaders },
    );
  }
  if (kind === "image" && !file.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "kind=image exige un fichier image/*" },
      { status: 400, headers: jsonHeaders },
    );
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: `Fichier trop volumineux (max ${MAX_SIZE_BYTES / 1024 / 1024} MB)` },
      { status: 400, headers: jsonHeaders },
    );
  }

  // Upload vers Vercel Blob — dossier public/calculators/<slug>/
  const safeName =
    file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "asset";
  const key = `public/calculators/${slug}/${Date.now()}-${safeName}`;

  let blobUrl: string;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const blob = await put(key, buffer, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
    });
    blobUrl = blob.url;
  } catch (err) {
    console.error("[calculator-assets] Vercel Blob upload failed:", err);
    return NextResponse.json(
      { error: "Échec de l'upload vers Vercel Blob" },
      { status: 502, headers: jsonHeaders },
    );
  }

  const year = yearRaw ? Number.parseInt(yearRaw, 10) : null;
  const order = orderRaw ? Number.parseInt(orderRaw, 10) : 0;
  const validCategory =
    category && VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number])
      ? category
      : category || null;

  const created = await withDbRetry(() =>
    prisma.calculatorAsset.create({
      data: {
        slug,
        kind,
        label,
        description: description.length > 0 ? description : null,
        url: blobUrl,
        category: validCategory,
        fileSize: file.size,
        mimeType: file.type,
        year: Number.isFinite(year as number) ? year : null,
        order: Number.isFinite(order) ? order : 0,
        uploadedBy: auth.user.id,
      },
    }),
  );

  // Auto-traduction NL/EN (label + description, statut "ia", à relire).
  scheduleAutoTranslate("CalculatorAsset", created.id);

  await logActivity(
    auth.user.email,
    "created",
    "file",
    `calc-asset:${slug}:${label}`,
    created.id,
    `kind=${kind} size=${file.size} mime=${file.type}`,
  );

  return NextResponse.json({ asset: created }, { status: 201, headers: jsonHeaders });
}
