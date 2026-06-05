/**
 * PATCH  /api/chomage-ia/snippets/[id] → update partiel (shortcut/title/content/order)
 * DELETE /api/chomage-ia/snippets/[id] → suppression
 *
 * Le shortcut est unique par domaine (cf. UNIQUE(domain, shortcut) en DB) :
 * un changement vers un shortcut déjà pris renvoie 409.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const SHORTCUT_REGEX = /^[a-zA-Z0-9_-]{1,40}$/;

const PatchSchema = z
  .object({
    shortcut: z
      .string()
      .min(1)
      .max(40)
      .regex(
        SHORTCUT_REGEX,
        "Shortcut invalide (a-z, 0-9, tiret, underscore uniquement)"
      )
      .optional(),
    title: z.string().min(1).max(120).optional(),
    content: z.string().min(1).max(20_000).optional(),
    order: z.number().int().min(0).max(10_000).optional(),
  })
  .refine(
    (v) =>
      v.shortcut !== undefined ||
      v.title !== undefined ||
      v.content !== undefined ||
      v.order !== undefined,
    { message: "Aucun champ à mettre à jour" }
  );

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const ip = getClientIp(req);
  const rl = checkRateLimit(`chomage-ia:snippets:patch:${ip}`, {
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
    const updated = await prisma.chatSnippet.update({
      where: { id },
      data: {
        ...(parsed.shortcut !== undefined
          ? { shortcut: parsed.shortcut.trim() }
          : {}),
        ...(parsed.title !== undefined ? { title: parsed.title.trim() } : {}),
        ...(parsed.content !== undefined ? { content: parsed.content } : {}),
        ...(parsed.order !== undefined ? { order: parsed.order } : {}),
      },
    });
    return NextResponse.json({
      id: updated.id,
      shortcut: updated.shortcut,
      title: updated.title,
      content: updated.content,
      domain: updated.domain,
      order: updated.order,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Ce shortcut est déjà utilisé dans ce domaine" },
        { status: 409 }
      );
    }
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return NextResponse.json({ error: "Snippet introuvable" }, { status: 404 });
    }
    throw err;
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;
  try {
    await prisma.chatSnippet.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: "Snippet introuvable" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
