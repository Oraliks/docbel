import { redirect, notFound } from "next/navigation";
import { getOrgPageUser } from "@/lib/formations/page-auth";
import {
  getOrgContext,
  listOrgTrainings,
  getOrgStats,
  getOrgTraining,
  getTrainingWithEnrollments,
  listAllTags,
  listCategoriesForSelect,
  type OrgTrainingDetail,
} from "@/lib/formations/org-queries";
import { formationOrgAccess } from "@/lib/formations/access";
import { OrgFormationsHome } from "./org-home";
import { TrainingWizard, type WizardInitial } from "./training-wizard";
import { TrainingManage, type OrgManageView, type ManageCaps } from "./training-manage";
import { EnrollmentsManager } from "./enrollments-manager";

type Segment = "employeur" | "partenaire";

function basePathFor(segment: Segment) {
  return `/${segment}/formations`;
}

/** /[seg]/formations — liste + stats. */
export async function OrgFormationsListPage({ segment }: { segment: Segment }) {
  const user = await getOrgPageUser(segment);
  if (!user) redirect(`/p/${segment}`);

  const { orgIds } = await getOrgContext(user.id, user.role);
  const [items, stats] = await Promise.all([listOrgTrainings(orgIds), getOrgStats(orgIds)]);

  return <OrgFormationsHome items={items} stats={stats} basePath={basePathFor(segment)} />;
}

/** /[seg]/formations/nouvelle — wizard de création. */
export async function OrgFormationsNewPage({ segment }: { segment: Segment }) {
  const user = await getOrgPageUser(segment);
  if (!user) redirect(`/p/${segment}`);

  const [{ allowedVisibilities }, categories, tags] = await Promise.all([
    getOrgContext(user.id, user.role),
    listCategoriesForSelect(),
    listAllTags(),
  ]);

  return (
    <TrainingWizard
      mode="create"
      basePath={basePathFor(segment)}
      categories={categories}
      tags={tags}
      allowedVisibilities={allowedVisibilities}
    />
  );
}

async function loadOwnedTraining(segment: Segment, id: string) {
  const user = await getOrgPageUser(segment);
  if (!user) redirect(`/p/${segment}`);
  const training = await getOrgTraining(id);
  if (!training) notFound();
  const access = await formationOrgAccess(user.id, user.role, training.organizationId);
  if (!access.role) notFound();
  return { user, training, caps: access.capabilities };
}

function toManageView(t: OrgTrainingDetail): OrgManageView {
  return {
    id: t.id,
    title: t.title,
    slug: t.slug,
    status: t.status,
    visibility: t.visibility,
    adminReviewNote: t.adminReviewNote,
    rejectedReason: t.rejectedReason,
    priceType: t.priceType,
    priceAmount: t.priceAmount,
    currency: t.currency,
    sessions: t.sessions.map((s) => ({
      id: s.id,
      title: s.title,
      status: s.status,
      mode: s.mode,
      startsAt: s.startsAt ? s.startsAt.toISOString() : null,
      endsAt: s.endsAt ? s.endsAt.toISOString() : null,
      city: s.city,
      region: s.region,
      onlineUrl: s.onlineUrl,
      capacity: s.capacity,
      waitlistEnabled: s.waitlistEnabled,
      registrationDeadline: s.registrationDeadline ? s.registrationDeadline.toISOString() : null,
      requiresManualApproval: s.requiresManualApproval,
      enrollmentsCount: s._count.enrollments,
    })),
  };
}

/** /[seg]/formations/[id] — page de gestion. */
export async function OrgFormationsManagePage({ segment, id }: { segment: Segment; id: string }) {
  const { training, caps } = await loadOwnedTraining(segment, id);
  const manageCaps: ManageCaps = {
    create: caps.create,
    submit: caps.submit,
    manageSessions: caps.manageSessions,
    manageEnrollments: caps.manageEnrollments,
  };
  return <TrainingManage training={toManageView(training)} basePath={basePathFor(segment)} caps={manageCaps} />;
}

/** /[seg]/formations/[id]/inscriptions — gestion des inscriptions. */
export async function OrgFormationsEnrollmentsPage({ segment, id }: { segment: Segment; id: string }) {
  const { caps } = await loadOwnedTraining(segment, id);
  if (!caps.manageEnrollments) notFound();
  const data = await getTrainingWithEnrollments(id);
  if (!data) notFound();
  return (
    <EnrollmentsManager
      trainingTitle={data.title}
      trainingId={id}
      sessions={data.sessions}
      basePath={basePathFor(segment)}
    />
  );
}

/** /[seg]/formations/[id]/modifier — wizard d'édition. */
export async function OrgFormationsEditPage({ segment, id }: { segment: Segment; id: string }) {
  const { user, training } = await loadOwnedTraining(segment, id);
  const [{ allowedVisibilities }, categories, tags] = await Promise.all([
    getOrgContext(user.id, user.role),
    listCategoriesForSelect(),
    listAllTags(),
  ]);

  const initial: Partial<WizardInitial> = {
    title: training.title,
    shortDescription: training.shortDescription ?? "",
    description: training.description ?? "",
    objectives: training.objectives,
    targetAudience: training.targetAudience ?? "",
    prerequisites: training.prerequisites ?? "",
    level: training.level,
    language: training.language,
    categoryId: training.categoryId ?? "",
    format: training.format,
    durationHours: training.durationHours != null ? String(training.durationHours) : "",
    totalDurationLabel: training.totalDurationLabel ?? "",
    rhythm: training.rhythm ?? "",
    priceType: training.priceType,
    priceAmount: training.priceAmount != null ? String(training.priceAmount) : "",
    currency: training.currency,
    externalPaymentUrl: training.externalPaymentUrl ?? "",
    paymentInfo: training.paymentInfo ?? "",
    cancellationPolicy: training.cancellationPolicy ?? "",
    certificateType: training.certificateType,
    certificateDescription: training.certificateDescription ?? "",
    contactName: training.contactName ?? "",
    contactEmail: training.contactEmail ?? "",
    contactPhone: training.contactPhone ?? "",
    contactWebsite: training.contactWebsite ?? "",
    coverImageUrl: training.coverImageUrl ?? "",
    externalUrl: training.externalUrl ?? "",
    visibility: training.visibility,
    keywords: training.keywords.join(", "),
    tagSlugs: training.tags.map((t) => t.tag.slug),
  };

  return (
    <TrainingWizard
      mode="edit"
      basePath={basePathFor(segment)}
      trainingId={training.id}
      categories={categories}
      tags={tags}
      allowedVisibilities={allowedVisibilities}
      initial={initial}
    />
  );
}
