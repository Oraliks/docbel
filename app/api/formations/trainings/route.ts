import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireBookingActorAuth } from "@/lib/auth-check";
import { ensureWriteAllowed } from "@/lib/admin/readonly-guard";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import { formationOrgAccess } from "@/lib/formations/access";
import { resolveOrCreateFormationOrg } from "@/lib/formations/org-queries";
import {
  buildTrainingWriteData,
  genUniqueTrainingSlug,
  syncTrainingTags,
  visibilityError,
  toDate,
} from "@/lib/formations/org-mutations";
import { trainingCreatePayloadSchema } from "@/lib/formations/schemas";
import { blockIfFlagOff } from "@/lib/formations/module-guard";

const json = { "Content-Type": "application/json; charset=utf-8" };

/** Crée une formation (brouillon ou soumise) pour l'organisation du pro. */
export async function POST(req: Request) {
  const auth = await requireBookingActorAuth();
  if (!auth.isAuthorized) return auth.error;
  const block = await ensureWriteAllowed();
  if (block) return block;
  const blocked = await blockIfFlagOff("organizationCreation");
  if (blocked) return blocked;

  const body = await req.json().catch(() => null);
  const parsed = trainingCreatePayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides" },
      { status: 400, headers: json },
    );
  }
  const { training, sessions, submit } = parsed.data;
  if (!training.title) {
    return NextResponse.json({ error: "Titre requis" }, { status: 400, headers: json });
  }

  const org = await resolveOrCreateFormationOrg(
    auth.user.id,
    auth.user.role,
    auth.user.partnerOrganization,
  );
  if (!org) {
    return NextResponse.json(
      { error: "Aucune organisation rattachée à votre compte." },
      { status: 400, headers: json },
    );
  }

  const access = await formationOrgAccess(auth.user.id, auth.user.role, org.id);
  if (!access.capabilities.create) {
    return NextResponse.json(
      { error: "Votre organisation n'est pas autorisée à créer des formations." },
      { status: 403, headers: json },
    );
  }

  const visErr = visibilityError(training.visibility, access.capabilities);
  if (visErr) return NextResponse.json({ error: visErr }, { status: 403, headers: json });

  let status = "draft";
  const now = new Date();
  const extra: Prisma.TrainingUncheckedCreateInput = {} as Prisma.TrainingUncheckedCreateInput;
  if (submit) {
    if (!access.capabilities.submit) {
      return NextResponse.json({ error: "Soumission non autorisée." }, { status: 403, headers: json });
    }
    if (access.capabilities.publishDirectly) {
      status = "published";
      extra.publishedAt = now;
      extra.approvedAt = now;
    } else {
      status = "pending_review";
      extra.submittedAt = now;
    }
  }

  const writeData = buildTrainingWriteData(training);
  const slug = await genUniqueTrainingSlug(training.title);

  const created = await prisma.training.create({
    data: {
      ...(writeData as Prisma.TrainingUncheckedCreateInput),
      ...extra,
      title: training.title,
      slug,
      organizationId: org.id,
      createdById: auth.user.id,
      status,
      visibility: training.visibility ?? "draft",
      sessions:
        sessions && sessions.length > 0
          ? {
              create: sessions.map((s) => ({
                organizationId: org.id,
                title: s.title ?? null,
                status: s.status ?? "scheduled",
                mode: s.mode ?? "online",
                startsAt: toDate(s.startsAt),
                endsAt: toDate(s.endsAt),
                timezone: s.timezone ?? "Europe/Brussels",
                locationName: s.locationName ?? null,
                address: s.address ?? null,
                city: s.city ?? null,
                region: s.region ?? null,
                onlineUrl: s.onlineUrl || null,
                capacity: s.capacity ?? null,
                waitlistEnabled: s.waitlistEnabled ?? false,
                registrationDeadline: toDate(s.registrationDeadline),
                requiresManualApproval: s.requiresManualApproval ?? true,
                instructions: s.instructions ?? null,
                contactEmail: s.contactEmail || null,
              })),
            }
          : undefined,
    },
  });

  if (training.tagSlugs) await syncTrainingTags(created.id, training.tagSlugs);

  await logActivity(
    auth.user.id,
    submit ? "submitted" : "created",
    "formation",
    created.title,
    created.id,
  );

  return NextResponse.json({ id: created.id, slug: created.slug, status }, { status: 201, headers: json });
}
