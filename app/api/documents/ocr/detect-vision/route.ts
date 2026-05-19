import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { checkRateLimit, getClientIp } from "@/lib/documents/rate-limit";
import { getSetting, SETTING_KEYS } from "@/lib/app-settings";

/// POST /api/documents/ocr/detect-vision
///
/// Détection IA Vision d'une page de PDF officiel belge.
/// L'image rendue de la page est envoyée à Claude Sonnet 4.5 qui identifie
/// toutes les zones de saisie (champs, cases à cocher, dates, signatures…)
/// avec leur position approximative et leur métadonnée.
///
/// Pourquoi Sonnet et pas Haiku : la précision sur les petits éléments de
/// formulaire administratif (cases NISS à 8 segments, dates JJ/MM/AAAA,
/// underscores faiblement contrastés) demande la capacité vision de Sonnet.
/// Coût ~$0.01-0.02 par page, négligeable pour le ROI sur le temps admin.
///
/// **Sécurité** :
/// - Auth admin obligatoire
/// - Rate-limit 5/min/IP (vision est cher)
/// - Toggle global AI_HELP_ENABLED requis
/// - ANTHROPIC_API_KEY requise côté serveur

const BodySchema = z.object({
  /// Data URL de l'image PNG/JPEG de la page rendue (côté client via pdfjs)
  imageDataUrl: z.string().min(50).max(8_000_000), // ~6MB max
  pageIndex: z.number().int().min(0).max(500),
  templateName: z.string().min(1).max(200),
  organisme: z.string().max(120).optional(),
  templateId: z.string().max(60).optional(),
  /// Largeur et hauteur de la page en POINTS PDF (origine bas-gauche)
  /// pour mapper les coordonnées fractionnelles de l'IA vers le système PDF.
  pdfPageWidth: z.number().positive(),
  pdfPageHeight: z.number().positive(),
});

const SYSTEM_PROMPT = `Tu es un assistant expert en identification de zones de saisie sur les formulaires administratifs belges (ONEM, Actiris, FOREM, CPAS, mutuelles, communes).

Ton rôle : analyser l'IMAGE d'une page de formulaire et identifier TOUTES les zones où un citoyen doit écrire/cocher/signer.

**RÈGLE CRITIQUE — Position des champs :**
La position (x, y, w, h) que tu renvoies est celle de la **ZONE VIDE où l'utilisateur va écrire**, JAMAIS celle du label qui décrit le champ.

Exemples concrets :
- Pour "Prénom et nom ............." : la position couvre les pointillés à droite du label, PAS le texte "Prénom et nom".
- Pour "Date : __/__/____" : la position couvre les underscores après les deux points, PAS le mot "Date".
- Pour une case à cocher "☐ Travailleur" : la position couvre la case ☐, PAS le texte "Travailleur".
- Pour "Numéro NISS __ __ __ __ __ / __ __ __" : la position englobe TOUS les underscores ensemble (les segments séparés par espaces), PAS le label "Numéro NISS".
- Pour une signature : la position couvre la zone vide en bas, généralement à droite ou en dessous du mot "Signature".

**Si tu détectes un encadré rectangulaire vide** (genre rectangle bordé sans contenu), la position couvre EXACTEMENT ce rectangle.

**Types de zones à détecter** :
- Lignes pointillées (…), traits (___) ou cases vides où l'utilisateur écrit
- Cases à cocher (□, ☐) avec leur label associé
- Suites de petites cases pour caractères (8 cases pour NISS, 4 pour code postal, etc.)
- Zones de signature
- Champs de date (formats __/__/____ ou JJ/MM/AAAA)
- Zones de texte multi-lignes (motif, commentaires, observations)
- Champs déjà délimités par un encadré

**Format de réponse** : UNIQUEMENT du JSON valide selon ce schéma EXACT :
{
  "fields": [
    {
      "label": "texte EXACT du label tel qu'écrit (nettoyé des (*), ::, ____ mais sans paraphrase)",
      "type": "text" | "textarea" | "number" | "date" | "checkbox" | "niss" | "iban" | "postal_be" | "tva_be" | "bce" | "phone_be" | "signature" | "select",
      "x": 0.0-1.0,
      "y": 0.0-1.0,
      "w": 0.0-1.0,
      "h": 0.0-1.0,
      "confidence": 0-100,
      "helpText": "aide courte optionnelle (≤80 chars) ou null",
      "presetName": "nom EXACT d'un preset de la liste fournie, ou null"
    }
  ]
}

**Coordonnées** : x, y sont le coin HAUT-GAUCHE de la zone VIDE, en FRACTION de l'image (0=gauche/haut, 1=droite/bas). w, h sont les dimensions en fraction.

**Règles strictes** :
1. Seules les ZONES DE SAISIE. PAS les paragraphes informatifs, en-têtes, logos, tableaux statiques.
2. Labels = texte EXACT visible sur le PDF (pas une reformulation). C'est utilisé pour matcher avec l'extraction native du PDF.
3. Pour les types belges (NISS, IBAN, BCE, code postal, téléphone) : utilise le type dédié + le preset correspondant si présent dans la liste.
4. Si la zone est ambiguë : type="text" + confidence basse (40-60).
5. NE PAS inventer de champs invisibles dans l'image.
6. NE PAS demander d'infos personnelles, NE PAS donner de conseil juridique.`;

