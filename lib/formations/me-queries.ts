/** Requêtes "Mes formations" (espace citoyen connecté). */
import "server-only";
import { prisma } from "@/lib/prisma";
import { getTrainingCardsByIds, type TrainingCardData } from "./queries";

export interface MyEnrollment {
  id: string;
  status: string;
  trainingTitle: string;
  trainingSlug: string;
  orgName: string | null;
  sessionStartsAt: string | null;
  sessionMode: string;
  sessionCity: string | null;
  requestedAt: string;
  certificateUrl: string | null;
}

export async function getMyEnrollments(userId: string): Promise<MyEnrollment[]> {
  const rows = await prisma.trainingEnrollment.findMany({
    where: { userId },
    orderBy: { requestedAt: "desc" },
    include: {
      session: {
        select: {
          startsAt: true,
          mode: true,
          city: true,
          training: { select: { title: true, slug: true, organization: { select: { name: true } } } },
        },
      },
    },
  });
  return rows.map((e) => ({
    id: e.id,
    status: e.status,
    trainingTitle: e.session.training.title,
    trainingSlug: e.session.training.slug,
    orgName: e.session.training.organization?.name ?? null,
    sessionStartsAt: e.session.startsAt ? e.session.startsAt.toISOString() : null,
    sessionMode: e.session.mode,
    sessionCity: e.session.city,
    requestedAt: e.requestedAt.toISOString(),
    certificateUrl: e.certificateUrl,
  }));
}

export async function getMySavedTrainings(userId: string): Promise<TrainingCardData[]> {
  const saved = await prisma.trainingSaved.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { trainingId: true },
  });
  return getTrainingCardsByIds(saved.map((s) => s.trainingId));
}

export interface MyResult {
  id: string;
  primaryBranchKey: string | null;
  secondaryBranchKeys: string[];
  confidence: number | null;
  createdAt: string;
}

export interface MyCertificate {
  id: string;
  certificateNumber: string;
  trainingTitle: string;
  orgName: string | null;
  type: string;
  issuedAt: string;
}

export async function getMyCertificates(userId: string): Promise<MyCertificate[]> {
  const rows = await prisma.trainingCertificate.findMany({
    where: { userId, status: "issued" },
    orderBy: { issuedAt: "desc" },
  });
  return rows.map((c) => ({
    id: c.id,
    certificateNumber: c.certificateNumber,
    trainingTitle: c.trainingTitle,
    orgName: c.orgName,
    type: c.type,
    issuedAt: c.issuedAt.toISOString(),
  }));
}

export async function getMyResults(userId: string): Promise<MyResult[]> {
  const rows = await prisma.orientationResult.findMany({
    where: { userId, saved: true },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  return rows.map((r) => ({
    id: r.id,
    primaryBranchKey: r.primaryBranchId,
    secondaryBranchKeys: r.secondaryBranchIds,
    confidence: r.confidenceScore,
    createdAt: r.createdAt.toISOString(),
  }));
}
