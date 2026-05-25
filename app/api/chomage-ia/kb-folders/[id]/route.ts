/**
 * PATCH  /api/chomage-ia/kb-folders/[id] → rename / color / icon / move (parentId)
 * DELETE /api/chomage-ia/kb-folders/[id] → suppression
 *
 * Migration 21 — KnowledgeFolder.
 *
 * Le DELETE :
 *   - Les KnowledgeSource contenues perdent leur folderId (FK onDelete SetNull).
 *   - Les KnowledgeFolder enfants (parentId pointant vers ce folder) remontent
 *     en racine (parentId=null) via FK self-ref onDelete SetNull.
 *   → Pas de cascade destructive : on perd l'organisation mais pas les sources.
 *
 * Le PATCH `parentId` :
 *   - Valide qu'on ne crée pas de cycle (le nouveau parent ne doit pas être
 *     un descendant du folder courant).
 *   - Valide que la profondeur résultante reste ≤ KNOWLEDGE_FOLDER_MAX_DEPTH
 *     en tenant compte de la hauteur du sous-arbre déplacé.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { checkRateLimit, getClientIp } from "@/lib/documents/rate-limit";
import { KNOWLEDGE_FOLDER_MAX_DEPTH } from "@/lib/chomage-ia/types";
import {
  isMoveAcyclic,
  getResultingDepthAfterMove,
} from "@/lib/chomage-ia/folders";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const PatchSchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    color: z.string().max(32).nullable().optional(),
    icon: z.string().max(40).nullable().optional(),
    parentId: z.string().min(1).max(50).nullable().optional(),
    order: z.number().int().min(0).max(10_000).optional(),
  })
  .refine(
    (v) =>
      v.name !== undefined ||
      v.color !== undefined ||
      v.icon !== undefined ||
      v.parentId !== undefined ||
      v.order !== undefined,
    { message: "Aucun champ à mettre à jour" },
  );

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const ip = getClientIp(req);
  const rl = checkRateLimit(`chomage-ia:kb-folders:patch:${ip}`, {
    windowMs: 60_000,
    max: 80,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes — réessayez dans une minute" },
      { status: 429 },
    );
  }

  const { id } = await params;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = PatchSchema.parse(body);
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

  const existing = await prisma.knowledgeFolder.findUnique({
    where: { id },
    select: { id: true, parentId: true, domain: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });
  }

  // Validation move : cycle + profondeur.
  if (parsed.parentId !== undefined) {
    if (parsed.parentId === id) {
      return NextResponse.json(
        { error: "Un dossier ne peut pas être son propre parent" },
        { status: 400 },
      );
    }
    if (parsed.parentId) {
      // Vérifie l'existence + domaine du nouveau parent.
      const parent = await prisma.knowledgeFolder.findUnique({
        where: { id: parsed.parentId },
        select: { id: true, domain: true },
      });
      if (!parent) {
        return NextResponse.json(
          { error: "Dossier parent introuvable" },
          { status: 400 },
        );
      }
      if (parent.domain !== existing.domain) {
        return NextResponse.json(
          { error: "Parent dans un autre domaine" },
          { status: 400 },
        );
      }
    }
    // Cycle ?
    const acyclic = await isMoveAcyclic({
      folderId: id,
      newParentId: parsed.parentId ?? null,
    });
    if (!acyclic) {
      return NextResponse.json(
        { error: "Déplacement impossible : créerait un cycle" },
        { status: 400 },
      );
    }
    // Profondeur résultante du sous-arbre déplacé.
    const resultingDepth = await getResultingDepthAfterMove({
      folderId: id,
      newParentId: parsed.parentId ?? null,
    });
    if (resultingDepth > KNOWLEDGE_FOLDER_MAX_DEPTH) {
      return NextResponse.json(
        {
          error: `Profondeur max dépassée (${resultingDepth}/${KNOWLEDGE_FOLDER_MAX_DEPTH}).`,
        },
        { status: 400 },
      );
    }
  }

  try {
    const updated = await prisma.knowledgeFolder.update({
      where: { id },
      data: {
        ...(parsed.name !== undefined ? { name: parsed.name.trim() } : {}),
        ...(parsed.color !== undefined
          ? { color: parsed.color?.trim() || null }
          : {}),
        ...(parsed.icon !== undefined
          ? { icon: parsed.icon?.trim() || null }
          : {}),
        ...(parsed.parentId !== undefined
          ? { parentId: parsed.parentId ?? null }
          : {}),
        ...(parsed.order !== undefined ? { order: parsed.order } : {}),
      },
    });
    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      color: updated.color,
      icon: updated.icon,
      parentId: updated.parentId,
      order: updated.order,
    });
  } catch {
    return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;
  try {
    // FK self-ref (parentId) → enfants remontent en racine. FK sources → folderId
    // des sources passe à null. Pas de cascade destructive ici.
    await prisma.knowledgeFolder.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
