/**
 * GET  /api/chomage-ia/kb-folders?domain=chomage
 * POST /api/chomage-ia/kb-folders
 *
 * Gestion des KnowledgeFolder (migration 21) — dossiers de classement
 * hiérarchique pour les sources de la KB.
 *
 * Important : ces routes sont *séparées* de `/api/chomage-ia/folders` qui
 * gère les ChatFolder (dossiers de sessions de chat). Le namespace `kb-folders`
 * évite la confusion entre les deux modèles.
 *
 * - GET : liste plate triée par (parentId asc, order asc), avec un compteur
 *   de KnowledgeSource par folder (groupBy). Le front re-construit l'arbre.
 * - POST : création d'un folder (root ou nested). Si `parentId` est fourni,
 *   on valide la profondeur (< KNOWLEDGE_FOLDER_MAX_DEPTH).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { checkRateLimit, getClientIp } from "@/lib/documents/rate-limit";
import {
  DEFAULT_DOMAIN,
  KNOWLEDGE_FOLDER_MAX_DEPTH,
  type KnowledgeFolderListItem,
} from "@/lib/chomage-ia/types";
import { getFolderDepth } from "@/lib/chomage-ia/folders";

const CreateSchema = z.object({
  name: z.string().min(1, "Nom requis").max(80),
  color: z.string().max(32).optional().nullable(),
  icon: z.string().max(40).optional().nullable(),
  parentId: z.string().min(1).max(50).optional().nullable(),
  order: z.number().int().min(0).max(10_000).optional(),
  domain: z.string().min(2).max(50).optional().default(DEFAULT_DOMAIN),
});

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const url = new URL(req.url);
  const domain = url.searchParams.get("domain") ?? DEFAULT_DOMAIN;

  const [folders, countsByFolder] = await Promise.all([
    prisma.knowledgeFolder.findMany({
      where: { domain },
      orderBy: [{ parentId: "asc" }, { order: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        color: true,
        icon: true,
        parentId: true,
        order: true,
        domain: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.knowledgeSource.groupBy({
      by: ["folderId"],
      where: { domain, folderId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const countMap = new Map<string, number>();
  for (const row of countsByFolder) {
    if (row.folderId) countMap.set(row.folderId, row._count._all);
  }

  const items: KnowledgeFolderListItem[] = folders.map((f) => ({
    id: f.id,
    name: f.name,
    color: f.color,
    icon: f.icon,
    parentId: f.parentId,
    order: f.order,
    domain: f.domain,
    sourceCount: countMap.get(f.id) ?? 0,
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
  }));

  // Stats utilitaires pour la sidebar : nombre de sources sans folder, total.
  const [unassignedCount, totalCount] = await Promise.all([
    prisma.knowledgeSource.count({ where: { domain, folderId: null } }),
    prisma.knowledgeSource.count({ where: { domain } }),
  ]);

  return NextResponse.json({
    items,
    unassignedCount,
    totalCount,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const ip = getClientIp(req);
  const rl = checkRateLimit(`chomage-ia:kb-folders:create:${ip}`, {
    windowMs: 60_000,
    max: 30,
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
    parsed = CreateSchema.parse(body);
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

  const domain = parsed.domain ?? DEFAULT_DOMAIN;

  // Validation parent + profondeur si fourni.
  if (parsed.parentId) {
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
    if (parent.domain !== domain) {
      return NextResponse.json(
        { error: "Dossier parent dans un autre domaine" },
        { status: 400 },
      );
    }
    const parentDepth = await getFolderDepth(parsed.parentId);
    if (parentDepth >= KNOWLEDGE_FOLDER_MAX_DEPTH) {
      return NextResponse.json(
        {
          error: `Profondeur max atteinte (${KNOWLEDGE_FOLDER_MAX_DEPTH} niveaux).`,
        },
        { status: 400 },
      );
    }
  }

  // Calcul de l'order : si pas fourni, on prend max(order)+1 parmi les siblings.
  let nextOrder = parsed.order ?? 0;
  if (parsed.order === undefined) {
    const last = await prisma.knowledgeFolder.findFirst({
      where: { domain, parentId: parsed.parentId ?? null },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    nextOrder = (last?.order ?? -1) + 1;
  }

  const folder = await prisma.knowledgeFolder.create({
    data: {
      name: parsed.name.trim(),
      color: parsed.color?.trim() || null,
      icon: parsed.icon?.trim() || null,
      parentId: parsed.parentId ?? null,
      order: nextOrder,
      domain,
      createdById: auth.user.id,
    },
  });

  const item: KnowledgeFolderListItem = {
    id: folder.id,
    name: folder.name,
    color: folder.color,
    icon: folder.icon,
    parentId: folder.parentId,
    order: folder.order,
    domain: folder.domain,
    sourceCount: 0,
    createdAt: folder.createdAt.toISOString(),
    updatedAt: folder.updatedAt.toISOString(),
  };

  return NextResponse.json(item, { status: 201 });
}
