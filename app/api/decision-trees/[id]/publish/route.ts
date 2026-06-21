/// Decision Builder — publication d'un arbre.
/// GET  : dry-run validation (rapport sans publier).
/// POST : publie le draftContent (snapshot + diff) si publishable.

import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma, withDbRetry } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { safeParseTreeContent } from "@/lib/decision-builder/schema";
import {
  publishTree,
  validateTreeContentAgainstDb,
} from "@/lib/decision-builder/server";
import { jsonError, jsonOk } from "@/lib/decision-builder/api-helpers";

type Params = { params: Promise<{ id: string }> };

/// GET — rapport de validation du draftContent (sans publier).
export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;
  const tree = await withDbRetry(() =>
    prisma.decisionTree.findUnique({
      where: { id },
      select: { draftContent: true },
    }),
  );
  if (!tree) return jsonError(404, "Arbre introuvable.");

  const content = safeParseTreeContent(tree.draftContent);
  if (!content) {
    return jsonError(400, "Contenu d'arbre invalide.", { code: "invalid_content" });
  }
  const report = await validateTreeContentAgainstDb(content);
  return jsonOk({ report, canPublish: report.publishable });
}

/// POST — publie. Body optionnel : { changeNotes?, changeType? }.
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // Body facultatif — on ignore une absence de JSON.
  }
  const changeNotes =
    typeof body.changeNotes === "string" ? body.changeNotes.trim() : undefined;
  const changeType = body.changeType === "major" ? "major" : "minor";

  const result = await publishTree(id, auth.user.id, changeNotes, changeType);

  if (!result.ok) {
    switch (result.reason) {
      case "tree_not_found":
        return jsonError(404, "Arbre introuvable.");
      case "invalid_content":
        return jsonError(400, "Contenu d'arbre invalide.", {
          code: "invalid_content",
        });
      case "not_publishable":
        return jsonError(422, "Publication impossible : corrigez les erreurs.", {
          report: result.report,
        });
    }
  }

  // L'arbre publié alimente /mon-dossier → on invalide son cache.
  revalidatePath("/mon-dossier");

  return jsonOk({
    ok: true,
    version: result.version,
    revisionId: result.revisionId,
    report: result.report,
  });
}
