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
 * `reply` est toujours affiché ; `blocks` n'est renvoyé au client QUE s'il
 * passe `BlocksSchema.safeParse` (lib/page-builder/validation.ts) — la même
 * source de vérité que la sauvegarde de page. Aucun bloc invalide n'atteint le
 * client : en cas de doute, on renvoie quand même `reply` avec `blocks: null`.
 *
 * RAG best-effort via `prepareChatContext` (ancre les faits dans la KB chômage,
 * mais on répond quand même si la RAG échoue). Admin-only, rate-limité,
 * fail-soft si ANTHROPIC_API_KEY absente.
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

const HistoryTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(8000),
});

const CopilotSchema = z.object({
  message: z.string().min(1).max(4000),
  history: z.array(HistoryTurnSchema).max(20).optional().default([]),
  pageText: z.string().max(12000).optional().default(""),
});

const COPILOT_SYSTEM = `Tu es le copilote IA d'un éditeur de pages (page-builder) pour un site d'information administrative belge (chômage, ONEM, CPAS, mutuelles…). Tu assistes un éditeur (admin) qui construit une page.

TON RÔLE :
- Répondre en français, de façon claire et concrète, aux questions de l'éditeur (structure de la page, idées de sections, formulations, bonnes pratiques d'accessibilité/SEO, conseils rédactionnels).
- Quand l'éditeur DEMANDE d'ajouter / créer / insérer du contenu (une section, une intro, une FAQ, un bouton…), tu PRODUIS ce contenu sous forme d'un ARBRE DE BLOCS JSON éditables, en plus d'un court message.
- Si l'éditeur pose juste une question ou discute, NE produis PAS de blocs.

CONTEXTE DE CONNAISSANCES : si un contexte KB t'est fourni, appuie-toi STRICTEMENT dessus pour les faits (montants, délais, conditions, références légales). Si l'info manque, reste général et n'invente AUCUN chiffre, délai ni référence.
CONTENU ACTUEL DE LA PAGE : un extrait texte de la page en cours peut t'être fourni — utilise-le pour répondre en contexte (ce qui existe déjà, ce qui manque), sans le répéter inutilement.

FORMAT DE SORTIE — STRICT :
- Réponds UNIQUEMENT avec un OBJET JSON valide, sans texte autour, sans commentaire, sans bloc de code Markdown.
- Forme exacte : { "reply": "<ton message en français>", "blocks": <tableau de blocs OU null> }
- "reply" est toujours présent (1 à 4 phrases). "blocks" vaut null si tu n'ajoutes rien, sinon un tableau de blocs.

BLOCS (uniquement si tu ajoutes du contenu) :
- Chaque bloc : { "id": "<identifiant unique court>", "type": "<type>", "props": { … }, "parentId": <id du parent ou null> }.
- Les "id" sont des chaînes uniques que TU inventes (ex. "sec1", "h1", "t1"). Les blocs enfants d'une section ont "parentId" égal à l'"id" de cette section. Les blocs racine ont "parentId": null.

TYPES AUTORISÉS (et UNIQUEMENT ceux-ci), avec leurs props EXACTES :
- "section" — props: {} (conteneur ; mets le contenu DANS des blocs enfants qui pointent vers son id)
- "heading" — props: { "text": string, "level": 1 | 2 | 3 }
- "text" — props: { "html": string }  (HTML simple uniquement : <p>, <ul>, <ol>, <li>, <strong>, <em>, <a>. Pas de <script>/<style>.)
- "cta" — props: { "title"?: string, "description"?: string, "text": string, "link": string, "variant"?: "inline" | "banner" | "card" }
- "faq" — props: { "title"?: string, "items": [ { "question": string, "answer": string } ] }

RÈGLES DE CONTENU (quand tu produis des blocs) :
- Français clair, neutre, factuel. Enveloppe le contenu ajouté dans UNE "section" racine, puis un "heading" et le reste en enfants de cette section.
- Reste raisonnable : 3 à 8 blocs au total. Une FAQ a 3 à 6 questions concrètes.
- N'invente AUCUN montant/délai/référence légale absent du contexte fourni.`;

/**
 * Parse défensif de l'enveloppe `{ reply, blocks }`. Tolère un préambule / des
 * fences Markdown que le modèle ajouterait malgré la consigne. Renvoie toujours
 * une `reply` (chaîne vide si introuvable) et un tableau brut `blocks` candidat
 * (non validé ici — la validation Zod est faite par l'appelant).
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

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const ip = getClientIp(req);
  const rl = checkRateLimit(`pagebuilder:ai-copilot:${ip}`, {
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
    parsed = CopilotSchema.parse(body);
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

  const { message, history, pageText } = parsed;

  // RAG best-effort : on ancre les faits dans la KB chômage si possible, mais on
  // répond quand même (plus générique) si la RAG échoue.
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

  try {
    const { text: raw } = await callClaude({
      model: CLAUDE_MODELS.sonnet,
      systemPrompt: COPILOT_SYSTEM,
      cachedContext,
      messages,
      maxTokens: 3000,
      timeoutMs: 60_000,
    });

    const { reply, blocks: candidate } = parseCopilotEnvelope(raw);

    // Validation des blocs par la MÊME source de vérité que la sauvegarde.
    // Si invalides, on n'envoie pas de blocs (mais on garde la réponse texte).
    let validBlocks: z.infer<typeof BlocksSchema> | null = null;
    if (candidate && candidate.length > 0) {
      const result = BlocksSchema.safeParse(candidate);
      if (result.success && result.data.length > 0) {
        validBlocks = result.data;
      } else {
        console.warn(
          "[ai-copilot] blocks failed validation:",
          result.success ? "empty" : result.error.issues[0]
        );
      }
    }

    return NextResponse.json({
      reply:
        reply ||
        "Je n'ai pas réussi à formuler de réponse — peux-tu reformuler ?",
      blocks: validBlocks,
    });
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
    console.error("[ai-copilot] error:", err);
    return NextResponse.json(
      { error: "Échec de l'appel au copilote IA" },
      { status: 502 }
    );
  }
}
