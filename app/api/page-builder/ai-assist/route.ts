/**
 * POST /api/page-builder/ai-assist
 *
 * Assistant rédactionnel pour l'éditeur de pages, branché sur Claude.
 *  - Actions de transformation (rewrite/simplify/shorten/lengthen/fix) : opèrent
 *    sur le HTML fourni, sans RAG, via Haiku (rapide/économe).
 *  - Actions génératives (generate/faq) : ancrées dans la KB chômage via
 *    `prepareChatContext` (RAG) + Sonnet, pour rester factuel (pas d'hallucination).
 *
 * Admin-only, rate-limité, fail-soft si ANTHROPIC_API_KEY absente. Réutilise le
 * wrapper `callClaude` (prompt caching ephemeral sur system + contexte KB).
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

const TRANSFORM_ACTIONS = [
  "rewrite",
  "simplify",
  "shorten",
  "lengthen",
  "fix",
  "level-a2",
  "tone-pro",
  "tone-warm",
] as const;

const AiAssistSchema = z.object({
  action: z.enum([
    "rewrite",
    "simplify",
    "shorten",
    "lengthen",
    "fix",
    "level-a2",
    "tone-pro",
    "tone-warm",
    "generate",
    "faq",
    "meta",
  ]),
  text: z.string().max(20000).optional().default(""),
  topic: z.string().max(500).optional().default(""),
});

const ACTION_INSTRUCTION: Record<string, string> = {
  rewrite: "Réécris ce contenu de façon plus claire et fluide, sans changer le sens.",
  simplify:
    "Réécris ce contenu en français simple et accessible (grand public, niveau B1), avec des phrases courtes.",
  shorten:
    "Résume ce contenu en le raccourcissant nettement tout en gardant l'essentiel.",
  lengthen:
    "Développe ce contenu avec des précisions utiles et des exemples concrets, sans inventer de faits.",
  fix: "Corrige uniquement l'orthographe, la grammaire et la typographie, sans changer le sens ni le style.",
  "level-a2":
    "Réécris ce contenu en français très simple (niveau A2), phrases très courtes, vocabulaire courant, sans perdre les faits.",
  "tone-pro":
    "Réécris ce contenu avec un ton professionnel, sobre et institutionnel, sans changer les faits.",
  "tone-warm":
    "Réécris ce contenu avec un ton chaleureux et rassurant, sans changer les faits.",
};

const TRANSFORM_SYSTEM = `Tu es un assistant rédactionnel pour un site d'information administrative belge (chômage, ONEM, CPAS, mutuelles…).
On te fournit un contenu HTML et une consigne de réécriture.
Règles STRICTES :
- Français uniquement, ton clair et neutre, tutoiement évité.
- Conserve le SENS et tous les FAITS. N'invente AUCUN montant, délai, condition ni référence légale.
- Conserve une structure HTML simple (<p>, <ul>, <ol>, <li>, <strong>, <em>, <a>, <h2>, <h3>). Aucun <script>/<style>.
- Réponds UNIQUEMENT avec le HTML résultant, sans commentaire ni bloc de code.`;

const GENERATE_SYSTEM = `Tu es un assistant rédactionnel pour un site d'information administrative belge (chômage, ONEM, CPAS…).
Tu rédiges un contenu factuel et utile sur un sujet, en t'appuyant STRICTEMENT sur le contexte de connaissances fourni s'il existe.
Règles : français clair ; n'invente AUCUN montant/délai/référence légale absent du contexte (reste général si l'info manque) ; HTML simple uniquement (<p>, <ul>, <li>, <strong>, <h2>, <h3>). Réponds UNIQUEMENT avec le HTML.`;

const FAQ_SYSTEM = `Tu es un assistant rédactionnel pour un site d'information administrative belge (chômage, ONEM, CPAS…).
Tu génères une FAQ sur un sujet, en t'appuyant STRICTEMENT sur le contexte fourni s'il existe.
Règles : français clair ; n'invente aucun fait précis (montant/délai/loi) hors contexte ; 4 à 6 questions pertinentes et concrètes.
Réponds UNIQUEMENT avec un tableau JSON valide [{"question":"…","answer":"…"}], sans texte autour ni bloc de code.`;

const META_SYSTEM = `Tu génères les métadonnées SEO d'une page d'un site d'information administrative belge (chômage, ONEM, CPAS…).
À partir du contenu fourni, produis un titre SEO (50-60 caractères) et une méta-description (140-160 caractères), en français, accrocheurs et fidèles au contenu — sans inventer de faits.
Réponds UNIQUEMENT avec un JSON valide {"title":"…","desc":"…"}, sans texte autour ni bloc de code.`;

function parseMetaJson(raw: string): { title: string; desc: string } | null {
  let s = raw.trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) s = s.slice(start, end + 1);
  try {
    const obj = JSON.parse(s);
    if (obj && typeof obj.title === "string" && typeof obj.desc === "string") {
      return { title: obj.title.slice(0, 70), desc: obj.desc.slice(0, 180) };
    }
  } catch {
    /* invalide */
  }
  return null;
}

