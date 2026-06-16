/** Chargement des questions Boussole depuis la DB → format moteur (QuestionDef). */
import "server-only";
import { prisma } from "@/lib/prisma";
import { QUESTIONS, type QuestionDef, type AnswerOptionDef } from "./questions";
import { isBranchKey, type BranchKey } from "./branches";

/**
 * Questions actives + barème, prêtes pour scoreBoussole(). Clé de question =
 * id DB (stable). Fallback sur les questions statiques si la table est vide.
 */
export async function getBoussoleQuestions(): Promise<QuestionDef[]> {
  const [questions, branches] = await Promise.all([
    prisma.orientationQuestion.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
      include: {
        options: { orderBy: { order: "asc" }, include: { scores: true } },
      },
    }),
    prisma.orientationBranch.findMany({ select: { id: true, key: true } }),
  ]);

  if (questions.length === 0) return QUESTIONS;

  const branchKeyById = new Map(branches.map((b) => [b.id, b.key]));

  return questions.map((q) => {
    const options: AnswerOptionDef[] = q.options.map((o) => {
      const scores: Partial<Record<BranchKey, number>> = {};
      for (const s of o.scores) {
        const key = branchKeyById.get(s.branchId);
        if (key && isBranchKey(key)) scores[key] = s.score;
      }
      return { value: o.value as AnswerOptionDef["value"], label: o.label, scores };
    });
    return { key: q.id, text: q.text, description: q.description ?? undefined, options };
  });
}

/** Variante "client-safe" : questions sans le barème (pour ne pas exposer les
 * points en réseau). Le scoring reste serveur. */
export interface PublicQuestion {
  key: string;
  text: string;
  description?: string;
  options: { value: string; label: string }[];
}

export function toPublicQuestions(questions: QuestionDef[]): PublicQuestion[] {
  return questions.map((q) => ({
    key: q.key,
    text: q.text,
    description: q.description,
    options: q.options.map((o) => ({ value: o.value, label: o.label })),
  }));
}
