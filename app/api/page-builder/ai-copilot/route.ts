/**
 * POST /api/page-builder/ai-copilot
 *
 * Copilote IA conversationnel pour l'éditeur de pages. Contrairement à
 * `ai-generate` (one-shot prompt → blocs), c'est un CHAT : il répond aux
 * questions de l'admin sur la construction de la page ET, lorsque l'utilisateur
 * demande d'ajouter du contenu, il renvoie un sous-arbre de **vrais blocs**
 * éditables (même sous-ensemble que `ai-generate` : section/heading/text/cta/faq).
 *
 * Pour fiabiliser le mélange « texte conversationnel + blocs structurés », on
 * demande au modèle une enveloppe JSON STRICTE :
 *     { "reply": string, "blocks": <tableau de blocs> | null }
 * `reply` est toujours affiché ; `blocks` n'est renvoyé au client QUE s'il passe
 * `validateAiBlocks` (variante STRICTE du schéma + whitelist de types — FIX-1).
 * Aucun bloc invalide n'atteint le client : en cas de doute, on renvoie quand
 * même `reply` avec `blocks: null`.
 *
 * RAG best-effort via `prepareChatContext` (ancre les faits dans la KB chômage,
 * mais on répond quand même si la RAG échoue). Admin-only, rate-limité,
 * fail-soft si ANTHROPIC_API_KEY absente.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { callClaude } from "@/lib/chomage-ia/anthropic";
import { CLAUDE_MODELS } from "@/lib/chomage-ia/models";
import { DEFAULT_DOMAIN } from "@/lib/chomage-ia/types";
import { prepareChatContext } from "@/lib/chomage-ia/chat-pipeline";
import { validateAiBlocks } from "@/lib/page-builder/validation";
import { withAiRoute } from "@/lib/page-builder/ai-route";
import {
  BELGIAN_ADMIN_PERSONA,
  BLOCK_GRAMMAR_PROMPT,
  ANTI_INJECTION_LINE,
} from "@/lib/page-builder/ai-prompts";

/** Types de blocs que l'IA est autorisée à produire (whitelist — FIX-1). */
const AI_ALLOWED_BLOCK_TYPES = ["section", "heading", "text", "cta", "faq"];

const HistoryTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(8000),
});

const CopilotSchema = z.object({
  message: z.string().min(1).max(4000),
  history: z.array(HistoryTurnSchema).max(20).optional().default([]),
  pageText: z.string().max(12000).optional().default(""),
});

const COPILOT_SYSTEM = `Tu es le copilote IA d'un éditeur de pages (page-builder) pour ${BELGIAN_ADMIN_PERSONA}. Tu assistes un éditeur (admin) qui construit une page.

TON RÔLE :
- Répondre en français, de façon claire et concrète, aux questions de l'éditeur (structure de la page, idées de sections, formulations, bonnes pratiques d'accessibilité/SEO, conseils rédactionnels).
- Quand l'éditeur DEMANDE d'ajouter / créer / insérer du contenu (une section, une intro, une FAQ, un bouton…), tu PRODUIS ce contenu sous forme d'un ARBRE DE BLOCS JSON éditables, en plus d'un court message.
- Si l'éditeur pose juste une question ou discute, NE produis PAS de blocs.

CONTEXTE DE CONNAISSANCES : si un contexte KB t'est fourni, appuie-toi STRICTEMENT dessus pour les faits (montants, délais, conditions, références légales). Si l'info manque, reste général et n'invente AUCUN chiffre, délai ni référence.
CONTENU ACTUEL DE LA PAGE : un extrait texte de la page en cours peut t'être fourni — utilise-le pour répondre en contexte (ce qui existe déjà, ce qui manque), sans le répéter inutilement.
${ANTI_INJECTION_LINE}

FORMAT DE SORTIE — STRICT :
- Réponds UNIQUEMENT avec un OBJET JSON valide, sans texte autour, sans commentaire, sans bloc de code Markdown.
- Forme exacte : { "reply": "<ton message en français>", "blocks": <tableau de blocs OU null> }
- "reply" est toujours présent (1 à 4 phrases). "blocks" vaut null si tu n'ajoutes rien, sinon un tableau de blocs.

BLOCS (uniquement si tu ajoutes du contenu) — applique cette grammaire :
${BLOCK_GRAMMAR_PROMPT}`;

