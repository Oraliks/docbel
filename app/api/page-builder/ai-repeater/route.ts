/**
 * POST /api/page-builder/ai-repeater
 *
 * Génère les éléments d'un bloc Répéteur (tableau d'objets) à partir d'un
 * simple « sujet », ancré dans la KB chômage (RAG) via `prepareChatContext`
 * pour rester factuel. Pensé pour alimenter `props.items` du bloc répéteur :
 * chaque clé d'objet devient un token `{{item.clé}}` dans le modèle.
 *
 * Plomberie factorisée par `withAiRoute` (lib/page-builder/ai-route.ts) :
 *   - Admin-only (`requireAdminAuth`), rate-limité (clé par utilisateur — FIX-6).
 *   - Fail-soft : `{ aiDisabled: true }` en 200 si ANTHROPIC_API_KEY absente.
 *   - Sonnet + contexte KB best-effort (try/catch — la génération marche même
 *     si la RAG est indisponible, juste moins ancrée).
 *   - Parsing défensif du JSON renvoyé (`extractJson` + coercion des valeurs).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { callClaude } from "@/lib/chomage-ia/anthropic";
import { CLAUDE_MODELS } from "@/lib/chomage-ia/models";
import { DEFAULT_DOMAIN } from "@/lib/chomage-ia/types";
import { prepareChatContext } from "@/lib/chomage-ia/chat-pipeline";
import { withAiRoute, extractJson } from "@/lib/page-builder/ai-route";
import { BELGIAN_ADMIN_PERSONA } from "@/lib/page-builder/ai-prompts";

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

const SYSTEM_PROMPT = `Tu génères des données structurées pour un répéteur d'${BELGIAN_ADMIN_PERSONA}.
On te donne un SUJET. Tu produis une liste d'éléments factuels et concrets liés à ce sujet.

Règles STRICTES :
- Français clair et neutre.
- Appuie-toi STRICTEMENT sur le contexte de connaissances fourni s'il existe. N'invente AUCUN montant, délai, condition ni référence légale absent du contexte (reste général si l'info précise manque).
- Chaque élément est un objet plat (pas d'objets imbriqués, pas de tableaux) ; les valeurs sont des chaînes de texte courtes.
- Renvoie entre 3 et ${MAX_ITEMS} éléments pertinents.
- Réponds UNIQUEMENT avec un tableau JSON valide, sans texte autour ni bloc de code markdown.`;

/**
 * Parse défensif de la réponse Claude en `Array<Record<string, string>>` :
 *   1. Extrait la portion `[ ... ]` via `extractJson`.
 *   2. Ne garde que les objets plats ; coerce chaque valeur en string bornée.
 *   3. Borne le nombre d'éléments à MAX_ITEMS.
 */
function parseItemsJson(raw: string): Array<Record<string, string>> {
  const parsed = extractJson(raw, "array");
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

export const POST = withAiRoute(
  {
    name: "ai-repeater",
    schema: AiRepeaterSchema,
    rateLimit: { windowMs: 60_000, max: 20 },
  },
  async ({ input }) => {
    const { topic } = input;
    // Dédoublonne les clés (en gardant l'ordre) et borne leur nombre.
    const keys = input.keys
      ? Array.from(new Set(input.keys)).slice(0, MAX_KEYS)
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
  }
);
