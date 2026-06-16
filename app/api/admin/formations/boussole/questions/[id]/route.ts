import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/auth-check";
import { ensureWriteAllowed } from "@/lib/admin/readonly-guard";
import { logActivity } from "@/lib/activity-logger";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

const bodySchema = z
  .object({
    isActive: z.boolean().optional(),
    order: z.number().int().optional(),
  })
  .refine((d) => d.isActive !== undefined || d.order !== undefined, {
    message: "isActive ou order requis",
  });

/**
 * PATCH /api/admin/formations/boussole/questions/[id] — active/désactive une
 * question de la Boussole (ou ajuste son ordre).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const guard = await ensureWriteAllowed();
  if (guard) return guard;

  const { id } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Body invalide", issues: parsed.error.flatten() },
      { status: 400, headers: jsonHeaders },
    );
  }

  const existing = await prisma.orientationQuestion.findUnique({
    where: { id },
    select: { id: true, text: true },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "Question introuvable" },
      { status: 404, headers: jsonHeaders },
    );
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;
  if (parsed.data.order !== undefined) data.order = parsed.data.order;

  try {
    const question = await prisma.orientationQuestion.update({
      where: { id },
      data,
      select: { id: true, isActive: true, order: true },
    });

    await logActivity(
      auth.user.id,
      "updated",
      "boussole",
      existing.text.slice(0, 80),
      existing.id,
      parsed.data.isActive !== undefined
        ? `isActive=${parsed.data.isActive}`
        : `order=${parsed.data.order}`,
    );

    return NextResponse.json({ ok: true, question }, { headers: jsonHeaders });
  } catch (err) {
    console.error("[admin/formations/boussole/questions] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500, headers: jsonHeaders },
    );
  }
}
