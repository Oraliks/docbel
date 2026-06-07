/**
 * POST /api/page-builder/ai-repeater
 *
 * Génère les éléments d'un bloc Répéteur (tableau d'objets) à partir d'un
 * simple « sujet », ancré dans la KB chômage (RAG) via `prepareChatContext`
 * pour rester factuel. Pensé pour alimenter `props.items` du bloc répéteur :
 * chaque clé d'objet devient un token `{{item.clé}}` dans le modèle.
 *
 * Calqué sur `/api/page-builder/ai-assist` :
 *   - Admin-only (`requireAdminAuth`), rate-limité.
 *   - Fail-soft : `{ aiDisabled: true }` en 200 si ANTHROPIC_API_KEY absente.
 *   - Sonnet + contexte KB best-effort (try/catch — la génération marche même
 *     si la RAG est indisponible, juste moins ancrée).
 *   - Parsing défensif du JSON renvoyé (extraction `[...]`, bornage, coercion
 *     des valeurs en string).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/auth-check";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";
import {
  callClaude,
  hasAnthropicKey,
  AnthropicError,
} from "@/lib/chomage-ia/anthropic";
import { CLAUDE_MODELS } from "@/lib/chomage-ia/models";
import { DEFAULT_DOMAIN } from "@/lib/chomage-ia/types";
import { prepareChatContext } from "@/lib/chomage-ia/chat-pipeline";

/** Nombre maximum d'éléments retournés (garde-fou anti-réponse fleuve). */
const MAX_ITEMS = 12;
/** Longueur max d'une valeur de champ (string). */
const MAX_VALUE_LEN = 600;
/** Nombre max de clés explicites acceptées en entrée. */
const MAX_KEYS = 12;

const AiRepeaterSchema = z.object({
  topic: z.string().min(1, "Sujet requis").max(500),
  keys: z.array(z.string().min(1).max(60)).max(MAX_KEYS).optional(),
});

const SYSTEM_PROMPT = `Tu génères des données structurées pour un répéteur d'un site d'information administrative belge (chômage, ONEM, CPAS, mutuelles…).
On te donne un SUJET. Tu produis une liste d'éléments factuels et concrets liés à ce sujet.

Règles STRICTES :
- Français clair et neutre.
- Appuie-toi STRICTEMENT sur le contexte de connaissances fourni s'il existe. N'invente AUCUN montant, délai, condition ni référence légale absent du contexte (reste général si l'info précise manque).
- Chaque élément est un objet plat (pas d'objets imbriqués, pas de tableaux) ; les valeurs sont des chaînes de texte courtes.
- Renvoie entre 3 et ${MAX_ITEMS} éléments pertinents.
- Réponds UNIQUEMENT avec un tableau JSON valide, sans texte autour ni bloc de code markdown.`;

/**
 * Parse défensif de la réponse Claude en `Array<Record<string, string>>` :
 *   1. Extrait la portion `[ ... ]`.
 *   2. JSON.parse sous try/catch.
 *   3. Ne garde que les objets plats ; coerce chaque valeur en string bornée.
 *   4. Borne le nombre d'éléments à MAX_ITEMS.
 */
function parseItemsJson(raw: string): Array<Record<string, string>> {
  let s = raw.trim();
  const start = s.indexOf("[");
  const end = s.lastIndexOf("]");
  if (start >= 0 && end > start) s = s.slice(start, end + 1);

  let parsed: unknown;
  try {
    parsed = JSON.parse(s);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const items: Array<Record<string, string>> = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const obj: Record<string, string> = {};
    for (const [k, v] of Object.entries(entry as Record<string, unknown>)) {
      if (v === null || v === undefined) continue;
      // Objets/tableaux imbriqués → on les ignore (on veut un objet plat).
      if (typeof v === "object") continue;
      const str = typeof v === "string" ? v : String(v);
      obj[k] = str.slice(0, MAX_VALUE_LEN);
    }
    if (Object.keys(obj).length > 0) items.push(obj);
    if (items.length >= MAX_ITEMS) break;
  }
  return items;
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const ip = getClientIp(req);
  const rl = checkRateLimit(`pagebuilder:ai-repeater:${ip}`, {
    windowMs: 60_000,
    max: 20,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes — réessayez dans une minute" },
      { status: 429 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = AiRepeaterSchema.parse(body);
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

  // Fail-soft : pas de clé → l'UI affiche un toast, pas une erreur dure.
  if (!hasAnthropicKey()) {
    return NextResponse.json(
      {
        aiDisabled: true,
        error: "L'assistant IA n'est pas configuré (ANTHROPIC_API_KEY).",
      },
      { status: 200 }
    );
  }

  const { topic } = parsed;
  // Dédoublonne les clés (en gardant l'ordre) et borne leur nombre.
  const keys = parsed.keys
    ? Array.from(new Set(parsed.keys)).slice(0, MAX_KEYS)
    : undefined;

  // RAG best-effort : on ne fait JAMAIS échouer la génération sur une erreur KB.
  let cachedContext: string | undefined;
  try {
    const ctx = await prepareChatContext({ domain: DEFAULT_DOMAIN, query: topic });
    cachedContext = ctx.cachedContext;
  } catch (e) {
    console.warn("[ai-repeater] RAG context unavailable:", e);
  }

  const keysInstruction =
    keys && keys.length > 0
      ? `Chaque objet DOIT avoir EXACTEMENT ces clés (et uniquement celles-ci) : ${keys
          .map((k) => `"${k}"`)
          .join(", ")}.`
      : `Choisis 2 à 4 clés pertinentes et cohérentes pour le sujet (les mêmes clés pour tous les éléments). Préfère des noms de clés courts en français sans espace (ex. "titre", "description").`;

  try {
    const { text: raw } = await callClaude({
      model: CLAUDE_MODELS.sonnet,
      systemPrompt: SYSTEM_PROMPT,
      cachedContext,
      messages: [
        {
          role: "user",
          content: `Sujet : ${topic}\n\n${keysInstruction}`,
        },
      ],
      maxTokens: 2000,
      timeoutMs: 60_000,
    });

    const items = parseItemsJson(raw);
    if (items.length === 0) {
      return NextResponse.json(
        { error: "Les éléments générés sont vides ou invalides" },
        { status: 502 }
      );
    }
    return NextResponse.json({ items });
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
    console.error("[ai-repeater] error:", err);
    return NextResponse.json({ error: "Échec de l'appel IA" }, { status: 502 });
  }
}
