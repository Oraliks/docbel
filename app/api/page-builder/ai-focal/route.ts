/**
 * POST /api/page-builder/ai-focal
 *
 * Suggère le POINT FOCAL d'une image (le sujet principal) sous forme de
 * coordonnées `{ focalX, focalY }` en pourcentage (0-100), destinées à piloter
 * l'`object-position` du bloc Image du page-builder (cf. components/page-blocks/
 * media/image.tsx). Entrée : `{ imageUrl: string }`.
 *
 * VISION — note importante :
 *   Le wrapper partagé `callClaude` (lib/chomage-ia/anthropic.ts) est TEXTE SEUL :
 *   son type `messages` est `{ role; content: string }[]`, donc il ne peut pas
 *   transporter de blocs image (vision). Plutôt qu'un simple fallback statique,
 *   cette route appelle DIRECTEMENT l'API Anthropic Messages v1 avec un bloc
 *   image (base64) — les modèles Claude 4.5 (Sonnet/Haiku) sont multimodaux. On
 *   réutilise la même clé/version/URL que le wrapper, sans modifier `anthropic.ts`.
 *
 * FAIL-SOFT à chaque étape : si la clé manque → `{ aiDisabled: true }` (200) ;
 * si le téléchargement de l'image, l'appel modèle ou le parsing échoue → on
 * renvoie le centre `{ focalX: 50, focalY: 50, fallback: true }` (200) afin de
 * ne JAMAIS casser l'éditeur. Admin-only, rate-limité.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/auth-check";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";
import { hasAnthropicKey } from "@/lib/chomage-ia/anthropic";
import {
  ANTHROPIC_API_URL,
  ANTHROPIC_API_VERSION,
  CLAUDE_MODELS,
} from "@/lib/chomage-ia/models";

const AiFocalSchema = z.object({
  imageUrl: z.string().min(1).max(4096),
});

/** Centre par défaut — réponse de repli quand la vision n'aboutit pas. */
const CENTER = { focalX: 50, focalY: 50 } as const;

/** Taille max de l'image téléchargée (8 Mo) — au-delà on retombe au centre. */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** Délai max pour le téléchargement de l'image. */
const FETCH_TIMEOUT_MS = 15_000;

/** Délai max pour l'appel vision. */
const VISION_TIMEOUT_MS = 30_000;

/** Types image acceptés par l'API vision d'Anthropic. */
const SUPPORTED_MEDIA = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const FOCAL_SYSTEM = `Tu es un assistant de cadrage photo. On te donne UNE image. Tu identifies le SUJET PRINCIPAL (le point d'intérêt visuel principal : visage, personne, produit, objet ou élément central) et tu renvoies sa position comme un point focal.

Réponds UNIQUEMENT avec un objet JSON valide de la forme {"focalX":<entier 0-100>,"focalY":<entier 0-100>}, sans aucun texte autour ni bloc de code Markdown.

Convention de coordonnées (comme object-position en CSS) :
- focalX : position horizontale en pourcentage. 0 = bord gauche, 50 = centre, 100 = bord droit.
- focalY : position verticale en pourcentage. 0 = haut, 50 = centre, 100 = bas.

Règles :
- Vise le centre du sujet principal. Pour un portrait, vise le visage (souvent focalY plutôt bas, vers 20-40).
- S'il n'y a pas de sujet net ou si l'image est une texture/un motif uniforme, renvoie {"focalX":50,"focalY":50}.
- Les deux valeurs sont des ENTIERS entre 0 et 100 inclus.`;

/**
 * Borne une valeur numérique dans [0, 100] et l'arrondit à l'entier. Renvoie
 * `null` si l'entrée n'est pas un nombre fini.
 */
