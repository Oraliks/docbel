import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { checkRateLimit, getClientIp } from "@/lib/documents/rate-limit";
import { getSetting, SETTING_KEYS } from "@/lib/app-settings";
import { findBestCorrection, type StoredCorrection } from "@/lib/documents/ocr-corrections";

/// POST /api/documents/ocr/enrich
///
/// Enrichit en lot une liste de détections OCR via Claude Haiku 4.5.
/// Pour chaque détection (label brut + type proposé), l'IA renvoie :
///   - un libellé nettoyé en langage clair
///   - un type plus précis si pertinent
///   - le nom d'un preset de validation pertinent (parmi ceux fournis)
///   - un helpText court pour le citoyen (optionnel)
///
/// L'utilisateur valide ensuite les suggestions dans un panneau de revue côté
/// admin (dialog) avant de les appliquer aux détections en attente.
///
/// **Sécurité** :
/// - Auth admin requise (le coût LLM est non-négligeable)
/// - Rate-limit 10/min/IP
/// - Toggle global AI_HELP_ENABLED doit être à "true"
/// - ANTHROPIC_API_KEY doit être configurée

const DetectionInput = z.object({
  index: z.number().int().min(0),
  label: z.string().max(300),
  type: z.string().max(40),
});

const PresetInput = z.object({
  id: z.string().min(1).max(60),
  name: z.string().min(1).max(120),
  category: z.string().max(60).optional(),
});

const BodySchema = z.object({
  templateName: z.string().min(1).max(200),
  organisme: z.string().max(120).optional(),
  /// Si fourni, on récupère les corrections du template courant en plus des globales
  /// (priorité aux exemples spécifiques au template).
  templateId: z.string().max(60).optional(),
  detections: z.array(DetectionInput).min(1).max(80),
  presets: z.array(PresetInput).max(200),
});

const SYSTEM_PROMPT = `Tu es un assistant administratif expert des formulaires officiels belges (ONEM, RVA, Actiris, FOREM, VDAB, CPAS, OCMW, mutuelles, communes).

Ton rôle : enrichir les métadonnées de zones de saisie détectées par OCR sur un PDF officiel belge, pour aider un administrateur à configurer un modèle de formulaire.

Pour chaque détection fournie, tu DOIS proposer :
- "label" : libellé nettoyé en langage clair (corrige les erreurs OCR évidentes, retire la ponctuation parasite, met en forme proprement)
- "type" : type de champ. Valeurs autorisées : text, textarea, number, date, checkbox, select, niss, iban, postal_be, tva_be, bce, phone_be, signature
- "presetName" : nom EXACT d'un preset de la liste fournie, OU null si aucun ne convient
- "helpText" : aide courte (≤ 80 caractères, 1 phrase, langage simple, pas de jargon) OU null

Règles strictes :
1. Réponds UNIQUEMENT en JSON valide, format EXACT :
   { "suggestions": [{ "index": number, "label": string, "type": string, "presetName": string | null, "helpText": string | null }, ...] }
2. Renvoie une suggestion par index reçu (même si tu ne changes rien).
3. presetName DOIT être un nom EXACT de la liste — pas inventé. Si rien ne correspond, renvoie null.
4. Si tu n'es pas sûr du type, garde celui fourni en entrée.
5. helpText : optionnel, accessible à un non-spécialiste, sans jargon administratif. null si pas pertinent.
6. NE PAS demander d'infos personnelles, NE PAS donner de conseil juridique.
7. Pour les labels "Date" sans précision : type=date sans helpText sauf si le contexte indique une date spécifique (naissance, échéance, etc.).
8. Pour les NISS, IBAN, BCE, codes postaux belges, téléphones belges : utilise les types dédiés et le preset correspondant si présent dans la liste.`;

interface SuggestionFromAi {
  index: number;
  label: string;
  type: string;
  presetName: string | null;
  helpText: string | null;
}

interface EnrichedSuggestion extends SuggestionFromAi {
  presetId: string | null;
}

