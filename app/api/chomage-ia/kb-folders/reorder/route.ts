/**
 * POST /api/chomage-ia/kb-folders/reorder
 *
 * Migration 21 — batch update pour réordonner / déplacer plusieurs folders
 * en une seule transaction. Utilisé par le drag&drop côté sidebar quand on
 * reorganise plusieurs items à la fois (drop entre deux siblings, déplacement
 * vers un autre parent).
 *
 * Body : { items: [{ id, parentId, order }] }
 *
 * Pour chaque item, on update son `parentId` + `order` en respectant :
 *   - Pas de cycle (un folder ne peut pas être son propre ancêtre).
 *   - Profondeur ≤ KNOWLEDGE_FOLDER_MAX_DEPTH.
 *
 * Toutes les validations passent EN AMONT de l'update batch. Si une seule échoue,
 * on refuse l'ensemble (400) — évite un état partiel corrompu.
 *
 * On exécute les updates en transaction Prisma pour garantir l'atomicité.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { checkRateLimit, getClientIp } from "@/lib/documents/rate-limit";
import { KNOWLEDGE_FOLDER_MAX_DEPTH } from "@/lib/chomage-ia/types";

const ReorderSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1).max(50),
        parentId: z.string().min(1).max(50).nullable(),
        order: z.number().int().min(0).max(10_000),
      }),
    )
    .min(1)
    .max(200),
});

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const ip = getClientIp(req);
  const rl = checkRateLimit(`chomage-ia:kb-folders:reorder:${ip}`, {
    windowMs: 60_000,
    max: 60,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes — réessayez dans une minute" },
      { status: 429 },
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = ReorderSchema.parse(body);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof z.ZodError
            ? err.issues[0]?.message || "Validation error"
            : "Validation error",
      },
      { status: 400 },
    );
  }

  // 1. Charge tous les folders concernés + un peu plus pour vérifier les cycles
  //    et la profondeur. On charge tout l'arbre du domaine — petit pour la KB.
  const allIds = parsed.items.map((it) => it.id);
  const existing = await prisma.knowledgeFolder.findMany({
    where: { id: { in: allIds } },
    select: { id: true, parentId: true, domain: true },
  });
  if (existing.length !== allIds.length) {
    return NextResponse.json(
      { error: "Au moins un dossier est introuvable" },
      { status: 400 },
    );
  }
  const domain = existing[0].domain;
  if (existing.some((f) => f.domain !== domain)) {
    return NextResponse.json(
      { error: "Les dossiers doivent être dans le même domaine" },
      { status: 400 },
    );
  }

  // Charge l'arbre complet du domaine (id, parentId) pour calculer les
  // profondeurs et cycles dans l'état CIBLE (post-update).
  const allFolders = await prisma.knowledgeFolder.findMany({
    where: { domain },
    select: { id: true, parentId: true },
  });

  // Applique les mutations en mémoire dans une map.
  const nextParentById = new Map<string, string | null>();
  for (const f of allFolders) {
    nextParentById.set(f.id, f.parentId);
  }
  for (const item of parsed.items) {
    nextParentById.set(item.id, item.parentId);
  }

  // Vérifie qu'aucun folder n'a un parentId inconnu (sauf null).
  for (const [id, pid] of nextParentById) {
    if (pid !== null && !nextParentById.has(pid)) {
      return NextResponse.json(
        { error: `Le parent ${pid} de ${id} n'existe pas` },
        { status: 400 },
      );
    }
  }

  // Helper interne pour calculer la profondeur d'un id dans l'arbre cible.
  function depthInTarget(id: string): number {
    let depth = 1;
    let current: string | null = nextParentById.get(id) ?? null;
    const seen = new Set<string>([id]);
    while (current && depth <= KNOWLEDGE_FOLDER_MAX_DEPTH * 2) {
      if (seen.has(current)) return KNOWLEDGE_FOLDER_MAX_DEPTH + 1; // cycle
      seen.add(current);
      depth++;
      current = nextParentById.get(current) ?? null;
    }
    return depth;
  }

  // Vérifie chaque mouvement explicite (sans payer N^2 sur tout l'arbre).
  for (const item of parsed.items) {
    const d = depthInTarget(item.id);
    if (d > KNOWLEDGE_FOLDER_MAX_DEPTH) {
      return NextResponse.json(
        {
          error: `Le dossier ${item.id} dépasserait la profondeur max (${KNOWLEDGE_FOLDER_MAX_DEPTH}).`,
        },
        { status: 400 },
      );
    }
  }

  // 2. Update batch en transaction.
  try {
    await prisma.$transaction(
      parsed.items.map((it) =>
        prisma.knowledgeFolder.update({
          where: { id: it.id },
          data: { parentId: it.parentId, order: it.order },
        }),
      ),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Échec de la réorganisation : ${message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ updated: parsed.items.length });
}
