/**
 * GET /api/chomage-ia/usage?domain=chomage
 *
 * Aggrège la consommation tokens + coût estimé du module Assistant IA Chômage.
 *
 * Sources de données :
 *   1. ChatMessage : tokensIn / tokensOut / model persistés par /chat.
 *      → groupé par modèle pour distinguer Sonnet vs Haiku.
 *   2. GeneratedPrompt : pas de colonne `usage` en DB (pas de migration).
 *      → tokens output estimés via LENGTH(output)/4 (~1 tk = 4 chars FR).
 *      → modèle supposé = Sonnet 4.5 (le prompt-builder n'utilise que ça).
 *
 * Auth : admin requis. Pas de rate-limit (lecture pure, agrégat léger).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { DEFAULT_DOMAIN } from "@/lib/chomage-ia/types";
import { CLAUDE_MODELS } from "@/lib/chomage-ia/models";
import {
  estimateCost,
  roughTokenCount,
  USD_TO_EUR,
} from "@/lib/chomage-ia/pricing";

export const dynamic = "force-dynamic";

interface ByModelEntry {
  model: string;
  messages: number;
  input: number;
  output: number;
  usd: number;
  eur: number;
}

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const url = new URL(req.url);
  const domain = url.searchParams.get("domain") ?? DEFAULT_DOMAIN;

  // ----- 1. ChatMessage agg : group by model -----
  // groupBy ne supporte pas le WHERE relationnel directement sur model.session.
  // On filtre via session.domain en passant par `where: { session: { domain } }`.
  const grouped = await prisma.chatMessage.groupBy({
    by: ["model"],
    where: {
      role: "assistant",
      session: { domain },
    },
    _sum: { tokensIn: true, tokensOut: true },
    _count: { _all: true },
  });

  const byModel: ByModelEntry[] = [];
  let chatInputTotal = 0;
  let chatOutputTotal = 0;
  let chatCostUsd = 0;

  for (const row of grouped) {
    const model = row.model ?? CLAUDE_MODELS.sonnet;
    const input = row._sum.tokensIn ?? 0;
    const output = row._sum.tokensOut ?? 0;
    const cost = estimateCost({
      model,
      inputTokens: input,
      outputTokens: output,
    });
    byModel.push({
      model,
      messages: row._count._all,
      input,
      output,
      usd: cost.usd,
      eur: cost.eur,
    });
    chatInputTotal += input;
    chatOutputTotal += output;
    chatCostUsd += cost.usd;
  }

  // Tri : le modèle le plus utilisé en premier (par nb de messages).
  byModel.sort((a, b) => b.messages - a.messages);

  // ----- 2. GeneratedPrompt : estimation length-based -----
  const prompts = await prisma.generatedPrompt.findMany({
    where: { domain },
    select: { output: true },
  });

  let promptOutputTokens = 0;
  for (const p of prompts) {
    promptOutputTokens += roughTokenCount(p.output ?? "");
  }
  // Supposition pragmatique : on n'a pas d'input tracké pour les prompts.
  // On estime juste le coût de l'output (Sonnet 4.5) — c'est la majorité du coût
  // (output = 5× input). Faute de mieux, c'est honnête côté ordre de grandeur.
  const promptCost = estimateCost({
    model: CLAUDE_MODELS.sonnet,
    inputTokens: 0,
    outputTokens: promptOutputTokens,
  });

  // ----- 3. Totaux globaux -----
  const totalInput = chatInputTotal;
  const totalOutput = chatOutputTotal + promptOutputTokens;
  const totalUsd = chatCostUsd + promptCost.usd;
  const totalEur = totalUsd * USD_TO_EUR;

  return NextResponse.json({
    domain,
    totalTokens: {
      input: totalInput,
      output: totalOutput,
      all: totalInput + totalOutput,
    },
    totalCost: {
      usd: totalUsd,
      eur: totalEur,
    },
    byModel,
    prompts: {
      count: prompts.length,
      estimatedOutputTokens: promptOutputTokens,
      estimatedUsd: promptCost.usd,
      estimatedEur: promptCost.eur,
    },
    rate: {
      usdToEur: USD_TO_EUR,
    },
    lastUpdated: new Date().toISOString(),
  });
}
