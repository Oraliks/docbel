/**
 * GET  /api/chomage-ia/snippets?domain=chomage
 * POST /api/chomage-ia/snippets
 *
 * Snippets réutilisables insérables via le command palette `/<shortcut>` dans
 * la textarea chat / prompt. Permet à l'admin de sauvegarder ses formulations
 * fréquentes (instructions, patterns, intros récurrentes) pour les réinjecter
 * en 3 frappes.
 *
 * GET  : liste ordonnée (order ASC, createdAt DESC) — tout est public côté
 *        client puisqu'on ne stocke pas de contenu sensible. Pas de pagination
 *        (volume attendu < 50 entrées).
 * POST : création d'un nouveau snippet. Le shortcut doit être unique par
 *        domaine ; le serveur renvoie 409 si conflit.
 *
 * Auth admin obligatoire (les snippets vivent sous l'admin).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";
import { DEFAULT_DOMAIN } from "@/lib/chomage-ia/types";

/**
 * Regex de validation du shortcut. On accepte lettres ASCII, chiffres, tirets
 * et underscores — pas d'espaces ni de caractères spéciaux qui rendraient le
 * matching dans la textarea ambigu (cf. snippets-helper.ts).
 */
const SHORTCUT_REGEX = /^[a-zA-Z0-9_-]{1,40}$/;

const CreateSchema = z.object({
  shortcut: z
    .string()
    .min(1, "Shortcut requis")
    .max(40)
    .regex(
      SHORTCUT_REGEX,
      "Shortcut invalide (a-z, 0-9, tiret, underscore uniquement)"
    ),
  title: z.string().min(1, "Titre requis").max(120),
  content: z.string().min(1, "Contenu requis").max(20_000),
  domain: z.string().min(2).max(50).optional().default(DEFAULT_DOMAIN),
  order: z.number().int().min(0).max(10_000).optional(),
});

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const url = new URL(req.url);
  const domain = url.searchParams.get("domain") ?? DEFAULT_DOMAIN;

  const snippets = await prisma.chatSnippet.findMany({
    where: { domain },
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      shortcut: true,
      title: true,
      content: true,
      domain: true,
      order: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    items: snippets.map((s) => ({
      id: s.id,
      shortcut: s.shortcut,
      title: s.title,
      content: s.content,
      domain: s.domain,
      order: s.order,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    })),
    count: snippets.length,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const ip = getClientIp(req);
  const rl = checkRateLimit(`chomage-ia:snippets:create:${ip}`, {
    windowMs: 60_000,
    max: 30,
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

  // Calcule l'ordre si non fourni (empile en fin de liste).
  let nextOrder = parsed.order;
  if (nextOrder === undefined) {
    const last = await prisma.chatSnippet.findFirst({
      where: { domain },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    nextOrder = (last?.order ?? -1) + 1;
  }

  try {
    const created = await prisma.chatSnippet.create({
      data: {
        shortcut: parsed.shortcut.trim(),
        title: parsed.title.trim(),
        content: parsed.content,
        domain,
        order: nextOrder,
        createdById: auth.user.id,
      },
    });

    return NextResponse.json(
      {
        id: created.id,
        shortcut: created.shortcut,
        title: created.title,
        content: created.content,
        domain: created.domain,
        order: created.order,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        {
          error: `Le shortcut « ${parsed.shortcut} » existe déjà dans ce domaine`,
        },
        { status: 409 }
      );
    }
    throw err;
  }
}
