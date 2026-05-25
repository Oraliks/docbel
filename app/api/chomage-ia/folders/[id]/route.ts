/**
 * PATCH  /api/chomage-ia/folders/[id] → rename / change color / reorder
 * DELETE /api/chomage-ia/folders/[id] → suppression (les sessions perdent
 *                                       leur folderId via onDelete: SetNull)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { checkRateLimit, getClientIp } from "@/lib/documents/rate-limit";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const PatchSchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    color: z.string().max(32).nullable().optional(),
    order: z.number().int().min(0).max(10_000).optional(),
  })
  .refine(
    (v) =>
      v.name !== undefined || v.color !== undefined || v.order !== undefined,
    { message: "Aucun champ à mettre à jour" }
  );

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const ip = getClientIp(req);
  const rl = checkRateLimit(`chomage-ia:folders:patch:${ip}`, {
    windowMs: 60_000,
    max: 60,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes — réessayez dans une minute" },
      { status: 429 }
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
      { status: 400 }
    );
  }

  try {
    const updated = await prisma.chatFolder.update({
      where: { id },
      data: {
        ...(parsed.name !== undefined ? { name: parsed.name.trim() } : {}),
        ...(parsed.color !== undefined
          ? { color: parsed.color?.trim() || null }
          : {}),
        ...(parsed.order !== undefined ? { order: parsed.order } : {}),
      },
    });
    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      color: updated.color,
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
    // Les sessions liées perdent leur folderId automatiquement (onDelete: SetNull).
    await prisma.chatFolder.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