function parseFaqJson(raw: string): Array<{ question: string; answer: string }> {
  let s = raw.trim();
  const start = s.indexOf("[");
  const end = s.lastIndexOf("]");
  if (start >= 0 && end > start) s = s.slice(start, end + 1);
  try {
    const arr = JSON.parse(s);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(
        (x): x is { question: string; answer: string } =>
          !!x && typeof x.question === "string" && typeof x.answer === "string"
      )
      .map((x) => ({
        question: x.question.slice(0, 500),
        answer: x.answer.slice(0, 2000),
      }))
      .slice(0, 8);
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const ip = getClientIp(req);
  const rl = checkRateLimit(`pagebuilder:ai-assist:${ip}`, {
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
    parsed = AiAssistSchema.parse(body);
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

  const { action, text, topic } = parsed;
  const isTransform = (TRANSFORM_ACTIONS as readonly string[]).includes(action);

  try {
    if (isTransform) {
      if (!text.trim()) {
        return NextResponse.json(
          { error: "Aucun texte à transformer" },
          { status: 400 }
        );
      }
      const { text: out } = await callClaude({
        model: CLAUDE_MODELS.haiku,
        systemPrompt: TRANSFORM_SYSTEM,
        messages: [
          {
            role: "user",
            content: `Consigne : ${ACTION_INSTRUCTION[action]}\n\nContenu :\n${text}`,
          },
        ],
        maxTokens: 1800,
        timeoutMs: 30_000,
      });
      return NextResponse.json({ text: out });
    }

    if (action === "meta") {
      if (!text.trim()) {
        return NextResponse.json({ error: "Aucun contenu" }, { status: 400 });
      }
      const { text: raw } = await callClaude({
        model: CLAUDE_MODELS.haiku,
        systemPrompt: META_SYSTEM,
        messages: [
          { role: "user", content: `Contenu de la page :\n${text.slice(0, 8000)}` },
        ],
        maxTokens: 400,
        timeoutMs: 30_000,
      });
      const meta = parseMetaJson(raw);
      if (!meta) {
        return NextResponse.json(
          { error: "Métadonnées générées invalides" },
          { status: 502 }
        );
      }
      return NextResponse.json(meta);
    }

    // Génératif (generate | faq) → ancré dans la KB chômage.
    if (!topic.trim()) {
      return NextResponse.json({ error: "Sujet requis" }, { status: 400 });
    }

    let cachedContext: string | undefined;
    try {
      const ctx = await prepareChatContext({ domain: DEFAULT_DOMAIN, query: topic });
      cachedContext = ctx.cachedContext;
    } catch (e) {
      // RAG indisponible → on génère sans contexte (moins ancré mais utile).
      console.warn("[ai-assist] RAG context unavailable:", e);
    }

    if (action === "generate") {
      const { text: out } = await callClaude({
        model: CLAUDE_MODELS.sonnet,
        systemPrompt: GENERATE_SYSTEM,
        cachedContext,
        messages: [{ role: "user", content: `Rédige un contenu sur : ${topic}` }],
        maxTokens: 1800,
        timeoutMs: 60_000,
      });
      return NextResponse.json({ text: out });
    }

    // faq
    const { text: raw } = await callClaude({
      model: CLAUDE_MODELS.sonnet,
      systemPrompt: FAQ_SYSTEM,
      cachedContext,
      messages: [{ role: "user", content: `Sujet de la FAQ : ${topic}` }],
      maxTokens: 2000,
      timeoutMs: 60_000,
    });
    const items = parseFaqJson(raw);
    if (items.length === 0) {
      return NextResponse.json(
        { error: "La FAQ générée est vide ou invalide" },
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
    console.error("[ai-assist] error:", err);
    return NextResponse.json({ error: "Échec de l'appel IA" }, { status: 502 });
  }
}
