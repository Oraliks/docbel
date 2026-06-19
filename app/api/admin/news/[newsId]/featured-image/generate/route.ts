import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/auth-check";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";
import { buildFeaturedImagePrompt } from "@/lib/ai/featured-image-prompt";
import {
  generateImage,
  OpenAIImageError,
} from "@/lib/ai/openai-image";
import { postProcessFeaturedImage } from "@/lib/ai/featured-image-postprocess";
import { saveFeaturedImage } from "@/lib/storage/article-featured-images";

export const runtime = "nodejs";
export const maxDuration = 120;

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
] as const;

const summarySchema = z.string().min(1).max(280);

function json(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, { status, headers: JSON_HEADERS });
}

// La génération ne dépend pas de l'id d'article (elle renvoie une URL ;
// la persistance se fait via la route /save ou le champ image de l'éditeur).
export async function POST(req: NextRequest) {
  // 1. Admin guard
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  // 2. Rate limit: 5 generations per minute per user
  const rateLimitKey = `featured-gen:${auth.user?.id ?? getClientIp(req)}`;
  const rateLimit = checkRateLimit(rateLimitKey, {
    windowMs: 60_000,
    max: 5,
  });
  if (!rateLimit.ok) {
    return json(
      { error: "Trop de générations. Réessayez dans une minute." },
      429
    );
  }

  // 3. Parse form data
  const fd = await req.formData();
  const summary = (fd.get("summary") as string ?? "").trim();
  const title = fd.get("title") ? String(fd.get("title")) : null;
  const file = fd.get("referenceImage");

  // 4. Validate summary
  const parsed = summarySchema.safeParse(summary);
  if (!parsed.success) {
    return json(
      { error: "Résumé requis (280 caractères maximum)." },
      400
    );
  }

  // 5. Reference image handling
  let referenceImage: { buffer: Buffer; mimeType: string } | null = null;
  if (file instanceof File && file.size > 0) {
    if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
      return json(
        { error: "Image de référence : PNG, JPG ou WebP uniquement." },
        400
      );
    }
    if (file.size > 8 * 1024 * 1024) {
      return json(
        { error: "Image de référence trop lourde (8 Mo maximum)." },
        400
      );
    }
    referenceImage = {
      buffer: Buffer.from(await file.arrayBuffer()),
      mimeType: file.type,
    };
  }

  // 6. Generate, post-process, and save
  try {
    const prompt = buildFeaturedImagePrompt(summary);
    const raw = await generateImage({ prompt, referenceImage: referenceImage ?? null });
    const { buffer, ext } = await postProcessFeaturedImage(raw, { title });
    const url = await saveFeaturedImage(buffer, ext);
    return json({ url }, 200);
  } catch (err) {
    // 7. Map OpenAI errors to safe HTTP responses — never leak keys, prompts, or traces
    if (err instanceof OpenAIImageError) {
      switch (err.kind) {
        case "config":
          return json({ error: "Service d'image non configuré." }, 503);
        case "rate":
          return json({ error: "La génération d'image a échoué." }, 429);
        case "invalid":
          return json({ error: "La génération d'image a échoué." }, 400);
        case "upstream":
        default:
          return json({ error: "La génération d'image a échoué." }, 502);
      }
    }
    console.error("[featured-image generate]", err);
    return json({ error: "La génération a échoué. Réessayez." }, 500);
  }
}
