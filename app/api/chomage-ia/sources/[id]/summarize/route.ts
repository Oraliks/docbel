/**
 * POST /api/chomage-ia/sources/[id]/summarize
 *
 * Génère un résumé court d'une KnowledgeSource via Claude Haiku 4.5 et le
 * persiste dans `summary`. Idempotent : ré-appeler écrase le résumé existant.
 *
 * Rate-limit léger (5/min) pour éviter le spam d'admin distrait.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";
import { callClaude, AnthropicError, hasAnthropicKey } from "@/lib/chomage-ia/anthropic";
import { CLAUDE_MODELS } from "@/lib/chomage-ia/models";
import { SUMMARIZE_SYSTEM_PROMPT } from "@/lib/chomage-ia/prompts";
import { runIndexInBackground } from "@/lib/chomage-ia/indexer";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const ip = getClientIp(req);
  const rl = checkRateLimit(`chomage-ia:summarize:${ip}`, {
    windowMs: 60_000,
    max: 5,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes — réessayez dans une minute" },
      { status: 429 }
    );
  }

  if (!hasAnthropicKey()) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY non configurée" },
      { status: 503 }
    );
  }

  const { id } = await params;
  const source = await prisma.knowledgeSource.findUnique({ where: { id } });
  if (!source) {
    return NextResponse.json({ error: "Source introuvable" }, { status: 404 });
  }

  // Tronque le contenu en entrée (au-delà de 20K caractères, Haiku perd
  // de toute façon l'essentiel). Le résumé est court : pas la peine de
  // tout envoyer.
  const truncated = source.content.slice(0, 20_000);
  const userMsg = [
    `Titre : ${source.title}`,
    `Type : ${source.kind}`,
    source.sourceUrl ? `URL : ${source.sourceUrl}` : null,
    "",
    "Contenu :",
    truncated,
  ]
    .filter((l) => l !== null)
    .join("\n");

  try {
    const claudeRes = await callClaude({
      model: CLAUDE_MODELS.haiku,
      systemPrompt: SUMMARIZE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMsg }],
      maxTokens: 200,
      timeoutMs: 30_000,
    });

    // Garde-fou : on coupe à 350 caractères max comme spécifié dans le prompt.
    const summary = claudeRes.text.trim().slice(0, 350);

    const updated = await prisma.knowledgeSource.update({
      where: { id },
      data: { summary },
    });

    // Le summary est préfixé au content dans le chunker pour booster le ranking
    // → re-index pour que les embeddings reflètent le nouveau summary.
    runIndexInBackground(updated.id);

    return NextResponse.json({
      id: updated.id,
      summary: updated.summary,
      usage: claudeRes.usage,
    });
  } catch (err) {
    if (err instanceof AnthropicError) {
      console.error("Summarize Anthropic error:", err.status, err.details);
      return NextResponse.json(
        { error: `Erreur Anthropic (HTTP ${err.status})` },
        { status: 502 }
      );
    }
    console.error("Summarize unknown error:", err);
    return NextResponse.json(
      { error: "Échec du résumé" },
      { status: 500 }
    );
  }
}