export async function POST(req: NextRequest) {
  // Auth admin
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  // Rate-limit (10/min/IP — coût LLM)
  const ip = getClientIp(req);
  const rl = checkRateLimit(`ocr-enrich:${ip}`, { windowMs: 60_000, max: 10 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes — réessayez dans une minute" },
      { status: 429 }
    );
  }

  // Toggle global
  const enabled = await getSetting(SETTING_KEYS.AI_HELP_ENABLED);
  if (enabled !== "true") {
    return NextResponse.json(
      { error: "Aide IA désactivée — activez-la dans les paramètres documents" },
      { status: 403 }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY non configurée sur le serveur" },
      { status: 503 }
    );
  }

  // Parse body
  let body;
  try {
    body = BodySchema.parse(await req.json());
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

  // Construit le message utilisateur
  const presetsList =
    body.presets.length > 0
      ? body.presets
          .map(
            (p) =>
              `- "${p.name}"${p.category ? ` [${p.category}]` : ""}`
          )
          .join("\n")
      : "(aucun preset disponible — laisse presetName à null)";

  const detectionsList = body.detections
    .map(
      (d) =>
        `${d.index}. label="${d.label.replace(/"/g, '\\"')}" | type=${d.type}`
    )
    .join("\n");

  // Few-shot examples : on récupère les corrections passées les plus pertinentes
  // pour les labels de cette requête. Cela donne à Claude un signal fort sur le
  // style attendu et la cohérence avec les autres templates de l'utilisateur.
  const examples = await buildFewShotExamples(
    body.detections,
    body.templateId,
    body.presets
  );
  const examplesBlock = examples.length > 0
    ? [
        "",
        "Corrections passées sur des labels similaires (suis ce style pour rester cohérent) :",
        ...examples.map(
          (e) =>
            `- "${e.rawLabel}" → label="${e.cleanLabel}"${e.fieldType ? `, type=${e.fieldType}` : ""}${e.presetName ? `, presetName="${e.presetName}"` : ""}`
        ),
      ].join("\n")
    : "";

  const userMessage = [
    `Document : ${body.templateName}`,
    body.organisme ? `Organisme : ${body.organisme}` : null,
    "",
    "Presets disponibles :",
    presetsList,
    examplesBlock || null,
    "",
    `Détections à enrichir (${body.detections.length}) :`,
    detectionsList,
    "",
    "Réponds en JSON strict comme indiqué dans le system prompt.",
  ]
    .filter((l) => l !== null && l !== "")
    .join("\n");

  try {
    const startedAt = Date.now();
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4000,
        // Cache le system prompt — il est gros et identique entre toutes les requêtes
        system: [
          {
            type: "text",
            text: SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: userMessage }],
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("Anthropic API error (ocr-enrich):", res.status, errText);
      return NextResponse.json(
        { error: "Erreur de l'assistant IA" },
        { status: 502 }
      );
    }

    const data = await res.json();
    const replyText: string = (data?.content?.[0]?.text || "").trim();

    const parsed = parseAiReply(replyText);
    if (!parsed) {
      console.error("Failed to parse AI reply:", replyText.slice(0, 500));
      return NextResponse.json(
        { error: "Réponse IA mal formée" },
        { status: 502 }
      );
    }

    // Indexe les presets par nom (insensible à la casse) pour mapper presetName → id
    const presetByName = new Map(
      body.presets.map((p) => [p.name.toLowerCase(), p.id])
    );

    // Construit la liste finale enrichie (index aligné sur les détections d'entrée)
    const inputIndexes = new Set(body.detections.map((d) => d.index));
    const enrichedById = new Map<number, EnrichedSuggestion>();
    for (const s of parsed) {
      if (!inputIndexes.has(s.index)) continue;
      const presetId = s.presetName
        ? presetByName.get(s.presetName.toLowerCase()) ?? null
        : null;
      enrichedById.set(s.index, { ...s, presetId });
    }

    // Pour chaque détection d'entrée, soit on a une suggestion, soit on renvoie
    // la valeur d'entrée inchangée (filet de sécurité si l'IA a oublié un index).
    const suggestions: EnrichedSuggestion[] = body.detections.map((d) => {
      const enriched = enrichedById.get(d.index);
      if (enriched) return enriched;
      return {
        index: d.index,
        label: d.label,
        type: d.type,
        presetName: null,
        presetId: null,
        helpText: null,
      };
    });

    return NextResponse.json({
      suggestions,
      durationMs: Date.now() - startedAt,
      usage: {
        inputTokens: data?.usage?.input_tokens,
        outputTokens: data?.usage?.output_tokens,
        cacheRead: data?.usage?.cache_read_input_tokens,
        cacheWrite: data?.usage?.cache_creation_input_tokens,
      },
    });
  } catch (err) {
    console.error("ocr-enrich error:", err);
    return NextResponse.json(
      { error: "Échec de l'appel IA" },
      { status: 502 }
    );
  }
}

