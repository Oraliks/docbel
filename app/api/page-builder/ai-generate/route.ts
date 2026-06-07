/**
 * POST /api/page-builder/ai-generate
 *
 * Génère une section / une page entière depuis un prompt en langage naturel,
 * sous forme d'un sous-arbre de **vrais blocs** du page-builder (éditables tels
 * quels). La réponse est ancrée dans la KB chômage via `prepareChatContext`
 * (RAG, best-effort) puis générée par Sonnet pour rester factuelle.
 *
 * Le modèle est contraint à un SOUS-ENSEMBLE de types de blocs (section /
 * heading / text / cta / faq) afin de garantir une sortie simple et valide. La
 * sortie est parsée défensivement (`extractJson`) puis validée par
 * `validateAiBlocks` (variante STRICTE du schéma + whitelist de types) avant
 * d'être renvoyée — un bloc malformé ou hors whitelist est ÉCARTÉ, jamais
 * renvoyé au client (FIX-1).
 *
 * Admin-only, rate-limité, fail-soft si ANTHROPIC_API_KEY absente.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { callClaude } from "@/lib/chomage-ia/anthropic";
import { CLAUDE_MODELS } from "@/lib/chomage-ia/models";
import { DEFAULT_DOMAIN } from "@/lib/chomage-ia/types";
import { prepareChatContext } from "@/lib/chomage-ia/chat-pipeline";
import { validateAiBlocks } from "@/lib/page-builder/validation";
import { withAiRoute, extractJson } from "@/lib/page-builder/ai-route";
import {
  BELGIAN_ADMIN_PERSONA,
  BLOCK_GRAMMAR_PROMPT,
} from "@/lib/page-builder/ai-prompts";

/** Types de blocs que l'IA est autorisée à produire (whitelist — FIX-1). */
const AI_ALLOWED_BLOCK_TYPES = ["section", "heading", "text", "cta", "faq"];

const GenerateSchema = z.object({
  prompt: z.string().min(1).max(2000),
});

const GENERATE_SYSTEM = `Tu es un générateur de sections pour l'éditeur de pages d'${BELGIAN_ADMIN_PERSONA}.
À partir d'une demande, tu produis le contenu sous forme d'un ARBRE DE BLOCS JSON éditables.

CONTEXTE DE CONNAISSANCES : si un contexte KB t'est fourni, appuie-toi STRICTEMENT dessus pour les faits (montants, délais, conditions, références légales). Si l'info manque, reste général et n'invente AUCUN chiffre, délai ni référence.

${BLOCK_GRAMMAR_PROMPT}`;

export const POST = withAiRoute(
  {
    name: "ai-generate",
    schema: GenerateSchema,
    rateLimit: { windowMs: 60_000, max: 10 },
  },
  async ({ input }) => {
    const { prompt } = input;

    // RAG best-effort : on ancre la génération dans la KB chômage si possible,
    // mais on génère quand même (contenu plus générique) si la RAG échoue.
    let cachedContext: string | undefined;
    try {
      const ctx = await prepareChatContext({ domain: DEFAULT_DOMAIN, query: prompt });
      cachedContext = ctx.cachedContext;
    } catch (e) {
      console.warn("[ai-generate] RAG context unavailable:", e);
    }

    const { text: raw } = await callClaude({
      model: CLAUDE_MODELS.sonnet,
      systemPrompt: GENERATE_SYSTEM,
      cachedContext,
      messages: [
        {
          role: "user",
          content: `Génère les blocs pour : ${prompt}`,
        },
      ],
      maxTokens: 3000,
      timeoutMs: 60_000,
    });

    const candidate = extractJson(raw, "array");
    if (!Array.isArray(candidate) || candidate.length === 0) {
      return NextResponse.json(
        { error: "La génération est vide ou mal formée." },
        { status: 502 }
      );
    }

    // FIX-1 : validation STRICTE (registry-derived) + whitelist de types. Un
    // bloc malformé ou d'un type non autorisé est écarté, jamais renvoyé.
    const blocks = validateAiBlocks(candidate, AI_ALLOWED_BLOCK_TYPES);
    if (blocks.length === 0) {
      console.warn("[ai-generate] no valid blocks after strict validation");
      return NextResponse.json(
        { error: "Les blocs générés sont invalides." },
        { status: 502 }
      );
    }

    return NextResponse.json({ blocks });
  }
);