function clampPercent(n: unknown): number | null {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Extrait `{ focalX, focalY }` de la réponse texte du modèle. Tolère un
 * préambule / des fences Markdown malgré la consigne. Renvoie `null` si rien
 * d'exploitable.
 */
function parseFocal(raw: string): { focalX: number; focalY: number } | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let obj: unknown;
  try {
    obj = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!obj || typeof obj !== "object") return null;
  const focalX = clampPercent((obj as Record<string, unknown>).focalX);
  const focalY = clampPercent((obj as Record<string, unknown>).focalY);
  if (focalX == null || focalY == null) return null;
  return { focalX, focalY };
}

/**
 * Télécharge l'image (URL absolue OU chemin relatif de l'app) et la renvoie en
 * base64 avec son media-type. Renvoie `null` en cas d'échec / type non supporté
 * / taille excessive — l'appelant retombera alors au centre.
 */
async function fetchImageAsBase64(
  imageUrl: string,
  req: NextRequest
): Promise<{ data: string; mediaType: string } | null> {
  // Les images de la bibliothèque sont servies en relatif (ex.
  // /api/files/<id>/download) : on les résout sur l'origine de la requête.
  let absolute: string;
  try {
    absolute = new URL(imageUrl, req.nextUrl.origin).toString();
  } catch {
    return null;
  }

  // On n'accepte que http(s) (pas de file://, data: déjà géré côté client, etc.).
  if (!/^https?:\/\//i.test(absolute)) return null;

  let res: Response;
  try {
    res = await fetch(absolute, {
      // Propager le cookie de session pour les images privées servies par l'app.
      headers: { cookie: req.headers.get("cookie") ?? "" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const contentType = (res.headers.get("content-type") ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (!SUPPORTED_MEDIA.has(contentType)) return null;

  const buf = await res.arrayBuffer().catch(() => null);
  if (!buf) return null;
  if (buf.byteLength === 0 || buf.byteLength > MAX_IMAGE_BYTES) return null;

  return {
    data: Buffer.from(buf).toString("base64"),
    mediaType: contentType,
  };
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const ip = getClientIp(req);
  const rl = checkRateLimit(`pagebuilder:ai-focal:${ip}`, {
    windowMs: 60_000,
    max: 20,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes — réessayez dans une minute" },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let parsed: z.infer<typeof AiFocalSchema>;
  try {
    parsed = AiFocalSchema.parse(body);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof z.ZodError
            ? err.issues[0]?.message || "Validation error"
            : "Validation error",
      },
      { status: 400 }
    );
  }

  // Fail-soft : pas de clé → l'IA est désactivée (le client masque/désactive le bouton).
  if (!hasAnthropicKey()) {
    return NextResponse.json({ aiDisabled: true }, { status: 200 });
  }

  // Téléchargement de l'image. Échec → centre (fallback gracieux, 200).
  const image = await fetchImageAsBase64(parsed.imageUrl, req);
  if (!image) {
    return NextResponse.json({ ...CENTER, fallback: true }, { status: 200 });
  }

  // Appel vision DIRECT à l'API Anthropic (callClaude est texte seul).
  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY as string,
        "anthropic-version": ANTHROPIC_API_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: CLAUDE_MODELS.haiku,
        max_tokens: 60,
        system: FOCAL_SYSTEM,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: image.mediaType,
                  data: image.data,
                },
              },
              {
                type: "text",
                text: "Donne le point focal (sujet principal) de cette image au format JSON {\"focalX\":…,\"focalY\":…}.",
              },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(VISION_TIMEOUT_MS),
    });

    if (!res.ok) {
      // API saturée / erreur amont : on ne casse rien, on retombe au centre.
      console.warn("[ai-focal] anthropic vision HTTP", res.status);
      return NextResponse.json({ ...CENTER, fallback: true }, { status: 200 });
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = (data.content ?? [])
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("")
      .trim();

    const focal = parseFocal(text);
    if (!focal) {
      return NextResponse.json({ ...CENTER, fallback: true }, { status: 200 });
    }

    return NextResponse.json(focal, { status: 200 });
  } catch (err) {
    console.error("[ai-focal] error:", err);
    return NextResponse.json({ ...CENTER, fallback: true }, { status: 200 });
  }
}
