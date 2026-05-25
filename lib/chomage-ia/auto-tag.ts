/**
 * Auto-tag d'une KnowledgeSource via Claude Haiku 4.5.
 *
 * Stratégie :
 *   - On envoie les 5000 premiers caractères du `content` à Haiku avec un prompt
 *     court qui exige un JSON array de 3-5 tags FR (1-2 mots, sans accents).
 *   - Si l'admin a déjà fourni des tags, on MERGE en dédupliquant case-insensitive.
 *   - Si l'appel échoue (rate limit, JSON invalide, clé manquante), on retourne
 *     simplement les tags existants : pas de blocage, pas d'erreur visible.
 *
 * Utilisation typique : appelée en background depuis l'upload pour ne pas
 * retarder la réponse au client (`void (async () => { ... })()`).
 */

import { prisma } from "@/lib/prisma";
import {
  callClaude,
  AnthropicError,
  hasAnthropicKey,
} from "./anthropic";
import { CLAUDE_MODELS } from "./models";

const AUTOTAG_SYSTEM_PROMPT = `Tu es un classifieur de sources documentaires sur le chômage belge.

Ta tâche : produire 3 à 5 tags courts (1-2 mots chacun) en français, sans accents, qui décrivent le contenu pour aider à le retrouver via filtre.

Règles strictes :
- Format : JSON array uniquement, ex: ["chomage", "AGR", "ONEM", "2025"].
- Pas d'accents, pas d'espaces dans les tags (ou max 1 espace pour un tag à 2 mots).
- Pas de phrase, pas de prose, pas de markdown, pas de préfixe.
- Si le contenu est inutilisable (placeholder, erreur d'extraction), retourne [].`;

/**
 * Nettoie un tag : retire accents, espace au max, troncature.
 * Reflète la même règle que celle utilisée dans source-form (cap 50 chars).
 */
function sanitizeTag(t: string): string | null {
  if (typeof t !== "string") return null;
  const cleaned = t
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9 \-_]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50);
  if (cleaned.length === 0) return null;
  return cleaned;
}

/**
 * Merge deux listes de tags case-insensitive (sans accents pour le dédup).
 * Conserve la casse de la première occurrence pour chaque clé.
 */
function mergeTags(a: string[], b: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of [...a, ...b]) {
    const cleaned = sanitizeTag(t);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
    if (out.length >= 20) break;
  }
  return out;
}

/**
 * Appelle Haiku pour proposer 3-5 tags et merge avec les tags existants.
 *
 * @param content   Texte de la source (sera tronqué à 5000 premiers chars).
 * @param title     Titre de la source (passé en complément du content).
 * @param existing  Tags déjà fournis par l'admin (préservés en priorité).
 * @returns         Liste fusionnée et dédupliquée, ou `existing` si l'appel échoue.
 */
export async function autoTagSource(
  content: string,
  title: string,
  existing: string[] = []
): Promise<string[]> {
  // Fallback immédiat si pas de clé API ou contenu inexploitable.
  if (!hasAnthropicKey()) return mergeTags(existing, []);
  const trimmed = (content ?? "").trim();
  if (trimmed.length < 50) return mergeTags(existing, []);

  const userMsg = [
    `Titre : ${title}`,
    "",
    "Contenu (extrait) :",
    trimmed.slice(0, 5000),
  ].join("\n");

  try {
    const res = await callClaude({
      model: CLAUDE_MODELS.haiku,
      systemPrompt: AUTOTAG_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMsg }],
      maxTokens: 120,
      timeoutMs: 20_000,
    });
    const parsed = parseTagsResponse(res.text);
    return mergeTags(existing, parsed);
  } catch (err) {
    if (err instanceof AnthropicError) {
      console.warn(
        `[chomage-ia auto-tag] Anthropic error ${err.status} — fallback sur tags existants`
      );
    } else {
      console.warn("[chomage-ia auto-tag] Erreur inattendue:", err);
    }
    return mergeTags(existing, []);
  }
}

/**
 * Parse la réponse Haiku : on attend un JSON array `["tag1", "tag2", ...]`.
 * Tolère un éventuel bloc markdown ```json … ``` ou des espaces / prose
 * autour. Retourne [] si rien d'exploitable.
 */
function parseTagsResponse(text: string): string[] {
  if (!text) return [];
  // Extrait un éventuel tableau JSON le plus large possible dans la réponse.
  const match = text.match(/\[[\s\S]*?\]/);
  if (!match) return [];
  try {
    const arr = JSON.parse(match[0]);
    if (!Array.isArray(arr)) return [];
    const out: string[] = [];
    for (const item of arr) {
      const cleaned = sanitizeTag(typeof item === "string" ? item : String(item));
      if (cleaned) out.push(cleaned);
      if (out.length >= 10) break;
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Helper background : auto-tag une source déjà créée en base puis update
 * son enregistrement. Ne throw jamais — pure tâche fire-and-forget.
 *
 * Appelée typiquement comme :
 *   void runAutoTagInBackground(ks.id, finalContent, title, tags);
 */
export async function runAutoTagInBackground(
  sourceId: string,
  content: string,
  title: string,
  existingTags: string[]
): Promise<void> {
  try {
    const merged = await autoTagSource(content, title, existingTags);
    // Évite d'écraser si rien de nouveau (préserve updatedAt si possible).
    const sameLength = merged.length === existingTags.length;
    const sameContent =
      sameLength &&
      merged.every((t, i) => t.toLowerCase() === existingTags[i]?.toLowerCase());
    if (sameContent) return;
    await prisma.knowledgeSource.update({
      where: { id: sourceId },
      data: { tags: merged },
    });
    console.log(
      `[chomage-ia auto-tag] ks=${sourceId} → ${merged.length} tags (${merged.join(", ")})`
    );
  } catch (err) {
    console.warn(
      `[chomage-ia auto-tag] update background échoué pour ks=${sourceId}:`,
      err
    );
  }
}
