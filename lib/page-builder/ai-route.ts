/**
 * Wrapper partagé pour les routes IA du page-builder (`app/api/page-builder/ai-*`).
 *
 * Factorise la « plomberie » dupliquée par les 6 routes (ai-assist, ai-audit,
 * ai-generate, ai-copilot, ai-repeater, ai-focal), DANS L'ORDRE EXACT d'origine :
 *
 *   1. `requireAdminAuth`        → early-return `auth.error` (401/403)
 *   2. rate-limit                → 429 si dépassé
 *   3. `req.json()`              → 400 "Invalid JSON" si le corps n'est pas du JSON
 *   4. `schema.parse(body)`      → 400 avec `ZodError.issues[0].message`
 *   5. `hasAnthropicKey()`       → 200 `{ aiDisabled: true, error }` (fail-soft)
 *   6. `handler({ input, req, userId })`, enveloppé d'un try/catch qui gère
 *      `AnthropicError` (429 → message saturation, sinon HTTP n) + un 502 générique
 *      (avec `console.error("[name] error:", err)`).
 *
 * Le comportement externe (formes de réponse, codes HTTP, fail-soft) est
 * STRICTEMENT identique à l'implémentation manuelle remplacée — voir chaque route.
 *
 * CORRECTIF FIX-6 (rate-limit) : la clé de rate-limit est désormais dérivée de
 * l'identifiant utilisateur authentifié (`pagebuilder:${name}:${user.id}`) et
 * non plus de l'IP cliente (X-Forwarded-For, spoofable). Les routes étant
 * admin-only, l'`user.id` est toujours disponible à ce stade.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/auth-check";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { hasAnthropicKey, AnthropicError } from "@/lib/chomage-ia/anthropic";

/** Contexte fourni au handler métier une fois toute la plomberie passée. */
export interface AiRouteContext<TInput> {
  /** Corps de requête validé par le schéma Zod de la route. */
  input: TInput;
  /** Requête brute (utile pour origin/cookies/headers — cf. ai-focal). */
  req: NextRequest;
  /** Identifiant de l'admin authentifié (clé de rate-limit, audit…). */
  userId: string;
}

export interface AiRouteConfig<TSchema extends z.ZodTypeAny> {
  /**
   * Nom court de la route (ex. "ai-assist"). Sert au préfixe de clé de
   * rate-limit ET au tag de `console.error` du bloc catch.
   */
  name: string;
  /** Schéma Zod de validation du corps de requête. */
  schema: TSchema;
  /**
   * Fenêtre / quota de rate-limit. Mêmes valeurs par route qu'avant le refactor.
   * Défaut : 60 s / 20 requêtes (la valeur la plus courante parmi les routes).
   */
  rateLimit?: { windowMs?: number; max?: number };
}

/**
 * Construit un handler `POST(req)` Next.js à partir d'une config + d'un handler
 * métier. Le handler métier ne reçoit que des entrées déjà validées et n'a plus
 * à se soucier de l'auth, du rate-limit, du parsing, de la clé IA ni du mapping
 * d'erreurs Anthropic.
 *
 * Le handler peut renvoyer soit une `NextResponse` (cas nominal — il contrôle le
 * code HTTP et la forme), ce qui couvre tous les usages des routes existantes.
 */
export function withAiRoute<TSchema extends z.ZodTypeAny>(
  config: AiRouteConfig<TSchema>,
  handler: (ctx: AiRouteContext<z.infer<TSchema>>) => Promise<NextResponse>
): (req: NextRequest) => Promise<NextResponse> {
  const windowMs = config.rateLimit?.windowMs ?? 60_000;
  const max = config.rateLimit?.max ?? 20;

  return async function POST(req: NextRequest): Promise<NextResponse> {
    // 1. Auth admin-only — early-return de l'erreur (401/403) telle quelle.
    const auth = await requireAdminAuth();
    if (!auth.isAuthorized) return auth.error;

    // 2. Rate-limit — FIX-6 : clé basée sur l'utilisateur (non spoofable),
    //    plus sur l'IP cliente.
    const rl = checkRateLimit(`pagebuilder:${config.name}:${auth.user.id}`, {
      windowMs,
      max,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Trop de requêtes — réessayez dans une minute" },
        { status: 429 }
      );
    }

    // 3. Corps JSON.
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // 4. Validation Zod — message de la première issue (comme avant).
    let input: z.infer<TSchema>;
    try {
      input = config.schema.parse(body);
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

    // 5. Fail-soft : clé IA absente → 200 { aiDisabled: true, error }.
    if (!hasAnthropicKey()) {
      return NextResponse.json(
        {
          aiDisabled: true,
          error: "L'assistant IA n'est pas configuré (ANTHROPIC_API_KEY).",
        },
        { status: 200 }
      );
    }

    // 6. Handler métier, enveloppé du même mapping d'erreurs qu'avant.
    try {
      return await handler({ input, req, userId: auth.user.id });
    } catch (err) {
      if (err instanceof AnthropicError) {
        return NextResponse.json(
          {
            error:
              err.status === 429
                ? "L'API Claude est saturée, réessayez dans un instant."
                : `Erreur Anthropic (HTTP ${err.status})`,
          },
          { status: 502 }
        );
      }
      console.error(`[${config.name}] error:`, err);
      return NextResponse.json({ error: "Échec de l'appel IA" }, { status: 502 });
    }
  };
}

/**
 * Extracteur JSON unifié pour les sorties de modèle. Remplace les parseurs
 * dupliqués (`parseBlocksJson`, `parseItemsJson`, début de `parseAuditJson`/
 * `parseMetaJson`/`parseFaqJson`/`parseFocal`).
 *
 * Étapes :
 *   1. Retire d'éventuelles fences Markdown ```…``` (que le modèle ajoute parfois
 *      malgré la consigne).
 *   2. Slice de la première `{`/`[` à la dernière `}`/`]` selon `kind`.
 *   3. Borne la longueur à `maxLen` (garde-fou anti-sortie fleuve).
 *   4. `JSON.parse` sous try/catch.
 *
 * Renvoie la valeur `unknown` parsée (à charge de l'appelant de la valider /
 * normaliser), ou `null` si rien d'exploitable. NE filtre PAS sur le type JS :
 * le `kind` ne contraint que la portion slicée, pas la forme finale (conforme aux
 * parseurs d'origine qui sliçaient puis re-vérifiaient `Array.isArray`/`typeof`).
 */
export function extractJson(
  raw: string,
  kind: "object" | "array",
  maxLen = 20000
): unknown {
  let s = raw.trim();
  // 1. Strip des fences ```json … ``` éventuelles.
  s = s
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  // 2. Slice de la première ouverture à la dernière fermeture.
  const open = kind === "array" ? "[" : "{";
  const close = kind === "array" ? "]" : "}";
  const start = s.indexOf(open);
  const end = s.lastIndexOf(close);
  if (start < 0 || end <= start) return null;
  s = s.slice(start, end + 1);

  // 3. Bornage de taille.
  if (s.length > maxLen) s = s.slice(0, maxLen);

  // 4. Parse défensif.
  try {
    return JSON.parse(s) as unknown;
  } catch {
    return null;
  }
}
