import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, withDbRetry } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

const patchSchema = z.object({
  action: z.enum(["accept", "reject"]),
});

type RouteParams = { params: Promise<{ id: string }> };

/**
 * API ADMIN : modère une suggestion de correction.
 *   - "accept" → status=accepted (+ reviewer/date). Si la suggestion cible du
 *     CONTENU DB (model+recordId+field), on UPSERT ContentTranslation
 *     (unique [model,recordId,field,locale]) avec value=suggestedText et
 *     status="reviewed". Si c'est une clé d'UI (uiKey), on marque juste
 *     accepted — l'admin reportera la correction au JSON manuellement.
 *   - "reject" → status=rejected (+ reviewer/date), aucune écriture de contenu.
 *
 * Garde admin réutilisée : `requireAdminAuth` (lib/auth-check).
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  const { id } = await params;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: jsonHeaders },
    );
  }

  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400, headers: jsonHeaders },
    );
  }

  const suggestion = await withDbRetry(() =>
    prisma.translationSuggestion.findUnique({ where: { id } }),
  ).catch(() => null);

  if (!suggestion) {
    return NextResponse.json(
      { error: "Suggestion introuvable" },
      { status: 404, headers: jsonHeaders },
    );
  }
  if (suggestion.status !== "pending") {
    return NextResponse.json(
      { error: "Cette suggestion a déjà été modérée." },
      { status: 409, headers: jsonHeaders },
    );
  }

  // Trace de l'auteur de la modération : email de session (fallback id) —
  // même convention que /api/admin/content-translations.
  const reviewer = authCheck.user.email || authCheck.user.id;
  const now = new Date();

  try {
    if (parsed.data.action === "reject") {
      const updated = await withDbRetry(() =>
        prisma.translationSuggestion.update({
          where: { id },
          data: { status: "rejected", reviewedBy: reviewer, reviewedAt: now },
        }),
      );
      return NextResponse.json(updated, { headers: jsonHeaders });
    }

    // accept : applique la traduction si elle cible du contenu DB.
    const targetsDbContent =
      !!suggestion.model && !!suggestion.recordId && !!suggestion.field;

    const updated = await withDbRetry(() =>
      prisma.$transaction(async (tx) => {
        if (targetsDbContent) {
          await tx.contentTranslation.upsert({
            where: {
              model_recordId_field_locale: {
                model: suggestion.model!,
                recordId: suggestion.recordId!,
                field: suggestion.field!,
                locale: suggestion.locale,
              },
            },
            update: {
              value: suggestion.suggestedText,
              status: "reviewed",
              updatedBy: reviewer,
            },
            create: {
              model: suggestion.model!,
              recordId: suggestion.recordId!,
              field: suggestion.field!,
              locale: suggestion.locale,
              value: suggestion.suggestedText,
              status: "reviewed",
              updatedBy: reviewer,
            },
          });
        }
        return tx.translationSuggestion.update({
          where: { id },
          data: { status: "accepted", reviewedBy: reviewer, reviewedAt: now },
        });
      }),
    );

    return NextResponse.json(updated, { headers: jsonHeaders });
  } catch (error) {
    console.error("Error moderating translation suggestion:", error);
    return NextResponse.json(
      { error: "Failed to moderate translation suggestion" },
      { status: 500, headers: jsonHeaders },
    );
  }
}
