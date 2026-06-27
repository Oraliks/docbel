import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma, withDbRetry } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";

const json = { "Content-Type": "application/json; charset=utf-8" };
const STATUSES = ["ia", "reviewed", "published"];
const ORIGINS = ["ia", "human", "imported"];

/**
 * PATCH — édite une ligne de traduction (admin).
 * Body : { value?: string, status?: string, origin?: string }
 * Enregistre un historique à chaque sauvegarde.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;
  const editor = auth.user.email || auth.user.id;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: json });
  }

  const data: Prisma.ContentTranslationUpdateInput = {};
  if (typeof body.value === "string") data.value = body.value;
  if (typeof body.status === "string") {
    if (!STATUSES.includes(body.status))
      return NextResponse.json({ error: "Statut invalide" }, { status: 400, headers: json });
    data.status = body.status;
  }
  const origin =
    typeof body.origin === "string" && ORIGINS.includes(body.origin)
      ? body.origin
      : "human";
  data.origin = origin;
  data.updatedBy = editor;

  if (!("value" in data) && !("status" in data))
    return NextResponse.json({ error: "Rien à mettre à jour" }, { status: 400, headers: json });

  try {
    const current = await withDbRetry(() =>
      prisma.contentTranslation.findUnique({ where: { id } })
    );
    if (!current)
      return NextResponse.json({ error: "Introuvable" }, { status: 404, headers: json });

    const newValue = typeof body.value === "string" ? body.value : current.value;
    const newStatus = typeof body.status === "string" ? body.status : current.status;

    const [updated] = await withDbRetry(() =>
      prisma.$transaction([
        prisma.contentTranslation.update({ where: { id }, data }),
        prisma.contentTranslationHistory.create({
          data: {
            translationId: id,
            oldValue: current.value,
            newValue,
            oldStatus: current.status,
            newStatus,
            origin,
            editedBy: editor,
          },
        }),
      ])
    );

    return NextResponse.json(updated, { headers: json });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    )
      return NextResponse.json({ error: "Introuvable" }, { status: 404, headers: json });
    console.error("PATCH /api/admin/content-translations/[id]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500, headers: json });
  }
}
