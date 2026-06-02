/**
 * POST /api/chomage-ia/prompt-builder
 *
 * Génère un brief Claude Code à partir d'une consigne libre ("brief") en
 * s'appuyant sur :
 *   - la knowledge base chômage (sources injectées en contexte caché)
 *   - les patterns du projet Beldoc (intégrés au system prompt)
 *
 * Body : { brief, contextHint?, domain? }
 * Retour : { id, title, output, citedSourceIds, usage }
 *
 * Persiste le résultat dans GeneratedPrompt pour historique.
 *
 * Rate-limit : 3/min/IP (génération coûteuse — Sonnet 4.5 + 50K contexte).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";
import {
  PromptBuilderRequestSchema,
  DEFAULT_DOMAIN,
} from "@/lib/chomage-ia/types";
import {
  buildKnowledgeContext,
  extractCitedSourceIds,
} from "@/lib/chomage-ia/context";
import {
  callClaude,
  AnthropicError,
  hasAnthropicKey,
} from "@/lib/chomage-ia/anthropic";
import { CLAUDE_MODELS } from "@/lib/chomage-ia/models";
import { PROMPT_BUILDER_SYSTEM_PROMPT } from "@/lib/chomage-ia/prompts";

/**
 * Extrait la dernière ligne "Titre : ..." produite par Claude pour nommer
 * l'entrée GeneratedPrompt. Fallback = première ligne non-vide tronquée.
 */
function extractTitle(brief: string, output: string): string {
  const m = output.match(/^Titre\s*:\s*(.+)$/im);
  if (m && m[1].trim().length > 0) {
    return m[1].trim().slice(0, 120);
  }
  // Fallback : 60 premiers caractères du brief
  return brief.trim().slice(0, 60) + (brief.length > 60 ? "..." : "");
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const ip = getClientIp(req);
  const rl = checkRateLimit(`chomage-ia:prompt-builder:${ip}`, {
    windowMs: 60_000,
    max: 3,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de générations — réessayez dans une minute" },
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
    parsed = PromptBuilderRequestSchema.parse(body);
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

  const domain = parsed.domain ?? DEFAULT_DOMAIN;

  if (!hasAnthropicKey()) {
    return NextResponse.json(
      {
        error:
          "ANTHROPIC_API_KEY non configurée — impossible de générer le prompt.",
      },
      { status: 503 }
    );
  }

  // Contexte KB pour le brief — la query est le brief lui-même.
  const { contextText, includedSourceIds } = await buildKnowledgeContext({
    domain,
    query: parsed.brief,
  });

  const cachedContext = contextText
    ? `Voici les sources de la knowledge base que tu dois exploiter pour produire le brief.\n\n${contextText}`
    : "(La knowledge base est vide pour ce domaine — produis un brief générique mais signale les points à vérifier.)";

  const userMsg = parsed.contextHint
    ? `Brief : ${parsed.brief}\n\nContexte supplémentaire : ${parsed.contextHint}`
    : `Brief : ${parsed.brief}`;

  let output: string;
  let usage;
  try {
    const claudeRes = await callClaude({
      model: CLAUDE_MODELS.sonnet,
      systemPrompt: PROMPT_BUILDER_SYSTEM_PROMPT,
      cachedContext,
      messages: [{ role: "user", content: userMsg }],
      maxTokens: 4000,
      timeoutMs: 90_000,
    });
    output = claudeRes.text;
    usage = claudeRes.usage;
  } catch (err) {
    if (err instanceof AnthropicError) {
      console.error("PromptBuilder Anthropic error:", err.status, err.details);
      return NextResponse.json(
        { error: `Erreur Anthropic (HTTP ${err.status})` },
        { status: 502 }
      );
    }
    console.error("PromptBuilder unknown error:", err);
    return NextResponse.json(
      { error: "Échec de la génération" },
      { status: 500 }
    );
  }

  // Filtre les IDs cités qui sont effectivement dans la KB envoyée.
  const citedRaw = extractCitedSourceIds(output);
  const citedIds = citedRaw.filter((id) => includedSourceIds.includes(id));

  const title = extractTitle(parsed.brief, output);

  const created = await prisma.generatedPrompt.create({
    data: {
      title,
      brief: parsed.brief,
      output,
      domain,
      citedSourceIds: citedIds,
      createdById: auth.user.id,
    },
  });

  return NextResponse.json({
    id: created.id,
    title: created.title,
    output: created.output,
    brief: created.brief,
    citedSourceIds: created.citedSourceIds,
    createdAt: created.createdAt.toISOString(),
    usage,
  });
}
