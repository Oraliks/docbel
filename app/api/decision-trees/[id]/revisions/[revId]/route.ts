/// Decision Builder — détail d'une révision (contenu complet pour aperçu/diff).

import type { NextRequest } from "next/server";
import { prisma, withDbRetry } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { jsonError, jsonOk } from "@/lib/decision-builder/api-helpers";

type Params = { params: Promise<{ id: string; revId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id, revId } = await params;
  const revision = await withDbRetry(() =>
    prisma.decisionTreeRevision.findUnique({ where: { id: revId } }),
  );
  if (!revision || revision.treeId !== id) {
    return jsonError(404, "Révision introuvable.");
  }
  return jsonOk(revision);
}
