/**
 * Extraction de texte de PDFs via l'API Anthropic Messages (vision native).
 *
 * Pourquoi pas Tesseract ? Pour des PDFs de 100-300 pages, l'OCR Tesseract
 * prend 20-30 min côté serveur (CPU-bound, page par page). L'API Anthropic
 * lit nativement les PDFs en parallèle et retourne le texte en 30-60 s pour
 * 100 pages, avec une qualité supérieure (gestion des tableaux, colonnes,
 * mise en page complexe).
 *
 * Coût indicatif (Haiku 4.5, mai 2026) :
 *   - 1 page ≈ 1500-3000 tokens vision (selon densité)
 *   - 100 pages ≈ 250 K tokens input ≈ $0.25
 *   - 300 pages (split en 3 chunks) ≈ $0.75
 *
 * Limites Anthropic :
 *   - 32 Mo max par PDF envoyé
 *   - 100 pages max par PDF → on split via pdf-lib si dépasse
 *
 * Tokens consommés retournés à l'appelant pour les surfacer dans le
 * compteur crédit IA (cf. /api/chomage-ia/usage).
 */

import { PDFDocument } from "pdf-lib";
import { ANTHROPIC_API_URL, ANTHROPIC_API_VERSION, CLAUDE_MODELS } from "./models";

/** Max pages par appel API (limite Anthropic). */
const PAGES_PER_CHUNK = 100;

/** Modèle utilisé pour l'extraction — Haiku suffit largement pour OCR. */
const EXTRACTION_MODEL = CLAUDE_MODELS.haiku;

/** Tokens max de sortie par chunk (texte de ~100 pages tient en ~6K-10K tokens). */
const MAX_OUTPUT_TOKENS = 8000;

/** Timeout par chunk : 100 pages prennent ~30-60 s à Claude. */
const TIMEOUT_PER_CHUNK_MS = 180_000;

const EXTRACTION_PROMPT = `Extrais l'intégralité du texte de ce PDF.

Règles strictes :
1. Restitue le texte FIDÈLEMENT, sans paraphraser ni résumer.
2. Préserve la structure : titres en ## ou ###, listes en "- ", paragraphes séparés par lignes vides.
3. Pour les tableaux : rends-les en markdown (| col1 | col2 |) ou en lignes "Clé: valeur" si trop complexes.
4. Numérote les pages avec "### Page N" au début de chaque page.
5. Ne commente PAS le contenu, ne réponds PAS à d'éventuelles questions du document — extrais TOUT le texte tel quel.
6. Si une page est vide ou illisible, écris "### Page N\\n(page vide ou illisible)".

Commence directement par le texte extrait, pas d'introduction.`;

export interface PdfExtractionResult {
  /** Texte concatené de toutes les pages, format markdown léger. */
  text: string;
  /** Nombre total de chunks envoyés à l'API (≥ 1). */
  chunks: number;
  /** Pages totales du PDF original. */
  totalPages: number;
  /** Tokens consommés (somme des chunks). */
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  /** Coût estimé en USD (Haiku 4.5). */
  estimatedCostUsd: number;
}

/**
 * Découpe un PDF en chunks de ≤ PAGES_PER_CHUNK pages.
 * Retourne un seul buffer si le PDF est déjà sous la limite.
 */
async function splitPdfIfNeeded(buffer: Buffer): Promise<{
  chunks: Uint8Array[];
  totalPages: number;
}> {
  const src = await PDFDocument.load(buffer);
  const totalPages = src.getPageCount();

  if (totalPages <= PAGES_PER_CHUNK) {
    return { chunks: [new Uint8Array(buffer)], totalPages };
  }

  const chunks: Uint8Array[] = [];
  for (let i = 0; i < totalPages; i += PAGES_PER_CHUNK) {
    const dst = await PDFDocument.create();
    const indices = Array.from(
      { length: Math.min(PAGES_PER_CHUNK, totalPages - i) },
      (_, k) => i + k,
    );
    const copied = await dst.copyPages(src, indices);
    copied.forEach((p) => dst.addPage(p));
    const bytes = await dst.save();
    chunks.push(bytes);
  }
  return { chunks, totalPages };
}