/**
 * Parse défensif de l'enveloppe `{ reply, blocks }`. Tolère un préambule / des
 * fences Markdown que le modèle ajouterait malgré la consigne. Renvoie toujours
 * une `reply` (texte brut si l'enveloppe est introuvable/cassée) et un tableau
 * brut `blocks` candidat (non validé ici — la validation Zod est faite par
 * l'appelant via `validateAiBlocks`).
 */
function parseCopilotEnvelope(raw: string): {
  reply: string;
  blocks: unknown[] | null;
} {
  let s = raw.trim();
  // Retire d'éventuelles fences ```json … ```
  s = s
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start < 0 || end <= start) {
    // Pas de JSON détectable : on traite tout le texte comme la réponse.
    return { reply: raw.trim(), blocks: null };
  }
  s = s.slice(start, end + 1);
  try {
    const parsed = JSON.parse(s);
    if (!parsed || typeof parsed !== "object") {
      return { reply: raw.trim(), blocks: null };
    }
    const obj = parsed as Record<string, unknown>;
    const reply =
      typeof obj.reply === "string" && obj.reply.trim()
        ? obj.reply.trim()
        : "";
    const blocks = Array.isArray(obj.blocks) ? (obj.blocks as unknown[]) : null;
    return { reply, blocks };
  } catch {
    // JSON cassé : fail-soft, on renvoie le texte brut comme réponse.
    return { reply: raw.trim(), blocks: null };
  }
}

export const POST = withAiRoute(
  {
    name: "ai-copilot",
    schema: CopilotSchema,
    rateLimit: { windowMs: 60_000, max: 20 },
  },
  async ({ input }) => {
    const { message, history, pageText } = input;

    // RAG best-effort : on ancre les faits dans la KB chômage si possible, mais
    // on répond quand même (plus générique) si la RAG échoue.
    let cachedContext: string | undefined;
    try {
      const ctx = await prepareChatContext({
        domain: DEFAULT_DOMAIN,
        query: message,
      });
      cachedContext = ctx.cachedContext;
    } catch (e) {
      console.warn("[ai-copilot] RAG context unavailable:", e);
    }

    // L'extrait de page courant est passé en tête du dernier message utilisateur
    // (et non dans le system caché) pour ne pas casser le cache KB et rester
    // fidèle à l'état réel de la page à ce tour.
    const pageContext = pageText.trim()
      ? `Contenu actuel de la page (extrait) :\n"""\n${pageText.trim()}\n"""\n\n`
      : "";

    // Historique borné (déjà limité par le schéma) + tour courant. Le format
    // user/assistant est exactement celui attendu par callClaude.
    const messages: Array<{ role: "user" | "assistant"; content: string }> = [
      ...history.map((t) => ({ role: t.role, content: t.content })),
      { role: "user", content: `${pageContext}${message}` },
    ];

    const { text: raw } = await callClaude({
      model: CLAUDE_MODELS.sonnet,
      systemPrompt: COPILOT_SYSTEM,
      cachedContext,
      messages,
      maxTokens: 3000,
      timeoutMs: 60_000,
    });

    const { reply, blocks: candidate } = parseCopilotEnvelope(raw);

    // FIX-1 : validation STRICTE + whitelist des blocs. Si invalides, on n'envoie
    // pas de blocs (mais on garde la réponse texte).
    let validBlocks: ReturnType<typeof validateAiBlocks> | null = null;
    if (candidate && candidate.length > 0) {
      const valid = validateAiBlocks(candidate, AI_ALLOWED_BLOCK_TYPES);
      if (valid.length > 0) {
        validBlocks = valid;
      } else {
        console.warn("[ai-copilot] no valid blocks after strict validation");
      }
    }

    return NextResponse.json({
      reply:
        reply ||
        "Je n'ai pas réussi à formuler de réponse — peux-tu reformuler ?",
      blocks: validBlocks,
    });
  }
);
