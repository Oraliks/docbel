import { prisma } from "@/lib/prisma";

export function normalizeDomain(input: string): string {
  return input.trim().toLowerCase().replace(/^@/, "");
}

export function extractDomainFromEmail(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return null;
  return trimmed.slice(at + 1);
}

export async function isEmailAuthorized(email: string): Promise<{
  authorized: boolean;
  organizationName?: string;
  isTest?: boolean;
}> {
  const domain = extractDomainFromEmail(email);
  if (!domain) return { authorized: false };

  const match = await prisma.partnerDomain.findFirst({
    where: { domain, isActive: true },
    select: { organizationName: true, isTest: true },
  });

  if (!match) return { authorized: false };
  return {
    authorized: true,
    organizationName: match.organizationName,
    isTest: match.isTest,
  };
}

export async function listPartnerDomains() {
  return prisma.partnerDomain.findMany({
    orderBy: [{ isActive: "desc" }, { domain: "asc" }],
  });
}

export interface PartnerOrganizationGroup {
  organizationName: string;
  domains: Array<{
    id: string;
    domain: string;
    notes: string | null;
    isTest: boolean;
    isActive: boolean;
    createdAt: Date;
  }>;
  users: Array<{
    id: string;
    name: string;
    email: string;
    status: string;
    emailVerified: boolean;
    createdAt: Date;
    lastLoginAt: Date | null;
  }>;
  isActive: boolean;
  hasTestDomain: boolean;
  domainCount: number;
  userCount: number;
}

export async function listOrganizations(): Promise<PartnerOrganizationGroup[]> {
  const [domains, users] = await Promise.all([
    prisma.partnerDomain.findMany({
      orderBy: [{ isActive: "desc" }, { domain: "asc" }],
    }),
    prisma.user.findMany({
      where: { role: "partner" },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        emailVerified: true,
        createdAt: true,
        lastLoginAt: true,
        partnerOrganization: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const groups = new Map<string, PartnerOrganizationGroup>();

  for (const d of domains) {
    const key = d.organizationName;
    if (!groups.has(key)) {
      groups.set(key, {
        organizationName: key,
        domains: [],
        users: [],
        isActive: false,
        hasTestDomain: false,
        domainCount: 0,
        userCount: 0,
      });
    }
    const group = groups.get(key)!;
    group.domains.push({
      id: d.id,
      domain: d.domain,
      notes: d.notes,
      isTest: d.isTest,
      isActive: d.isActive,
      createdAt: d.createdAt,
    });
    group.isActive = group.isActive || d.isActive;
    group.hasTestDomain = group.hasTestDomain || d.isTest;
    group.domainCount = group.domains.length;
  }

  for (const u of users) {
    if (!u.partnerOrganization) continue;
    const group = groups.get(u.partnerOrganization);
    if (!group) continue;
    group.users.push({
      id: u.id,
      name: u.name,
      email: u.email,
      status: u.status,
      emailVerified: u.emailVerified,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
    });
    group.userCount = group.users.length;
  }

  return Array.from(groups.values()).sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return a.organizationName.localeCompare(b.organizationName);
  });
}

export async function listExistingOrganizationNames(): Promise<string[]> {
  const rows = await prisma.partnerDomain.findMany({
    select: { organizationName: true },
    distinct: ["organizationName"],
    orderBy: { organizationName: "asc" },
  });
  return rows.map((r) => r.organizationName);
}

export async function createPartnerDomain(input: {
  domain: string;
  organizationName: string;
  notes?: string | null;
  isTest?: boolean;
  createdBy?: string | null;
}) {
  return prisma.partnerDomain.create({
    data: {
      domain: normalizeDomain(input.domain),
      organizationName: input.organizationName.trim(),
      notes: input.notes?.trim() || null,
      isTest: input.isTest ?? false,
      isActive: true,
      createdBy: input.createdBy ?? null,
    },
  });
}

export async function updatePartnerDomain(
  id: string,
  input: {
    domain?: string;
    organizationName?: string;
    notes?: string | null;
    isTest?: boolean;
    isActive?: boolean;
  },
) {
  return prisma.partnerDomain.update({
    where: { id },
    data: {
      domain:
        input.domain === undefined ? undefined : normalizeDomain(input.domain),
      organizationName: input.organizationName?.trim(),
      notes:
        input.notes === undefined
          ? undefined
          : input.notes?.trim() || null,
      isTest: input.isTest,
      isActive: input.isActive,
    },
  });
}

export async function deletePartnerDomain(id: string) {
  return prisma.partnerDomain.delete({ where: { id } });
}
