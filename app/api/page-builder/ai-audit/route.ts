/**
 * POST /api/page-builder/ai-audit
 *
 * Audit IA d'une page de l'éditeur (lisibilité, accessibilité, SEO, complétude),
 * branché sur Claude Haiku (rapide/économe). On fournit le contenu texte aplati
 * de la page ; le modèle renvoie un score global + une liste d'« issues »
 * catégorisées et hiérarchisées.
 *
 * Admin-only, rate-limité, fail-soft si ANTHROPIC_API_KEY absente (→ aiDisabled
 * en 200). Plomberie factorisée par `withAiRoute` (lib/page-builder/ai-route.ts) ;
 * le JSON renvoyé par le modèle est parsé défensivement (`extractJson` + bornage,
 * normalisation des champs).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { callClaude } from "@/lib/chomage-ia/anthropic";
import { CLAUDE_MODELS } from "@/lib/chomage-ia/models";
import { withAiRoute, extractJson } from "@/lib/page-builder/ai-route";
import { BELGIAN_ADMIN_PERSONA } from "@/lib/page-builder/ai-prompts";

const AiAuditSchema = z.object({
  text: z.string().max(20000).optional().default(""),
});

const CATEGORIES = ["lisibilité", "accessibilité", "seo", "complétude"] as const;
const SEVERITIES = ["info", "warning", "error"] as const;

type AuditCategory = (typeof CATEGORIES)[number];
type AuditSeverity = (typeof SEVERITIES)[number];

interface AuditIssue {
  category: AuditCategory;
  severity: AuditSeverity;
  message: string;
}

interface AuditResult {
  score: number;
  issues: AuditIssue[];
}

const AUDIT_SYSTEM = `Tu es un expert en qualité de contenu web pour ${BELGIAN_ADMIN_PERSONA}.
On te fournit le contenu texte d'une page. Tu réalises un audit structuré sur 4 axes :
- lisibilité : clarté, phrases courtes, jargon, niveau de langue (cible grand public B1), structure logique.
- accessibilité : titres hiérarchisés, libellés de liens explicites, contenu compréhensible hors contexte visuel.
- seo : présence d'un titre fort, mots-clés pertinents, longueur et richesse du contenu, intentions de recherche.
- complétude : informations manquantes, sections attendues absentes, appels à l'action, prochaines étapes.

Règles STRICTES :
- Français uniquement, ton clair et concret. Chaque "message" est une remarque actionnable et brève (1 phrase).
- N'invente AUCUN fait précis (montant, délai, référence légale) : juge la qualité, pas le fond juridique.
- "score" est un entier de 0 à 100 (qualité globale de la page).
- "category" ∈ {"lisibilité","accessibilité","seo","complétude"}. "severity" ∈ {"info","warning","error"}.
- 3 à 10 issues maximum, priorisées. Si la page est excellente, renvoie peu d'issues (severity "info").
- Réponds UNIQUEMENT avec un JSON valide de la forme {"score":number,"issues":[{"category":"…","severity":"…","message":"…"}]}, sans texte autour ni bloc de code.`;

/**
 * Parse défensif de la réponse du modèle : extraction de l'objet `{…}` via
 * `extractJson`, normalisation/bornage des champs. Renvoie `null` si inexploitable.
 */
function parseAuditJson(raw: string): AuditResult | null {
  const obj = extractJson(raw, "object");
  if (!obj || typeof obj !== "object") return null;

  const o = obj as Record<string, unknown>;
  const rawScore = typeof o.score === "number" ? o.score : Number(o.score);
  const score = Number.isFinite(rawScore)
    ? Math.max(0, Math.min(100, Math.round(rawScore)))
    : 0;

  const rawIssues = Array.isArray(o.issues) ? o.issues : [];
  const issues: AuditIssue[] = rawIssues
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((x) => {
      const category = (CATEGORIES as readonly string[]).includes(
        x.category as string
      )
        ? (x.category as AuditCategory)
        : "complétude";
      const severity = (SEVERITIES as readonly string[]).includes(
        x.severity as string
      )
        ? (x.severity as AuditSeverity)
        : "info";
      const message =
        typeof x.message === "string" ? x.message.trim().slice(0, 400) : "";
      return { category, severity, message };
    })
    .filter((iss) => iss.message.length > 0)
    .slice(0, 12);

  return { score, issues };
}

export const POST = withAiRoute(
  {
    name: "ai-audit",
    schema: AiAuditSchema,
    rateLimit: { windowMs: 60_000, max: 20 },
  },
  async ({ input }) => {
    const text = input.text.trim();
    if (!text) {
      return NextResponse.json(
        { error: "Aucun contenu à auditer" },
        { status: 400 }
      );
    }

    const { text: raw } = await callClaude({
      model: CLAUDE_MODELS.haiku,
      systemPrompt: AUDIT_SYSTEM,
      messages: [
        { role: "user", content: `Contenu de la page :\n${text.slice(0, 12000)}` },
      ],
      maxTokens: 1200,
      timeoutMs: 30_000,
    });

    const result = parseAuditJson(raw);
    if (!result) {
      return NextResponse.json(
        { error: "Audit généré invalide" },
        { status: 502 }
      );
    }
    return NextResponse.json(result);
  }
);
