import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma, withDbRetry } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";

const json = { "Content-Type": "application/json; charset=utf-8" };

const STATUSES = ["ia", "reviewed", "published"];

/**
 * PATCH — édite une ligne de traduction (admin).
 * Body : `{ value?: string, status?: "ia"|"reviewed"|"published" }`.
 * Renseigne `updatedBy` = email de l'admin de session.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400, headers: json }
    );
  }

  const data: Prisma.ContentTranslationUpdateInput = {};
  if (typeof body.value === "string") data.value = body.value;
  if (typeof body.status === "string") {
    if (!STATUSES.includes(body.status)) {
      return NextResponse.json(
        { error: "Statut invalide" },
        { status: 400, headers: json }
      );
    }
    data.status = body.status;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "Rien à mettre à jour" },
      { status: 400, headers: json }
    );
  }

  // Trace de l'auteur : email de l'admin de session (fallback id).
  data.updatedBy = auth.user.email || auth.user.id;

  try {
    const updated = await withDbRetry(() =>
      prisma.contentTranslation.update({ where: { id }, data })
    );
    return NextResponse.json(updated, { headers: json });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return NextResponse.json(
        { error: "Introuvable" },
        { status: 404, headers: json }
      );
    }
    console.error("PATCH /api/admin/content-translations/[id] — échec", err);
    return NextResponse.json(
      { error: "Erreur serveur lors de l'enregistrement." },
      { status: 500, headers: json }
    );
  }
}
