import { NextRequest, NextResponse } from "next/server";
import { UserStatus } from "@prisma/client";
import { requireAdminAuth } from "@/lib/auth-check";
import { ensureWriteAllowed } from "@/lib/admin/readonly-guard";
import { logActivity, type ActivityAction } from "@/lib/activity-logger";
import { prisma } from "@/lib/prisma";
import { orgReviewActionSchema } from "@/lib/formations/schemas";
import { sendOrgDecisionEmail } from "@/lib/formations/emails";
import type { FormationOrgStatus } from "@/lib/formations/constants";

export const runtime = "nodejs";
const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

type ReviewAction = "approve" | "reject" | "suspend" | "reactivate";

/** Actions dont la note est obligatoire EN PRODUCTION (traçabilité de la décision). */
const NOTE_REQUIRED_IN_PROD: ReviewAction[] = ["reject", "suspend"];

/** Action de décision → action d'activité (journal admin). */
const ACTIVITY_ACTION: Record<ReviewAction, ActivityAction> = {
  approve: "approved",
  reject: "rejected",
  suspend: "suspended",
  reactivate: "updated",
};

/** Action de décision → statut cible de l'organisation. */
const TARGET_STATUS: Record<ReviewAction, FormationOrgStatus> = {
  approve: "active",
  reject: "rejected",
  suspend: "suspended",
  reactivate: "active",
};

/**
 * POST /api/admin/formations/orgs/[orgId]/review — décision admin sur une
 * demande d'organisme (valider / refuser / suspendre / réactiver).
 *
 * `approve` crée aussi la ligne de permissions si elle manque, SANS forcer de
 * flag : les défauts Prisma sont volontairement restrictifs (publication
 * directe, formations privées et internes = OFF). L'octroi de ces capacités
 * reste un geste explicite via /admin/formations/permissions.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const guard = await ensureWriteAllowed();
  if (guard) return guard;

  const { orgId } = await params;
  const parsed = orgReviewActionSchema.safeParse(
    await req.json().catch(() => ({})),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Body invalide", issues: parsed.error.flatten() },
      { status: 400, headers: jsonHeaders },
    );
  }

  const { action } = parsed.data;
  const trimmedNote = parsed.data.note?.trim();
  const note = trimmedNote && trimmedNote.length > 0 ? trimmedNote : undefined;

  if (
    process.env.NODE_ENV === "production" &&
    NOTE_REQUIRED_IN_PROD.includes(action) &&
    !note
  ) {
    return NextResponse.json(
      { error: "Une note est requise pour cette action." },
      { status: 400, headers: jsonHeaders },
    );
  }

  const org = await prisma.formationOrganization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true, contactEmail: true, contactName: true },
  });
  if (!org) {
    return NextResponse.json(
      { error: "Organisation introuvable" },
      { status: 404, headers: jsonHeaders },
    );
  }

  try {
    const now = new Date();
    const base = {
      status: TARGET_STATUS[action],
      reviewedAt: now,
      reviewedById: auth.user.id,
    };
    const data =
      action === "reject"
        ? { ...base, rejectedReason: note ?? null }
        : action === "approve"
          ? { ...base, reviewNote: note ?? null, rejectedReason: null }
          : { ...base, reviewNote: note ?? null };

    const updated = await prisma.formationOrganization.update({
      where: { id: org.id },
      data,
      select: { id: true, status: true },
    });

    // Validation = l'organisation doit disposer d'une ligne de permissions.
    // `update: {}` → on ne touche à rien si elle existe déjà (une suspension
    // suivie d'une revalidation ne réinitialise pas les capacités accordées).
    if (action === "approve") {
      await prisma.organizationTrainingPermission.upsert({
        where: { organizationId: org.id },
        create: { organizationId: org.id, updatedById: auth.user.id },
        update: {},
      });
    }

    // Validation/réactivation = les comptes de l'organisation doivent pouvoir se
    // connecter. L'inscription self-service crée le propriétaire en `pending`
    // (login bloqué par le hook better-auth) : sans ça, un organisme validé
    // resterait enfermé dehors. On n'active QUE les comptes `pending` de rôle
    // `organisme` rattachés à cette organisation (jamais un admin ou un compte
    // désactivé manuellement).
    if (action === "approve" || action === "reactivate") {
      const memberIds = (
        await prisma.formationOrgMember.findMany({
          where: { organizationId: org.id },
          select: { userId: true },
        })
      ).map((m) => m.userId);

      if (memberIds.length > 0) {
        await prisma.user.updateMany({
          where: {
            id: { in: memberIds },
            role: "organisme",
            status: UserStatus.pending,
          },
          data: { status: UserStatus.active, emailVerified: true, emailVerifiedAt: new Date() },
        });
      }
    }

    if (org.contactEmail) {
      await sendOrgDecisionEmail({
        to: org.contactEmail,
        orgName: org.name,
        contactName: org.contactName,
        decision: action,
        note,
      });
    }

    await logActivity(
      auth.user.id,
      ACTIVITY_ACTION[action],
      "formation_org",
      org.name,
      org.id,
      note ?? `action=${action}`,
    );

    return NextResponse.json(
      { ok: true, org: { id: updated.id, status: updated.status } },
      { headers: jsonHeaders },
    );
  } catch (err) {
    console.error("[admin/formations/orgs/review] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500, headers: jsonHeaders },
    );
  }
}
