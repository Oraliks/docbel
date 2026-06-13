/** Lectures partagées (pages + routes API) pour l'espace employeur. */
import "server-only";
import { prisma } from "@/lib/prisma";

export interface SourceInfo {
  code: string;
  title: string;
  url: string;
  institution: string;
}

/** Map code (S1..S13) → infos source, pour résoudre les liens dans l'UI. */
export async function getSourceMap(): Promise<Map<string, SourceInfo>> {
  const sources = await prisma.employerLegalSource.findMany({
    where: { active: true },
    select: { code: true, title: true, url: true, institution: true },
  });
  return new Map(sources.map((s) => [s.code, s]));
}

export async function getScenarioDetail(id: string) {
  return prisma.workerScenario.findUnique({
    where: { id },
    include: {
      employerProfile: true,
      checklists: {
        orderBy: { generatedAt: "desc" },
        include: { items: { orderBy: { order: "asc" } } },
      },
    },
  });
}

export type ScenarioDetail = NonNullable<Awaited<ReturnType<typeof getScenarioDetail>>>;

export async function listScenariosForUser(userId: string) {
  return prisma.workerScenario.findMany({
    where: { employerProfile: { userId } },
    orderBy: { updatedAt: "desc" },
    include: {
      employerProfile: { select: { organisationName: true } },
      _count: { select: { checklists: true } },
    },
  });
}

/** Contrôle d'accès : propriétaire ou admin (Critère 9). */
export function ownsScenario(
  scenario: { employerProfile: { userId: string } },
  userId: string,
  isAdmin: boolean
): boolean {
  return isAdmin || scenario.employerProfile.userId === userId;
}

/** Profil employeur de l'utilisateur (un seul pour le MVP), ou null. */
export async function getProfileForUser(userId: string) {
  return prisma.employerProfile.findFirst({ where: { userId } });
}
