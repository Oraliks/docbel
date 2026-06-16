import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth-check";
import { ensureWriteAllowed } from "@/lib/admin/readonly-guard";
import { logActivity } from "@/lib/activity-logger";
import { prisma } from "@/lib/prisma";
import { orgPermissionSchema } from "@/lib/formations/schemas";

export const runtime = "nodejs";
const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

/**
 * PATCH /api/admin/formations/orgs/[orgId]/permissions — upsert des capacités
 * de création de formations d'une organisation (1:1). Seuls les champs fournis
 * sont modifiés ; les valeurs absentes gardent le défaut Prisma à la création.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const guard = await ensureWriteAllowed();
  if (guard) return guard;

  const { orgId } = await params;
  const parsed = orgPermissionSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Body invalide", issues: parsed.error.flatten() },
      { status: 400, headers: jsonHeaders },
    );
  }

  const org = await prisma.formationOrganization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true },
  });
  if (!org) {
    return NextResponse.json(
      { error: "Organisation introuvable" },
      { status: 404, headers: jsonHeaders },
    );
  }

  // On ne propage que les clés explicitement fournies (toutes optionnelles).
  const fields = Object.fromEntries(
    Object.entries(parsed.data).filter(([, v]) => v !== undefined),
  );

  try {
    const permission = await prisma.organizationTrainingPermission.upsert({
      where: { organizationId: orgId },
      create: { organizationId: orgId, updatedById: auth.user.id, ...fields },
      update: { updatedById: auth.user.id, ...fields },
    });

    await logActivity(
      auth.user.id,
      "updated",
      "formation_org",
      org.name,
      org.id,
      `permissions mises à jour (${Object.keys(fields).length} champ(s))`,
    );

    return NextResponse.json({ ok: true, permission }, { headers: jsonHeaders });
  } catch (err) {
    console.error("[admin/formations/orgs/permissions] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500, headers: jsonHeaders },
    );
  }
}
