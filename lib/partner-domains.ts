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
  segment?: string;
  partnerType?: string | null;
}> {
  const normalized = email.trim().toLowerCase();
  const domain = extractDomainFromEmail(normalized);

  // Priorité à une autorisation par EMAIL exact (entrées kind="email", ex. privé
  // en gmail/hotmail), sinon par DOMAINE (entrées kind="domain", ex. @cpas.be).
  const match = await prisma.partnerDomain.findFirst({
    where: {
      isActive: true,
      OR: [{ email: normalized }, ...(domain ? [{ domain }] : [])],
    },
    // email non-null d'abord → l'entrée email exacte gagne sur l'entrée domaine.
    orderBy: { email: { sort: "desc", nulls: "last" } },
    select: {
      organizationName: true,
      isTest: true,
      segment: true,
      partnerType: true,
    },
  });

  if (!match) return { authorized: false };
  return {
    authorized: true,
    organizationName: match.organizationName,
    isTest: match.isTest,
    segment: match.segment,
    partnerType: match.partnerType,
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
    kind: string;
    domain: string | null;
    email: string | null;
    segment: string;
    partnerType: string | null;
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
    isOrgManager: boolean;
    canViewRdvHistory: boolean;
  }>;
  isActive: boolean;
  hasTestDomain: boolean;
  domainCount: number;
  userCount: number;
}

/**
 * Liste les organisations (groupées par organizationName) avec leurs entrées
 * d'allowlist + utilisateurs rattachés.
 *
 * @param segment  Optionnel. Si fourni ("partenaire" | "employeur") :
 *   - filtre les entrées d'allowlist (`PartnerDomain.segment`) sur ce segment ;
 *   - filtre les utilisateurs sur le rôle correspondant
 *     (partenaire → role "partner", employeur → role "employer").
 *   Sans paramètre = comportement historique : toutes les entrées + les users
 *   de rôle "partner".
 */
export async function listOrganizations(
  segment?: "partenaire" | "employeur",
): Promise<PartnerOrganizationGroup[]> {
  // Rôle user attendu pour ce segment (partenaire↔partner, employeur↔employer).
  const userRole =
    segment === "employeur" ? "employer" : segment === "partenaire" ? "partner" : "partner";

  const [domains, users] = await Promise.all([
    prisma.partnerDomain.findMany({
      where: segment ? { segment } : undefined,
      orderBy: [{ isActive: "desc" }, { domain: "asc" }],
    }),
    prisma.user.findMany({
      where: { role: userRole },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        emailVerified: true,
        createdAt: true,
        lastLoginAt: true,
        partnerOrganization: true,
        isOrgManager: true,
        canViewRdvHistory: true,
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
      kind: d.kind,
      domain: d.domain,
      email: d.email,
      segment: d.segment,
      partnerType: d.partnerType,
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
      isOrgManager: u.isOrgManager,
      canViewRdvHistory: u.canViewRdvHistory,
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
  kind?: string; // "domain" | "email" — défaut "domain"
  domain?: string | null;
  email?: string | null;
  segment?: string; // "employeur" | "partenaire" — défaut "partenaire"
  partnerType?: string | null;
  organizationName: string;
  notes?: string | null;
  isTest?: boolean;
  createdBy?: string | null;
}) {
  const kind = input.kind === "email" ? "email" : "domain";
  return prisma.partnerDomain.create({
    data: {
      kind,
      domain: kind === "domain" ? normalizeDomain(input.domain ?? "") : null,
      email: kind === "email" ? (input.email ?? "").trim().toLowerCase() : null,
      segment: input.segment === "employeur" ? "employeur" : "partenaire",
      partnerType: input.partnerType ?? null,
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
    kind?: string;
    domain?: string | null;
    email?: string | null;
    segment?: string;
    partnerType?: string | null;
    organizationName?: string;
    notes?: string | null;
    isTest?: boolean;
    isActive?: boolean;
  },
) {
  return prisma.partnerDomain.update({
    where: { id },
    data: {
      kind: input.kind,
      domain:
        input.domain === undefined
          ? undefined
          : input.domain
            ? normalizeDomain(input.domain)
            : null,
      email:
        input.email === undefined
          ? undefined
          : input.email
            ? input.email.trim().toLowerCase()
            : null,
      segment: input.segment,
      partnerType: input.partnerType,
      organizationName: input.organizationName?.trim(),
      notes:
        input.notes === undefined ? undefined : input.notes?.trim() || null,
      isTest: input.isTest,
      isActive: input.isActive,
    },
  });
}

export async function deletePartnerDomain(id: string) {
  return prisma.partnerDomain.delete({ where: { id } });
}