interface VisionField {
  label: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  confidence: number;
  helpText: string | null;
  presetName: string | null;
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const ip = getClientIp(req);
  const rl = checkRateLimit(`detect-vision:${ip}`, { windowMs: 60_000, max: 5 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes — réessayez dans une minute" },
      { status: 429 }
    );
  }

  const enabled = await getSetting(SETTING_KEYS.AI_HELP_ENABLED);
  if (enabled !== "true") {
    return NextResponse.json(
      { error: "Aide IA désactivée — activez le toggle dans les paramètres documents" },
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

  // Parse data URL: data:image/<type>;base64,<data>
  const match = body.imageDataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
  if (!match) {
    return NextResponse.json(
      { error: "Format d'image invalide (data URL PNG/JPEG/WebP attendu)" },
      { status: 400 }
    );
  }
  const mediaType = (match[1] === "jpg" ? "jpeg" : match[1]) as "png" | "jpeg" | "webp";
  const imageData = match[2];

  // Récupère les presets pour permettre à l'IA de suggérer le bon
  const presets = await prisma.fieldValidationPreset.findMany({
    select: { id: true, name: true, category: true },
    take: 200,
  });

  // Récupère les corrections passées pour few-shot examples (si on connaît le templateId)
  const examples = await buildExamples(body.templateId, presets);

  const presetsList =
    presets.length > 0
      ? presets.map((p) => `- "${p.name}" [${p.category}]`).join("\n")
      : "(aucun preset disponible)";

  const examplesBlock =
    examples.length > 0
      ? [
          "",
          "Style de labels attendu (basé sur les corrections passées de l'admin) :",
          ...examples.slice(0, 10).map(
            (e) =>
              `- "${e.cleanLabel}"${e.fieldType ? ` (type=${e.fieldType})` : ""}${e.presetName ? ` → preset="${e.presetName}"` : ""}`
          ),
        ].join("\n")
      : "";

  const textPart = [
    `Document : ${body.templateName}`,
    body.organisme ? `Organisme : ${body.organisme}` : null,
    `Page : ${body.pageIndex + 1}`,
    "",
    "Presets de validation disponibles (utilise le nom EXACT) :",
    presetsList,
    examplesBlock || null,
    "",
    "Analyse l'image ci-dessous et liste TOUTES les zones de saisie en JSON strict selon le schéma indiqué.",
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
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 6000,
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
              { type: "text", text: textPart },
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: `image/${mediaType}`,
                  data: imageData,
                },
              },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("Vision API error:", res.status, errText);
      return NextResponse.json({ error: "Erreur de l'IA Vision" }, { status: 502 });
    }

    const data = await res.json();
    const replyText: string = (data?.content?.[0]?.text || "").trim();

    const fields = parseVisionReply(replyText);
    if (!fields) {
      console.error("Failed to parse vision reply:", replyText.slice(0, 500));
      return NextResponse.json({ error: "Réponse IA mal formée" }, { status: 502 });
    }