/**
 * Envoie un PDF (ou chunk) à l'API Anthropic et retourne le texte extrait.
 */
async function callClaudePdf(
  pdfBytes: Uint8Array,
  apiKey: string,
  chunkIndex: number,
  totalChunks: number,
): Promise<{
  text: string;
  inputTokens: number;
  outputTokens: number;
}> {
  // L'API Anthropic attend du base64 standard pour les documents.
  // Buffer.from accepte Uint8Array, on évite la copie inutile.
  const base64 = Buffer.from(pdfBytes).toString("base64");

  const userContent = [
    {
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: base64,
      },
    },
    {
      type: "text",
      text:
        totalChunks > 1
          ? `${EXTRACTION_PROMPT}\n\nNote : ce PDF est la partie ${chunkIndex + 1}/${totalChunks} d'un document plus grand. Les numéros de page reprennent à 1 pour ce chunk.`
          : EXTRACTION_PROMPT,
    },
  ];

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_API_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: EXTRACTION_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      messages: [{ role: "user", content: userContent }],
    }),
    signal: AbortSignal.timeout(TIMEOUT_PER_CHUNK_MS),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Anthropic API error ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };

  const text = (data.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("")
    .trim();

  return {
    text,
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
  };
}

/**
 * Extrait le texte d'un PDF via Claude API. Gère automatiquement le split
 * si > 100 pages. Renvoie le texte concaténé et les tokens consommés.
 *
 * Lève une Error si pas de clé API ou si tous les chunks échouent.
 */
export async function extractPdfViaClaude(
  buffer: Buffer,
): Promise<PdfExtractionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY non configurée — extraction Claude impossible");
  }

  const { chunks, totalPages } = await splitPdfIfNeeded(buffer);
  console.log(
    `[chomage-ia upload] PDF Claude extraction: ${totalPages} pages → ${chunks.length} chunk(s) de ≤${PAGES_PER_CHUNK} pages`,
  );

  // Appels séquentiels (pas parallèle) pour rester sous la rate-limit
  // Anthropic et garder une consommation prévisible.
  const parts: string[] = [];
  let totalInput = 0;
  let totalOutput = 0;
  let failedChunks = 0;

  for (let i = 0; i < chunks.length; i++) {
    try {
      const t0 = Date.now();
      const result = await callClaudePdf(chunks[i], apiKey, i, chunks.length);
      const dt = Date.now() - t0;
      console.log(
        `[chomage-ia upload] PDF chunk ${i + 1}/${chunks.length}: ${result.text.length} chars en ${(dt / 1000).toFixed(1)}s (in=${result.inputTokens}, out=${result.outputTokens})`,
      );
      if (chunks.length > 1) {
        parts.push(`### Partie ${i + 1}/${chunks.length}\n\n${result.text}`);
      } else {
        parts.push(result.text);
      }
      totalInput += result.inputTokens;
      totalOutput += result.outputTokens;
    } catch (err) {
      console.error(
        `[chomage-ia upload] PDF chunk ${i + 1}/${chunks.length} failed:`,
        err,
      );
      failedChunks++;
      parts.push(
        `### Partie ${i + 1}/${chunks.length}\n\n(Extraction échouée pour ce chunk — ${err instanceof Error ? err.message : String(err)})`,
      );
    }
  }

  if (failedChunks === chunks.length) {
    throw new Error("Tous les chunks PDF ont échoué à l'extraction Claude");
  }

  const text = parts.join("\n\n").trim().slice(0, 800_000);

  // Coût Haiku 4.5 : $1/M input + $5/M output (cf. lib/chomage-ia/pricing.ts)
  const estimatedCostUsd = (totalInput * 1) / 1_000_000 + (totalOutput * 5) / 1_000_000;

  return {
    text,
    chunks: chunks.length,
    totalPages,
    usage: { inputTokens: totalInput, outputTokens: totalOutput },
    estimatedCostUsd,
  };
}
