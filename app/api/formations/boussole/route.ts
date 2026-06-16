import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import { boussoleSubmitSchema } from "@/lib/formations/schemas";
import { getBoussoleQuestions } from "@/lib/formations/boussole/load";
import { scoreBoussole } from "@/lib/formations/boussole/engine";
import { BRANCH_BY_KEY, type BranchKey } from "@/lib/formations/boussole/branches";
import { getRecommendedTrainings } from "@/lib/formations/queries";

const json = { "Content-Type": "application/json; charset=utf-8" };

async function getOptionalUserId(): Promise<string | null> {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);
  return session?.user?.id ?? null;
}

/** POST : score la Boussole (serveur, faisant autorité), persiste le résultat
 * (anonyme autorisé) et renvoie branches + formations recommandées. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = boussoleSubmitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 400, headers: json },
    );
  }
  const { answers, sessionId, save } = parsed.data;

  const questions = await getBoussoleQuestions();
  const result = scoreBoussole(questions, answers);

  const userId = await getOptionalUserId();

  const branchKeys = [result.primaryKey, ...result.secondaryKeys].filter(
    (k): k is BranchKey => !!k,
  );
  const recommendations = await getRecommendedTrainings(branchKeys, 6);

  const summary = result.primaryKey
    ? `Sur base de tes réponses, le domaine « ${BRANCH_BY_KEY[result.primaryKey].name} » semble le mieux correspondre à ton profil.`
    : "Réponds à quelques questions de plus pour obtenir des pistes.";

  const saved = await prisma.orientationResult.create({
    data: {
      userId,
      sessionId,
      primaryBranchId: result.primaryKey,
      secondaryBranchIds: result.secondaryKeys,
      scoresJson: result.ranking as unknown as Prisma.InputJsonValue,
      answersJson: answers as Prisma.InputJsonValue,
      confidenceScore: result.confidence,
      summary,
      saved: !!save,
    },
  });

  if (userId) {
    await logActivity(userId, "completed", "boussole", "Boussole d'orientation", saved.id);
  }

  return NextResponse.json(
    {
      resultId: saved.id,
      primaryKey: result.primaryKey,
      secondaryKeys: result.secondaryKeys,
      ranking: result.ranking,
      confidence: result.confidence,
      confidenceLabel: result.confidenceLabel,
      summary,
      branches: branchKeys.map((k) => BRANCH_BY_KEY[k]),
      recommendations,
    },
    { headers: json },
  );
}

/** PATCH : marque un résultat existant comme sauvegardé. */
export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null);
  const resultId = typeof body?.resultId === "string" ? body.resultId : null;
  const save = body?.save !== false;
  if (!resultId) {
    return NextResponse.json({ error: "resultId requis" }, { status: 400, headers: json });
  }
  const userId = await getOptionalUserId();
  const existing = await prisma.orientationResult.findUnique({ where: { id: resultId } });
  if (!existing) {
    return NextResponse.json({ error: "Résultat introuvable" }, { status: 404, headers: json });
  }
  // Un résultat anonyme peut être sauvegardé ; un résultat rattaché à un compte
  // ne peut être modifié que par son propriétaire.
  if (existing.userId && existing.userId !== userId) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403, headers: json });
  }
  await prisma.orientationResult.update({
    where: { id: resultId },
    data: { saved: save, userId: existing.userId ?? userId },
  });
  return NextResponse.json({ ok: true }, { headers: json });
}
