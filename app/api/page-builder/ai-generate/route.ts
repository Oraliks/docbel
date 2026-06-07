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
 * sortie est parsée défensivement puis validée par `BlocksSchema`
 * (lib/page-builder/validation.ts) — la MÊME source de vérité que la sauvegarde
 * de page — avant d'être renvoyée. Aucun bloc invalide n'atteint le client.
 *
 * Admin-only, rate-limité, fail-soft si ANTHROPIC_API_KEY absente.
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
import { BlocksSchema } from "@/lib/page-builder/validation";

const GenerateSchema = z.object({
  prompt: z.string().min(1).max(2000),
});

const GENERATE_SYSTEM = `Tu es un générateur de sections pour l'éditeur de pages d'un site d'information administrative belge (chômage, ONEM, CPAS, mutuelles…).
À partir d'une demande, tu produis le contenu sous forme d'un ARBRE DE BLOCS JSON éditables.

CONTEXTE DE CONNAISSANCES : si un contexte KB t'est fourni, appuie-toi STRICTEMENT dessus pour les faits (montants, délais, conditions, références légales). Si l'info manque, reste général et n'invente AUCUN chiffre, délai ni référence.

FORMAT DE SORTIE — STRICT :
- Réponds UNIQUEMENT avec un TABLEAU JSON valide de blocs. Aucun texte autour, aucun commentaire, aucun bloc de code Markdown.
- Chaque bloc : { "id": "<identifiant unique court>", "type": "<type>", "props": { … }, "parentId": <id du parent ou null> }.
- Les "id" sont des chaînes uniques que TU inventes (ex. "sec1", "h1", "t1"). Les blocs enfants d'une section ont "parentId" égal à l'"id" de cette section. Les blocs racine ont "parentId": null.

TYPES AUTORISÉS (et UNIQUEMENT ceux-ci), avec leurs props EXACTES :
- "section" — props: {} (conteneur ; mets le contenu DANS des blocs enfants qui pointent vers son id)
- "heading" — props: { "text": string, "level": 1 | 2 | 3 }
- "text" — props: { "html": string }  (HTML simple uniquement : <p>, <ul>, <ol>, <li>, <strong>, <em>, <a>. Pas de <script>/<style>.)
- "cta" — props: { "title"?: string, "description"?: string, "text": string, "link": string, "variant"?: "inline" | "banner" | "card" }
- "faq" — props: { "title"?: string, "items": [ { "question": string, "answer": string } ] }

RÈGLES DE CONTENU :
- Français clair, neutre, factuel. Structure ta réponse : enveloppe le tout dans UNE "section" racine, puis un "heading" (level 1 ou 2) et le reste du contenu en enfants de cette section.
- Reste raisonnable : 3 à 8 blocs au total. Une FAQ a 3 à 6 questions concrètes.
- N'invente AUCUN montant/délai/référence légale absent du contexte fourni.`;

/**
 * Extrait le premier tableau JSON crédible d'une réponse de modèle, puis le
 * parse. Tolère un préambule / des fences Markdown que le modèle ajouterait
 * malgré la consigne.
 */
function parseBlocksJson(raw: string): unknown[] | null {
  let s = raw.trim();
  // Retire d'éventuelles fences ```json … ```
  s = s.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = s.indexOf("[");
  const end = s.lastIndexOf("]");
  if (start < 0 || end <= start) return null;
  s = s.slice(start, end + 1);
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const ip = getClientIp(req);
  const rl = checkRateLimit(`pagebuilder:ai-generate:${ip}`, {
    windowMs: 60_000,
    max: 10,
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
    parsed = GenerateSchema.parse(body);
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

  if (!hasAnthropicKey()) {
    return NextResponse.json(
      {
        aiDisabled: true,
        error: "L'assistant IA n'est pas configuré (ANTHROPIC_API_KEY).",
      },
      { status: 200 }
    );
  }

  const { prompt } = parsed;

  // RAG best-effort : on ancre la génération dans la KB chômage si possible,
  // mais on génère quand même (contenu plus générique) si la RAG échoue.
  let cachedContext: string | undefined;
  try {
    const ctx = await prepareChatContext({ domain: DEFAULT_DOMAIN, query: prompt });
    cachedContext = ctx.cachedContext;
  } catch (e) {
    console.warn("[ai-generate] RAG context unavailable:", e);
  }

  try {
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

    const candidate = parseBlocksJson(raw);
    if (!candidate || candidate.length === 0) {
      return NextResponse.json(
        { error: "La génération est vide ou mal formée." },
        { status: 502 }
      );
    }

    // Validation par la MÊME source de vérité que la sauvegarde de page.
    const result = BlocksSchema.safeParse(candidate);
    if (!result.success || result.data.length === 0) {
      console.warn(
        "[ai-generate] blocks failed validation:",
        result.success ? "empty" : result.error.issues[0]
      );
      return NextResponse.json(
        { error: "Les blocs générés sont invalides." },
        { status: 502 }
      );
    }

    return NextResponse.json({ blocks: result.data });
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
    console.error("[ai-generate] error:", err);
    return NextResponse.json({ error: "Échec de la génération IA" }, { status: 502 });
  }
}
