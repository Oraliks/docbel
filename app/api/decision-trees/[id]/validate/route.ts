/// Decision Builder — validation à la demande (dry-run). Sert au bouton
/// "Valider" de l'éditeur admin avant publication. Ne mute jamais l'arbre.
/// Par défaut valide le `draftContent` en base ; un `content` peut être fourni
/// dans le body pour valider un brouillon local non encore sauvegardé.

import type { NextRequest } from "next/server";
import { prisma, withDbRetry } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { safeParseTreeContent } from "@/lib/decision-builder/schema";
import { validateTreeContentAgainstDb } from "@/lib/decision-builder/server";
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
    // body facultatif
  }

  // Contenu à valider : celui fourni (édition live) sinon le draft en base.
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

  const report = await validateTreeContentAgainstDb(content);
  return jsonOk({ report, canPublish: report.publishable });
}
