/// Decision Builder — historique des versions publiées d'un arbre.

import type { NextRequest } from "next/server";
import { prisma, withDbRetry } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { jsonError, jsonOk } from "@/lib/decision-builder/api-helpers";

type Params = { params: Promise<{ id: string }> };

/// GET — liste des révisions (métadonnées + diff, sans le contenu volumineux).
export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;
  const tree = await withDbRetry(() =>
    prisma.decisionTree.findUnique({ where: { id }, select: { id: true } }),
  );
  if (!tree) return jsonError(404, "Arbre introuvable.");

  const revisions = await withDbRetry(() =>
    prisma.decisionTreeRevision.findMany({
      where: { treeId: id },
      orderBy: { version: "desc" },
      take: 30,
      select: {
        id: true,
        version: true,
        changeType: true,
        changeNotes: true,
        diffSummary: true,
        publishedBy: true,
        publishedAt: true,
      },
    }),
  );
  return jsonOk(revisions);
}
