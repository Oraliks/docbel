import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { checkRateLimit, getClientIp } from "@/lib/documents/rate-limit";
import { getSetting, SETTING_KEYS } from "@/lib/app-settings";
import { parseVocabularyTags, searchBundles } from "@/lib/bundles/vocabulary";

/// POST /api/intent-detect
///
/// Body : `{ query: string }`
///
/// Détecte vers quel(s) bundle(s) orienter une requête en langage libre
/// (ex. "mon patron m'a dit intempéries", "je perds mon emploi").
///
/// Stratégie hybride :
///   1. Toujours calculer un score de matching local (vocabulaire) — instantané
///   2. Si l'IA est activée ET la clé API présente : appel Claude Haiku 4.5
///      pour affiner la suggestion. Le LLM voit la liste des bundles disponibles
///      (nom + description + tags) et choisit le plus pertinent + court paragraphe
///      d'explication en langage simple.
///   3. Si l'IA n'est pas disponible : on retourne le top match local
///
/// Le LLM ne **décide** jamais — il propose. C'est l'utilisateur qui clique.
/// Retour : `{ suggestions: [...], aiUsed: boolean, aiMessage?: string }`

const BodySchema = z.object({
  query: z.string().min(2, "Requête trop courte").max(500),
});

const SYSTEM_PROMPT = `Tu es un assistant administratif expert des démarches belges (ONEM, Actiris, CPAS, mutuelles, communes).

Ton rôle : à partir d'une description libre par un citoyen ("mon patron m'a mis en intempéries", "j'ai perdu mon emploi", etc.), identifier le **parcours administratif** (bundle) le plus pertinent dans la liste fournie.

Règles strictes :
1. Réponds UNIQUEMENT en JSON valide, au format suivant :
   { "topSlug": "<slug-le-plus-pertinent ou null>", "explanation": "<phrase courte en français simple>", "alternatives": ["<slug2>", "<slug3>"] }
2. Choisis le slug parmi ceux fournis. NE PAS inventer de slug.
3. Si AUCUN bundle ne correspond, renvoie topSlug: null et explication "Aucun parcours évident dans le catalogue".
4. Maximum 1-2 alternatives.
5. L'explication fait 1-2 phrases en français simple, accessible à un non-spécialiste. Pas de jargon administratif sans définition.
6. NE PAS demander d'informations personnelles. NE PAS donner de conseil juridique au-delà du choix du parcours.
7. Si la question est hors-sujet (météo, vie privée, etc.), renvoie topSlug: null.`;

interface BundleForMatching {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  vocabularyTags: string[];
  toolNames: string[];
}

interface Suggestion {
  bundleId: string;
  slug: string;
  name: string;
  score: number;
  reason?: string;
}

