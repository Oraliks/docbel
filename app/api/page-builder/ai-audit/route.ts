/**
 * POST /api/page-builder/ai-audit
 *
 * Audit IA d'une page de l'éditeur (lisibilité, accessibilité, SEO, complétude),
 * branché sur Claude Haiku (rapide/économe). On fournit le contenu texte aplati
 * de la page ; le modèle renvoie un score global + une liste d'« issues »
 * catégorisées et hiérarchisées.
 *
 * Admin-only, rate-limité, fail-soft si ANTHROPIC_API_KEY absente (→ aiDisabled
 * en 200). Le JSON renvoyé par le modèle est parsé défensivement (extraction de
 * l'objet `{…}`, try/catch, bornage de taille). Calque sur `ai-assist/route.ts`.
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

const AUDIT_SYSTEM = `Tu es un expert en qualité de contenu web pour un site d'information administrative belge (chômage, ONEM, CPAS, mutuelles…).
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
 * Parse défensif de la réponse du modèle : extraction de l'objet `{…}`,
 * try/catch, normalisation/bornage des champs. Renvoie `null` si inexploitable.
 */
function parseAuditJson(raw: string): AuditResult | null {
  let s = raw.trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) s = s.slice(start, end + 1);
  // Borne dure pour éviter de parser une sortie aberrante.
  if (s.length > 20000) s = s.slice(0, 20000);

  let obj: unknown;
  try {
    obj = JSON.parse(s);
  } catch {
    return null;
  }
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

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const ip = getClientIp(req);
  const rl = checkRateLimit(`pagebuilder:ai-audit:${ip}`, {
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
    parsed = AiAuditSchema.parse(body);
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
        error: "L'audit IA n'est pas configuré (ANTHROPIC_API_KEY).",
      },
      { status: 200 }
    );
  }

  const text = parsed.text.trim();
  if (!text) {
    return NextResponse.json(
      { error: "Aucun contenu à auditer" },
      { status: 400 }
    );
  }

  try {
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
    console.error("[ai-audit] error:", err);
    return NextResponse.json({ error: "Échec de l'appel IA" }, { status: 502 });
  }
}
