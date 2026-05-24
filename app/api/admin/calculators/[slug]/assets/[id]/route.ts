import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { del } from "@vercel/blob";
import { prisma, withDbRetry } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { logActivity } from "@/lib/activity-logger";

/**
 * /api/admin/calculators/[slug]/assets/[id]
 *
 *  PATCH  → édite label / description / category / order / year
 *  DELETE → supprime la row + tente de supprimer le blob Vercel si applicable
 *
 * On ne permet PAS de changer le `kind` ni l'`url` d'un asset existant —
 * pour ça il faut supprimer puis recréer (sinon il faut gérer la cohérence
 * blob ↔ DB et c'est piégeux).
 */

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

const patchSchema = z
  .object({
    label: z.string().trim().min(2).max(200).optional(),
    description: z.string().trim().max(800).nullable().optional(),
    category: z.string().trim().max(40).nullable().optional(),
    order: z.number().int().min(0).max(9999).optional(),
    year: z.number().int().min(1990).max(2100).nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "Aucun champ à mettre à jour",
  });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { slug, id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: jsonHeaders },
    );
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Body invalide", details: parsed.error.flatten() },
      { status: 400, headers: jsonHeaders },
    );
  }

  const existing = await withDbRetry(() =>
    prisma.calculatorAsset.findUnique({ where: { id } }),
  );
  if (!existing || existing.slug !== slug) {
    return NextResponse.json(
      { error: "Asset introuvable pour ce slug" },
      { status: 404, headers: jsonHeaders },
    );
  }

  const updated = await withDbRetry(() =>
    prisma.calculatorAsset.update({
      where: { id },
      data: parsed.data,
    }),
  );

  await logActivity(
    auth.user.email,
    "updated",
    "file",
    `calc-asset:${slug}:${updated.label}`,
    id,
    `fields=${Object.keys(parsed.data).join(",")}`,
  );

  return NextResponse.json({ asset: updated }, { headers: jsonHeaders });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { slug, id } = await params;

  const existing = await withDbRetry(() =>
    prisma.calculatorAsset.findUnique({ where: { id } }),
  );
  if (!existing || existing.slug !== slug) {
    return NextResponse.json(
      { error: "Asset introuvable pour ce slug" },
      { status: 404, headers: jsonHeaders },
    );
  }

  // Si c'est un upload Vercel Blob, on tente la suppression best-effort.
  // L'URL d'un blob est de la forme https://<hash>.public.blob.vercel-storage.com/<path>
  const isBlobUrl =
    existing.kind !== "url" &&
    /vercel-storage\.com/i.test(existing.url) &&
    !!process.env.BLOB_READ_WRITE_TOKEN;

  if (isBlobUrl) {
    try {
      await del(existing.url);
    } catch (err) {
      // Best-effort : on log et on continue. La row DB reste à supprimer.
      console.warn(
        `[calculator-assets] del() failed for ${existing.url}:`,
        err,
      );
    }
  }

  await withDbRetry(() => prisma.calculatorAsset.delete({ where: { id } }));

  await logActivity(
    auth.user.email,
    "deleted",
    "file",
    `calc-asset:${slug}:${existing.label}`,
    id,
    `kind=${existing.kind} url=${existing.url}`,
  );

  return NextResponse.json({ deleted: true }, { headers: jsonHeaders });
}