export async function POST(req: NextRequest) {
  // Rate-limit : 20 requêtes / minute / IP (l'IA est facturée)
  const ip = getClientIp(req);
  const rl = checkRateLimit(`intent-detect:${ip}`, { windowMs: 60_000, max: 20 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes — réessayez dans une minute" },
      { status: 429 }
    );
  }

  let parsed;
  try {
    parsed = BodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof z.ZodError
            ? err.issues[0]?.message || "Données invalides"
            : "Données invalides",
      },
      { status: 400 }
    );
  }

  // Récupère les bundles actifs avec leurs outils
  const bundles = await prisma.documentBundle.findMany({
    where: { active: true },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      vocabularyTags: true,
      items: {
        select: {
          template: { select: { tool: { select: { name: true } } } },
          pdfForm: { select: { title: true } },
        },
      },
    },
  });

  const bundlesForMatching: BundleForMatching[] = bundles.map((b) => ({
    id: b.id,
    slug: b.slug,
    name: b.name,
    description: b.description,
    vocabularyTags: parseVocabularyTags(b.vocabularyTags),
    toolNames: b.items
      .map((it) => it.template?.tool.name ?? it.pdfForm?.title ?? null)
      .filter((n): n is string => n !== null),
  }));

  // 1) Matching local toujours calculé en fallback
  const localMatches = searchBundles(parsed.query, bundlesForMatching, 5);

  // 2) IA si activée
  const aiEnabled = (await getSetting(SETTING_KEYS.AI_HELP_ENABLED)) === "true";
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!aiEnabled || !apiKey || bundlesForMatching.length === 0) {
    return NextResponse.json({
      suggestions: localMatches.map((m) => ({
        bundleId: m.bundleId,
        slug: m.slug,
        name: m.name,
        score: m.score,
      })),
      aiUsed: false,
    });
  }

  // Catalogue pour le LLM — court pour rester dans le budget tokens
  const catalogue = bundlesForMatching
    .map(
      (b) =>
        `- ${b.slug}: « ${b.name} »${
          b.description ? ` — ${b.description.slice(0, 160)}` : ""
        }${b.vocabularyTags.length > 0 ? ` (tags: ${b.vocabularyTags.join(", ")})` : ""}`
    )
    .join("\n");

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        // Prompt caching sur le system prompt — économise sur les requêtes répétées
        system: [
          {
            type: "text",
            text: SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          {
            role: "user",
            content: [
              `Catalogue des parcours disponibles :`,
              catalogue,
              ``,
              `Description du citoyen :`,
              `« ${parsed.query} »`,
              ``,
              `Réponds en JSON strict.`,
            ].join("\n"),
          },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("Anthropic API error:", res.status, errText);
      return NextResponse.json({
        suggestions: localMatches.map((m) => ({
          bundleId: m.bundleId,
          slug: m.slug,
          name: m.name,
          score: m.score,
        })),
        aiUsed: false,
      });
    }

    const data = await res.json();
    const replyText: string = (data?.content?.[0]?.text || "").trim();
    const aiResult = parseAiReply(replyText);

    const aiTop = aiResult?.topSlug
      ? bundlesForMatching.find((b) => b.slug === aiResult.topSlug)
      : null;

    // Combine : IA top en premier, puis le local en fallback (dédupliqué)
    const suggestions: Suggestion[] = [];
    if (aiTop) {
      suggestions.push({
        bundleId: aiTop.id,
        slug: aiTop.slug,
        name: aiTop.name,
        score: 100,
        reason: aiResult?.explanation,
      });
    }
    for (const alt of aiResult?.alternatives ?? []) {
      const found = bundlesForMatching.find((b) => b.slug === alt);
      if (found && !suggestions.some((s) => s.slug === found.slug)) {
        suggestions.push({
          bundleId: found.id,
          slug: found.slug,
          name: found.name,
          score: 50,
        });
      }
    }
    for (const m of localMatches) {
      if (!suggestions.some((s) => s.slug === m.slug)) {
        suggestions.push({
          bundleId: m.bundleId,
          slug: m.slug,
          name: m.name,
          score: m.score,
        });
      }
    }

    return NextResponse.json({
      suggestions,
      aiUsed: true,
      aiMessage: aiResult?.explanation,
      usage: {
        inputTokens: data?.usage?.input_tokens,
        outputTokens: data?.usage?.output_tokens,
        cacheRead: data?.usage?.cache_read_input_tokens,
      },
    });
  } catch (err) {
    console.error("intent-detect error:", err);
    return NextResponse.json({
      suggestions: localMatches.map((m) => ({
        bundleId: m.bundleId,
        slug: m.slug,
        name: m.name,
        score: m.score,
      })),
      aiUsed: false,
    });
  }
}

interface AiReply {
  topSlug: string | null;
  explanation?: string;
  alternatives?: string[];
}

function parseAiReply(text: string): AiReply | null {
  if (!text) return null;
  // Le modèle renvoie parfois du markdown autour du JSON — on extrait
  const match = text.match(/\{[\s\S]*\}/);
  const jsonStr = match ? match[0] : text;
  try {
    const obj = JSON.parse(jsonStr);
    if (typeof obj !== "object" || obj === null) return null;
    const topSlug = typeof obj.topSlug === "string" ? obj.topSlug : null;
    const explanation = typeof obj.explanation === "string" ? obj.explanation : undefined;
    const alternatives = Array.isArray(obj.alternatives)
      ? obj.alternatives.filter((s: unknown): s is string => typeof s === "string")
      : undefined;
    return { topSlug, explanation, alternatives };
  } catch {
    return null;
  }
}
