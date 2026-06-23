import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, withDbRetry } from "@/lib/prisma";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

/**
 * API PUBLIQUE (sans auth) : un visiteur propose une correction de traduction.
 *
 * La cible est SOIT un contenu DB (model + recordId + field), SOIT une clé
 * d'UI (uiKey) — exactement l'un des deux groupes. La suggestion est créée
 * en statut "pending" pour modération admin. Pas de GET public.
 */

const bodySchema = z
  .object({
    locale: z.string().trim().min(2).max(10),
    model: z.string().trim().min(1).max(80).optional(),
    recordId: z.string().trim().min(1).max(120).optional(),
    field: z.string().trim().min(1).max(80).optional(),
    uiKey: z.string().trim().min(1).max(200).optional(),
    sourceText: z.string().trim().min(1).max(20000),
    currentText: z.string().trim().max(20000).optional(),
    suggestedText: z.string().trim().min(1).max(20000),
    comment: z.string().trim().max(2000).optional(),
    // Email best-effort (optionnel) : on accepte une chaîne libre courte plutôt
    // que de bloquer le visiteur sur un format strict ("informatif jamais
    // bloquant"). Une chaîne vide est normalisée en null plus bas.
    submittedBy: z.string().trim().max(200).optional(),
  })
  .refine(
    (d) =>
      (!!d.model && !!d.recordId && !!d.field) || !!d.uiKey,
    {
      message:
        "Cible requise : (model + recordId + field) OU uiKey.",
      path: ["uiKey"],
    },
  );

export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: jsonHeaders },
    );
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400, headers: jsonHeaders },
    );
  }

  const d = parsed.data;
  // La locale source FR n'a rien à corriger : c'est le texte de référence.
  if (d.locale.toLowerCase().startsWith("fr")) {
    return NextResponse.json(
      { error: "Aucune correction possible sur la langue source (FR)." },
      { status: 400, headers: jsonHeaders },
    );
  }

  // Email vide → null (on n'enregistre pas la chaîne vide).
  const submittedBy = d.submittedBy ? d.submittedBy : null;

  try {
    await withDbRetry(() =>
      prisma.translationSuggestion.create({
        data: {
          locale: d.locale,
          model: d.uiKey ? null : d.model ?? null,
          recordId: d.uiKey ? null : d.recordId ?? null,
          field: d.uiKey ? null : d.field ?? null,
          uiKey: d.uiKey ?? null,
          sourceText: d.sourceText,
          currentText: d.currentText ?? null,
          suggestedText: d.suggestedText,
          comment: d.comment ?? null,
          submittedBy,
          status: "pending",
        },
      }),
    );

    return NextResponse.json(
      { ok: true },
      { status: 201, headers: jsonHeaders },
    );
  } catch (error) {
    console.error("Error creating translation suggestion:", error);
    return NextResponse.json(
      { error: "Failed to create translation suggestion" },
      { status: 500, headers: jsonHeaders },
    );
  }
}
