import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/auth-check";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";
import { buildHeroIllustrationPrompt } from "@/lib/ai/hero-illustration-prompt";
import { generateImage, OpenAIImageError } from "@/lib/ai/openai-image";
import { saveFeaturedImage } from "@/lib/storage/article-featured-images";

export const runtime = "nodejs";
export const maxDuration = 120;

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

const subjectSchema = z.object({
  subject: z.string().min(3, "Sujet trop court").max(280, "Sujet trop long"),
});

function json(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, { status, headers: JSON_HEADERS });
}

export async function POST(req: NextRequest) {
  // 1. Admin guard
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  // 2. Rate limit: 5 generations per minute per user
  const rateLimitKey = `hero-illustration:${auth.user?.id ?? getClientIp(req)}`;
  const rateLimit = checkRateLimit(rateLimitKey, { windowMs: 60_000, max: 5 });
  if (!rateLimit.ok) {
    return json({ error: "Trop de générations. Réessayez dans une minute." }, 429);
  }

  // 3. Parse + validate JSON body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Sujet requis (3 à 280 caractères)." }, 400);
  }

  const parsed = subjectSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "Sujet requis (3 à 280 caractères)." }, 400);
  }

  const { subject } = parsed.data;

  // Variation aléatoire pour DIVERSIFIER les générations d'un même thème.
  // Sans ça, un prompt très contraint produit quasi toujours le même rendu.
  const VARIATIONS = [
    "un conseiller accueille une personne à son bureau, vue de 3/4",
    "deux personnes regardent ensemble un ordinateur portable, ambiance d'entraide",
    "une personne est accompagnée à un guichet d'accueil, silhouettes douces en arrière-plan",
    "un petit groupe autour d'une table de bureau avec des dossiers",
    "une personne tend un document à une autre, geste d'accompagnement",
    "bureau ouvert et lumineux, quelques personnages à différentes distances",
    "un conseiller souriant explique quelque chose, cadrage rapproché et chaleureux",
    "une personne travaille sereinement à un bureau, plante et laptop, lumière douce",
  ];
  const variationHint =
    VARIATIONS[Math.floor(Math.random() * VARIATIONS.length)];

  // 4. Generate image and persist — no association to any model here
  try {
    const prompt = buildHeroIllustrationPrompt(subject, variationHint);
    const raw = await generateImage({ prompt, size: "1024x1024" });
    const url = await saveFeaturedImage(raw, "png");
    return json({ url }, 200);
  } catch (err) {
    // 5. Map OpenAI errors to safe HTTP responses — never leak keys, prompts, or traces
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
    console.error("[hero-illustration generate]", err);
    return json({ error: "La génération a échoué. Réessayez." }, 500);
  }
}
