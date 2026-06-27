import "server-only";
import { prisma } from "@/lib/prisma";
import { callClaude } from "@/lib/chomage-ia/anthropic";
import { CLAUDE_MODELS } from "@/lib/chomage-ia/models";
import { aiLabels, isTranslatableLocale, type Locale } from "@/i18n/locales";

/**
 * Service de traduction par IA (Claude) du contenu DB.
 *
 * Réutilise le wrapper `callClaude` (fetch Anthropic Messages v1) déjà en place
 * pour le module chômage-ia. Injecte le glossaire terminologique belge dans le
 * system prompt (mis en cache → quasi gratuit sur les appels suivants) pour
 * garantir la cohérence (RVA, OCMW, INSZ…) — c'est ce qui distingue de Google Trad.
 *
 * Modèle = Sonnet (qualité native, ~5× moins cher qu'Opus pour du volume).
 * Bumpable dans lib/chomage-ia/models.ts.
 */

// Le libellé des langues et `isTranslatableLocale` sont centralisés dans le
// registre `i18n/locales.ts`. On ré-exporte `isTranslatableLocale` pour les
// consommateurs existants (auto-translate, endpoint admin de traduction).
export { isTranslatableLocale };

const STRATEGY_LABEL: Record<string, string> = {
  translate: "traduire",
  translate_gloss: "traduire + glose belge",
  keep: "garder le terme FR + glose",
};

/**
 * Charge le glossaire depuis la DB (table GlossaryTerm, éditable via l'admin)
 * et le met en forme pour le system prompt. Remplace l'ancienne lecture `fs`
 * du .md → robuste en prod serverless, et reflète les éditions admin en direct.
 * Best-effort : table vide ou erreur DB → "" (la traduction marche sans).
 */
async function loadGlossary(): Promise<string> {
  let terms: Array<{
    term: string;
    strategy: string;
    glossFr: string;
    note: string | null;
    category: string;
  }>;
  try {
    terms = await prisma.glossaryTerm.findMany({ orderBy: { order: "asc" } });
  } catch {
    return "";
  }
  if (terms.length === 0) return "";

  const byCat = new Map<string, typeof terms>();
  for (const t of terms) {
    const cat = t.category || "Divers";
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat)!.push(t);
  }

  const blocks: string[] = [];
  for (const [cat, list] of byCat) {
    const items = list.map((t) => {
      const strat = STRATEGY_LABEL[t.strategy] ?? t.strategy;
      const note = t.note ? ` — ${t.note}` : "";
      return `- ${t.term} [${strat}] : ${t.glossFr}${note}`;
    });
    blocks.push(`## ${cat}\n${items.join("\n")}`);
  }
  return blocks.join("\n\n");
}

/** Découpe un tableau en lots de taille max (pour ne pas exploser max_tokens). */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const BATCH_SIZE = 25; // textes par appel Claude (équilibre coût / taille réponse)

/**
 * Traduit une liste de textes FR vers `targetLocale`.
 * Renvoie un tableau aligné sur l'entrée (même longueur, même ordre).
 * Un texte vide reste vide. Lève en cas d'échec d'appel/parse irrécupérable.
 */
export async function translateTexts(
  texts: string[],
  targetLocale: string
): Promise<string[]> {
  if (!isTranslatableLocale(targetLocale)) {
    throw new Error(`Locale non traduisible : ${targetLocale}`);
  }
  if (texts.length === 0) return [];

  const langLabel = aiLabels[targetLocale as Locale] ?? targetLocale;
  const glossary = await loadGlossary();

  const systemPrompt = [
    `Tu es un traducteur professionnel spécialisé dans l'administration sociale belge`,
    `(chômage, ONEM/RVA, CPAS/OCMW, syndicats, emploi). Tu traduis du FRANÇAIS vers le ${langLabel}.`,
    ``,
    `RÈGLES STRICTES :`,
    `- Traduis fidèlement, ton clair et naturel, registre administratif accessible (pas ampoulé).`,
    `- Terminologie OFFICIELLE belge : respecte le glossaire ci-dessous (noms d'institutions, sigles).`,
    `- Préserve EXACTEMENT : les variables ICU ({name}, {count}, {amount}…), les balises HTML,`,
    `  le markdown (**, #, -, liens), les retours à la ligne, la ponctuation de structure.`,
    `- Ne traduis PAS les noms propres d'institutions sauf si le glossaire donne l'équivalent local.`,
    `- N'ajoute aucun commentaire, note ou explication.`,
    ``,
    `FORMAT DE SORTIE — réponds UNIQUEMENT avec un objet JSON valide, sans texte autour :`,
    `{"translations":[{"i":0,"text":"…"},{"i":1,"text":"…"}]}`,
    `Un objet par texte d'entrée, même "i", dans le même ordre.`,
    glossary ? `\n=== GLOSSAIRE TERMINOLOGIQUE ===\n${glossary}` : "",
  ].join("\n");

  const results: string[] = new Array(texts.length).fill("");

  for (const batch of chunk(
    texts.map((fr, i) => ({ i, fr })),
    BATCH_SIZE
  )) {
    // On ne soumet que les textes non vides (un vide reste vide).
    const payload = batch.filter((b) => b.fr.trim() !== "");
    if (payload.length === 0) continue;

    const userMessage =
      `Traduis ces ${payload.length} texte(s) du français vers le ${langLabel}. ` +
      `Renvoie le JSON décrit.\n\n` +
      JSON.stringify(payload.map((b) => ({ i: b.i, fr: b.fr })), null, 0);

    const res = await callClaude({
      model: CLAUDE_MODELS.sonnet,
      systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      maxTokens: 8000,
      timeoutMs: 120_000,
    });

    const parsed = parseTranslations(res.text);
    for (const item of parsed) {
      if (typeof item.i === "number" && typeof item.text === "string") {
        results[item.i] = item.text;
      }
    }
  }

  return results;
}

/** Parse robuste de la réponse Claude : extrait le 1er objet JSON et ses translations. */
function parseTranslations(raw: string): Array<{ i: number; text: string }> {
  // Claude peut entourer le JSON de ```json … ``` malgré la consigne.
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  let obj: unknown;
  try {
    obj = JSON.parse(cleaned);
  } catch {
    // Dernier recours : isole le premier { … } équilibré.
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("Réponse IA non parsable (pas de JSON)");
    obj = JSON.parse(cleaned.slice(start, end + 1));
  }
  const arr = (obj as { translations?: unknown }).translations;
  if (!Array.isArray(arr)) throw new Error("Réponse IA sans champ 'translations'");
  return arr as Array<{ i: number; text: string }>;
}