/// Construit la liste des "corrections passées" à injecter dans le prompt comme
/// few-shot examples. Stratégie :
///   1. On récupère les corrections du template courant + les globales (templateId=null)
///   2. Pour chaque détection à enrichir, on cherche la meilleure correction par
///      fuzzy match (Levenshtein normalisé)
///   3. On dédoublonne et on garde max 15 exemples (limite tokens)
///   4. On résout le presetId → presetName depuis la liste de presets fournie
async function buildFewShotExamples(
  detections: { label: string }[],
  templateId: string | undefined,
  presets: { id: string; name: string }[]
): Promise<
  Array<{
    rawLabel: string;
    cleanLabel: string;
    fieldType: string | null;
    presetName: string | null;
  }>
> {
  if (detections.length === 0) return [];

  // Récupère un pool de corrections candidates (template + globales)
  const where = templateId
    ? { OR: [{ templateId }, { templateId: null }] }
    : { templateId: null };

  let corrections;
  try {
    corrections = await prisma.ocrCorrectionMemory.findMany({
      where,
      orderBy: [{ occurrences: "desc" }, { updatedAt: "desc" }],
      take: 300,
    });
  } catch (err) {
    console.warn("buildFewShotExamples: lookup failed", err);
    return [];
  }

  if (corrections.length === 0) return [];

  // Adapt to StoredCorrection shape pour findBestCorrection
  const pool: StoredCorrection[] = corrections.map((c) => ({
    id: c.id,
    templateId: c.templateId,
    rawLabel: c.rawLabel,
    cleanLabel: c.cleanLabel,
    fieldType: c.fieldType,
    presetId: c.presetId,
    occurrences: c.occurrences,
  }));

  const presetById = new Map(presets.map((p) => [p.id, p.name]));
  const seen = new Set<string>();
  const examples: Array<{
    rawLabel: string;
    cleanLabel: string;
    fieldType: string | null;
    presetName: string | null;
  }> = [];

  for (const det of detections) {
    const match = findBestCorrection(det.label, pool, 0.3);
    if (!match) continue;
    const key = `${match.rawLabel}::${match.cleanLabel}`;
    if (seen.has(key)) continue;
    seen.add(key);
    examples.push({
      rawLabel: match.rawLabel,
      cleanLabel: match.cleanLabel,
      fieldType: match.fieldType,
      presetName: match.presetId ? presetById.get(match.presetId) ?? null : null,
    });
    if (examples.length >= 15) break;
  }

  return examples;
}

function parseAiReply(text: string): SuggestionFromAi[] | null {
  if (!text) return null;
  // L'IA renvoie parfois du markdown autour du JSON (```json ... ```)
  const match = text.match(/\{[\s\S]*\}/);
  const jsonStr = match ? match[0] : text;
  try {
    const obj = JSON.parse(jsonStr);
    if (!obj || typeof obj !== "object") return null;
    const arr = (obj as { suggestions?: unknown }).suggestions;
    if (!Array.isArray(arr)) return null;
    const out: SuggestionFromAi[] = [];
    for (const raw of arr) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as Record<string, unknown>;
      if (typeof r.index !== "number") continue;
      if (typeof r.label !== "string" || typeof r.type !== "string") continue;
      out.push({
        index: r.index,
        label: r.label,
        type: r.type,
        presetName: typeof r.presetName === "string" ? r.presetName : null,
        helpText: typeof r.helpText === "string" ? r.helpText : null,
      });
    }
    return out;
  } catch {
    return null;
  }
}
