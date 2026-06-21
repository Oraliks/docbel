/// Decision Builder — arbre individuel : GET / PATCH (draft, verrou optimiste) /
/// DELETE (soft → archived).

import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma, withDbRetry } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { logActivity } from "@/lib/activity-logger";
import { isStaleWrite } from "@/lib/pdf-forms/concurrency";
import { parseTreeContent } from "@/lib/decision-builder/schema";
import {
  jsonError,
  jsonOk,
  staleWriteResponse,
} from "@/lib/decision-builder/api-helpers";

type Params = { params: Promise<{ id: string }> };

/// GET — arbre complet (draft + published content).
export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;
  const tree = await withDbRetry(() =>
    prisma.decisionTree.findUnique({ where: { id } }),
  );
  if (!tree) return jsonError(404, "Arbre introuvable.");
  return jsonOk(tree);
}

/// PATCH — met à jour les métadonnées et/ou le draftContent. Verrou optimiste
/// via `expectedUpdatedAt` (calque PdfForm) → 409 stale_write si conflit.
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;
  const existing = await withDbRetry(() =>
    prisma.decisionTree.findUnique({ where: { id } }),
  );
  if (!existing) return jsonError(404, "Arbre introuvable.");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Invalid JSON");
  }

  const expectedUpdatedAt =
    typeof body.expectedUpdatedAt === "string" ? body.expectedUpdatedAt : undefined;
  if (isStaleWrite(expectedUpdatedAt, existing.updatedAt.getTime())) {
    return staleWriteResponse(existing.updatedAt);
  }

  const data: Prisma.DecisionTreeUpdateInput = { updatedBy: auth.user.id };

  if (typeof body.title === "string") data.title = body.title.trim();
  if (typeof body.description === "string" || body.description === null) {
    data.description = (body.description as string | null) ?? null;
  }
  if (typeof body.segment === "string" && body.segment.trim()) {
    data.segment = body.segment.trim();
  }
  // Statut éditable seulement vers draft/archived. La publication passe
  // obligatoirement par /publish (snapshot + révision).
  if (body.status === "draft" || body.status === "archived") {
    data.status = body.status;
  }

  // draftContent : validé strictement par Zod avant écriture.
  if (body.draftContent !== undefined) {
    try {
      const parsed = parseTreeContent(body.draftContent);
      data.draftContent = parsed as unknown as Prisma.InputJsonValue;
    } catch {
      return jsonError(400, "Contenu d'arbre invalide.", {
        code: "invalid_content",
      });
    }
  }

  try {
    // where composé id + updatedAt = garde TOCTOU finale (calque PdfForm).
    const updated = await withDbRetry(() =>
      prisma.decisionTree.update({
        where: { id, updatedAt: existing.updatedAt },
        data,
      }),
    );
    return jsonOk(updated);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      // Une autre session a écrit entre le findUnique et l'update.
      const current = await prisma.decisionTree.findUnique({
        where: { id },
        select: { updatedAt: true },
      });
      if (current) return staleWriteResponse(current.updatedAt);
      return jsonError(404, "Arbre introuvable.");
    }
    console.error("PATCH /api/decision-trees/[id] — échec", err);
    return jsonError(500, "Erreur serveur lors de l'enregistrement.");
  }
}

/// DELETE — soft delete : passe le statut à "archived" (jamais de suppression
/// physique ; un arbre publié peut encore être référencé en historique).
export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;
  const existing = await withDbRetry(() =>
    prisma.decisionTree.findUnique({
      where: { id },
      select: { id: true, title: true },
    }),
  );
  if (!existing) return jsonError(404, "Arbre introuvable.");

  await withDbRetry(() =>
    prisma.decisionTree.update({
      where: { id },
      data: { status: "archived", updatedBy: auth.user.id },
    }),
  );

  await logActivity(auth.user.id, "archived", "decision_tree", existing.title, id);

  return jsonOk({ ok: true, status: "archived" });
}
