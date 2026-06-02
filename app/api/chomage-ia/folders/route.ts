/**
 * GET  /api/chomage-ia/folders?domain=chomage
 * POST /api/chomage-ia/folders
 *
 * Gestion des dossiers de groupement coloré pour les ChatSession.
 *
 * - GET : liste des dossiers du domaine, triés par `order` ASC puis `createdAt`
 *   DESC. Inclut un compteur de sessions (hors archivées) pour le badge UI.
 * - POST : création d'un nouveau dossier (name + color optionnelle).
 *   `order` est calculé automatiquement (max+1) pour empiler en fin de liste.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";
import { DEFAULT_DOMAIN } from "@/lib/chomage-ia/types";

const CreateSchema = z.object({
  name: z.string().min(1, "Nom requis").max(80),
  color: z.string().max(32).optional().nullable(),
  domain: z.string().min(2).max(50).optional().default(DEFAULT_DOMAIN),
});

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const url = new URL(req.url);
  const domain = url.searchParams.get("domain") ?? DEFAULT_DOMAIN;

  const folders = await prisma.chatFolder.findMany({
    where: { domain },
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      color: true,
      order: true,
      domain: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { sessions: { where: { archived: false } } } },
    },
  });

  return NextResponse.json({
    items: folders.map((f) => ({
      id: f.id,
      name: f.name,
      color: f.color,
      order: f.order,
      domain: f.domain,
      sessionCount: f._count.sessions,
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const ip = getClientIp(req);
  const rl = checkRateLimit(`chomage-ia:folders:create:${ip}`, {
    windowMs: 60_000,
    max: 20,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes — réessayez dans une minute" },
      { status: 429 }
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
      { status: 400 }
    );
  }

  const domain = parsed.domain ?? DEFAULT_DOMAIN;

  const last = await prisma.chatFolder.findFirst({
    where: { domain },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const nextOrder = (last?.order ?? -1) + 1;

  const folder = await prisma.chatFolder.create({
    data: {
      name: parsed.name.trim(),
      color: parsed.color?.trim() || null,
      order: nextOrder,
      domain,
      createdById: auth.user.id,
    },
  });

  return NextResponse.json({
    id: folder.id,
    name: folder.name,
    color: folder.color,
    order: folder.order,
    domain: folder.domain,
    sessionCount: 0,
    createdAt: folder.createdAt.toISOString(),
    updatedAt: folder.updatedAt.toISOString(),
  });
}
