/// Decision Builder — simulation d'un parcours utilisateur (mode admin).
/// Exécute l'engine sur le `draftContent` avec des réponses fournies. Ne touche
/// JAMAIS au BundleRun réel (simulation pure). Body : { answers, content? }.

import type { NextRequest } from "next/server";
import { prisma, withDbRetry } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { runDecisionTree } from "@/lib/decision-builder/engine";
import { trackDecisionTreeEvent } from "@/lib/decision-builder/analytics";
import {
  OrientationAnswersSchema,
  safeParseTreeContent,
} from "@/lib/decision-builder/schema";
import { jsonError, jsonOk } from "@/lib/decision-builder/api-helpers";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Invalid JSON");
  }

  // Réponses : validées par Zod (forme { [nodeId]: { value } }).
  const answersParse = OrientationAnswersSchema.safeParse(body.answers ?? {});
  if (!answersParse.success) {
    return jsonError(400, "Réponses invalides.", { code: "invalid_answers" });
  }

  // Contenu : fourni (édition live) sinon draft en base.
  let rawContent: unknown = body.content;
  if (rawContent === undefined) {
    const tree = await withDbRetry(() =>
      prisma.decisionTree.findUnique({
        where: { id },
        select: { draftContent: true },
      }),
    );
    if (!tree) return jsonError(404, "Arbre introuvable.");
    rawContent = tree.draftContent;
  }

  const content = safeParseTreeContent(rawContent);
  if (!content) {
    return jsonError(400, "Contenu d'arbre invalide.", { code: "invalid_content" });
  }

  const result = runDecisionTree(content, answersParse.data);
  await trackDecisionTreeEvent("decision_tree_simulated", {
    treeId: id,
    userId: auth.user.id,
    metadata: { resultCount: result.results.length },
  });
  return jsonOk(result);
}
