/**
 * Détection automatique des "gaps de connaissance" (Feature 6 — migration 22).
 *
 * Stratégie : on parse la réponse Claude pour repérer des aveux d'incertitude
 * via regex (FR uniquement, MVP). Quand un pattern matche, on persiste un
 * `KnowledgeGap` avec la question utilisateur d'origine.
 *
 * Si la même query (normalisée) a déjà été enregistrée en `status="open"`, on
 * incrémente `occurrences` au lieu de créer un doublon (= "cette question
 * revient souvent, à prioriser").
 *
 * Best-effort : si la persistance DB échoue, on log et on continue (le chat
 * doit JAMAIS être bloqué par la détection de gaps).
 */

import { prisma } from "@/lib/prisma";

/**
 * Patterns FR typiques d'un aveu d'incertitude / source manquante côté assistant.
 * Volontairement spécifiques pour minimiser les faux positifs sur des réponses
 * complètes qui contiendraient juste "je vérifie" en passant.
 */
const UNCERTAINTY_PATTERNS: RegExp[] = [
  // "Je n'ai pas d'information précise…", "Je n'ai pas de source…", "Je n'ai pas trouvé…"
  /je\s+n['']?\s*ai\s+pas\s+(?:d['']?\s*information|de\s+source|d['']?\s*infos?\s+pr[ée]cis|trouv[ée])/i,
  // "Aucune source dans la KB…", "Aucune source ne …"
  /aucune\s+source\s+(?:dans\s+la\s+kb|ne\s+(?:mentionne|couvre|aborde|d[ée]taille|confirme))/i,
  // "Je ne suis pas certain…", "Je ne suis pas sûr…"
  /je\s+ne\s+suis\s+pas\s+(?:certain|s[ûu]re?)\s+(?:de|que|sur)/i,
  // "Données non disponibles", "Information non disponible"
  /(?:donn[ée]es|information)\s+non\s+disponibles?/i,
  // "À vérifier auprès de", "À confirmer"
  /\b[àa]\s+(?:v[ée]rifier|confirmer)\s+(?:aupr[èe]s|directement|avec|via|en)/i,
  // Le préfixe ⚠️ + "pas de source" injecté par notre system prompt en cas d'aveu
  /⚠️[^.]{0,300}(?:pas\s+de\s+source|aucune\s+source|je\s+n['']?\s*ai\s+pas)/i,
];

/**
 * Cap dur sur l'analyse pour éviter d'exploser sur une réponse 50K chars.
 */
const ANSWER_TRUNCATE = 4000;

/**
 * Normalise une query pour le dédoublonnage / matching.
 * Lowercase + retire accents + collapse espaces. Ne touche pas à l'ordre des
 * mots (on ne fait pas du fuzzy ici — on veut une vraie répétition).
 */
function normalizeQuery(q: string): string {
  return q
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Détecte si une réponse contient un pattern d'incertitude.
 * Pure function — ne touche pas à la DB.
 */
export function detectsUncertainty(assistantText: string): boolean {
  if (!assistantText) return false;
  const sample = assistantText.slice(0, ANSWER_TRUNCATE);
  return UNCERTAINTY_PATTERNS.some((re) => re.test(sample));
}

/**
 * Pipeline de détection appelée par `postProcessChatAnswer`.
 *
 * Si la réponse a un aveu d'incertitude :
 *   - Cherche un gap "open" avec la même query normalisée → incrémente occurrences.
 *   - Sinon → crée un nouveau gap.
 *
 * Si la réponse a des missing legal refs (déjà détectées par le pipeline), on
 * crée aussi des gaps avec `notes` qui pointent vers la ref absente.
 *
 * Tout est best-effort : retourne le nombre de gaps créés/incrémentés et
 * jamais throw.
 */
export async function detectKnowledgeGapsFromAnswer(args: {
  domain: string;
  userQuery: string;
  assistantText: string;
  missingRefs: string[];
  sessionId?: string | null;
  messageId?: string | null;
}): Promise<{ created: number; incremented: number }> {
  const { domain, userQuery, assistantText, missingRefs, sessionId, messageId } =
    args;
  const result = { created: 0, incremented: 0 };

  const trimmedQuery = (userQuery ?? "").trim().slice(0, 1000);
  if (trimmedQuery.length < 3) return result;

  const hasUncertainty = detectsUncertainty(assistantText);
  const hasMissingRefs = missingRefs.length > 0;
  if (!hasUncertainty && !hasMissingRefs) return result;

  const normalized = normalizeQuery(trimmedQuery);

  try {
    // Cherche un gap "open" du même domain avec la même query normalisée.
    // On ne peut pas comparer en SQL sans fonction custom — on récupère les
    // gaps open récents et on filtre côté Node.
    const recent = await prisma.knowledgeGap.findMany({
      where: { domain, status: "open" },
      orderBy: { detectedAt: "desc" },
      take: 100,
    });
    const match = recent.find((g) => normalizeQuery(g.query) === normalized);

    if (match) {
      await prisma.knowledgeGap.update({
        where: { id: match.id },
        data: {
          occurrences: { increment: 1 },
          // Garde la sessionId/messageId la plus récente pour permettre de
          // remonter au permalien depuis la page gaps.
          sessionId: sessionId ?? match.sessionId,
          messageId: messageId ?? match.messageId,
        },
      });
      result.incremented++;
    } else {
      const noteParts: string[] = [];
      if (hasUncertainty) noteParts.push("Aveu d'incertitude détecté dans la réponse.");
      if (hasMissingRefs) {
        noteParts.push(
          `Références légales absentes : ${missingRefs.slice(0, 3).join(", ")}`,
        );
      }
      await prisma.knowledgeGap.create({
        data: {
          query: trimmedQuery,
          domain,
          sessionId: sessionId ?? null,
          messageId: messageId ?? null,
          notes: noteParts.join(" "),
        },
      });
      result.created++;
    }
  } catch (err) {
    console.warn(
      "[chomage-ia gaps] DB op failed:",
      err instanceof Error ? err.message : String(err),
    );
  }

  return result;
}