    // Map les positions fractionnelles vers les coordonnées PDF (origine bas-gauche)
    const presetsByName = new Map(presets.map((p) => [p.name.toLowerCase(), p.id]));
    const detections = fields.map((f) => {
      // L'IA renvoie x,y,w,h en fraction d'image, coin haut-gauche
      // → on convertit en PDF points avec origine bas-gauche
      const pdfX = clamp01(f.x) * body.pdfPageWidth;
      const pdfH = clamp01(f.h) * body.pdfPageHeight;
      const topFromBottomFraction = 1 - clamp01(f.y) - clamp01(f.h);
      const pdfY = topFromBottomFraction * body.pdfPageHeight;
      const pdfW = clamp01(f.w) * body.pdfPageWidth;

      const presetId = f.presetName
        ? presetsByName.get(f.presetName.toLowerCase()) ?? null
        : null;

      return {
        type: f.type,
        label: f.label,
        x: pdfX,
        // Empêche les coords négatives si l'IA renvoie y+h > 1
        y: Math.max(0, pdfY),
        w: pdfW,
        h: pdfH,
        confidence: f.confidence,
        page: body.pageIndex,
        helpText: f.helpText,
        presetName: f.presetName,
        presetId,
      };
    });

    return NextResponse.json({
      detections,
      durationMs: Date.now() - startedAt,
      usage: {
        inputTokens: data?.usage?.input_tokens,
        outputTokens: data?.usage?.output_tokens,
        cacheRead: data?.usage?.cache_read_input_tokens,
        cacheWrite: data?.usage?.cache_creation_input_tokens,
      },
    });
  } catch (err) {
    console.error("detect-vision error:", err);
    return NextResponse.json({ error: "Échec de l'appel IA" }, { status: 502 });
  }
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function parseVisionReply(text: string): VisionField[] | null {
  if (!text) return null;
  const match = text.match(/\{[\s\S]*\}/);
  const jsonStr = match ? match[0] : text;
  try {
    const obj = JSON.parse(jsonStr);
    if (!obj || typeof obj !== "object") return null;
    const arr = (obj as { fields?: unknown }).fields;
    if (!Array.isArray(arr)) return null;
    const out: VisionField[] = [];
    for (const raw of arr) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as Record<string, unknown>;
      if (typeof r.label !== "string" || typeof r.type !== "string") continue;
      if (
        typeof r.x !== "number" ||
        typeof r.y !== "number" ||
        typeof r.w !== "number" ||
        typeof r.h !== "number"
      ) {
        continue;
      }
      out.push({
        label: r.label,
        type: r.type,
        x: r.x,
        y: r.y,
        w: r.w,
        h: r.h,
        confidence: typeof r.confidence === "number" ? r.confidence : 70,
        helpText: typeof r.helpText === "string" ? r.helpText : null,
        presetName: typeof r.presetName === "string" ? r.presetName : null,
      });
    }
    return out;
  } catch {
    return null;
  }
}

/// Reprend la mémoire de corrections pour donner un échantillon de style à Sonnet.
async function buildExamples(
  templateId: string | undefined,
  presets: { id: string; name: string }[]
): Promise<
  Array<{
    cleanLabel: string;
    fieldType: string | null;
    presetName: string | null;
  }>
> {
  const where = templateId
    ? { OR: [{ templateId }, { templateId: null }] }
    : { templateId: null };
  let corrections;
  try {
    corrections = await prisma.ocrCorrectionMemory.findMany({
      where,
      orderBy: [{ occurrences: "desc" }, { updatedAt: "desc" }],
      take: 30,
    });
  } catch {
    return [];
  }
  const presetById = new Map(presets.map((p) => [p.id, p.name]));
  // Déduplique par cleanLabel
  const seen = new Set<string>();
  const out: Array<{
    cleanLabel: string;
    fieldType: string | null;
    presetName: string | null;
  }> = [];
  for (const c of corrections) {
    const key = c.cleanLabel.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      cleanLabel: c.cleanLabel,
      fieldType: c.fieldType,
      presetName: c.presetId ? presetById.get(c.presetId) ?? null : null,
    });
  }
  return out;
}

