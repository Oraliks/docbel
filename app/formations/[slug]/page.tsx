import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getTrainingBySlug, seatsLeft } from "@/lib/formations/queries";
import { getFormationsViewer } from "@/lib/formations/page-auth";
import { canViewTraining } from "@/lib/formations/access";
import { getTrainingAccess } from "@/lib/formations/module";
import { ModuleGate } from "@/components/formations/module-gate";
import { OPEN_SESSION_STATUSES } from "@/lib/formations/constants";
import { TrainingDetailClient, type TrainingDetailView } from "./training-detail-client";
import { PrivateNotice } from "./private-notice";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const tr = await getTranslations("public.formations");
  const training = await getTrainingBySlug(slug);
  if (!training) return { title: tr("metaTrainingNotFound") };
  return {
    title: tr("metaTrainingTitle", { title: training.title }),
    description: training.shortDescription ?? undefined,
  };
}

export default async function TrainingDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const viewer = await getFormationsViewer();

  const { access, config } = await getTrainingAccess(viewer, "public");
  if (access === "hidden") notFound();
  if (access !== "ok")
    return <ModuleGate access={access} maintenanceMessage={config.maintenanceMessage} />;

  const training = await getTrainingBySlug(slug);
  if (!training) notFound();

  const allowed = await canViewTraining(viewer, training);
  if (!allowed) return <PrivateNotice visibility={training.visibility} />;

  const now = Date.now();
  const view: TrainingDetailView = {
    id: training.id,
    slug: training.slug,
    title: training.title,
    shortDescription: training.shortDescription,
    description: training.description,
    objectives: training.objectives,
    targetAudience: training.targetAudience,
    prerequisites: training.prerequisites,
    level: training.level,
    language: training.language,
    format: training.format,
    durationHours: training.durationHours,
    durationLabel: training.totalDurationLabel,
    rhythm: training.rhythm,
    priceType: training.priceType,
    priceAmount: training.priceAmount,
    currency: training.currency,
    externalPaymentUrl: training.externalPaymentUrl,
    paymentInfo: training.paymentInfo,
    cancellationPolicy: training.cancellationPolicy,
    certificateType: training.certificateType,
    certificateDescription: training.certificateDescription,
    visibility: training.visibility,
    isVerifiedByDocbel: training.isVerifiedByDocbel,
    isDocbelRecommended: training.isDocbelRecommended,
    externalUrl: training.externalUrl,
    contactName: training.contactName,
    contactEmail: training.contactEmail,
    contactPhone: training.contactPhone,
    contactWebsite: training.contactWebsite,
    organization: {
      name: training.organization.name,
      slug: training.organization.slug,
      type: training.organization.type,
      logoUrl: training.organization.logoUrl,
      brandColor: training.organization.brandColor,
      website: training.organization.website,
    },
    category: training.category
      ? {
          slug: training.category.slug,
          name: training.category.name,
          color: training.category.color,
          icon: training.category.icon,
        }
      : null,
    tags: training.tags.map((t) => ({ slug: t.tag.slug, name: t.tag.name })),
    sessions: training.sessions.map((s) => {
      const left = seatsLeft(s);
      const deadlineOk = !s.registrationDeadline || s.registrationDeadline.getTime() > now;
      return {
        id: s.id,
        title: s.title,
        status: s.status,
        mode: s.mode,
        startsAt: s.startsAt ? s.startsAt.toISOString() : null,
        endsAt: s.endsAt ? s.endsAt.toISOString() : null,
        city: s.city,
        region: s.region,
        locationName: s.locationName,
        address: s.address,
        onlineUrl: s.onlineUrl,
        capacity: s.capacity,
        seatsLeft: left,
        registrationDeadline: s.registrationDeadline ? s.registrationDeadline.toISOString() : null,
        instructions: s.instructions,
        isOpen:
          OPEN_SESSION_STATUSES.includes(s.status as (typeof OPEN_SESSION_STATUSES)[number]) &&
          deadlineOk,
      };
    }),
  };

  return <TrainingDetailClient training={view} />;
}
