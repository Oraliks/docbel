/// Agrégats server-side de la fiche 360° d'un utilisateur (admin). Une passe
/// groupée (Promise.all de counts bornés), tout via withDbRetry (Neon cold
/// start). Aucune donnée sensible en clair (pas de password, pas de NRN
/// déchiffré). Étendu par lots : loadUser360 (Aperçu, Lot 3), loadUserSecurity
/// (Lot 4), loadUserActivity / loadUserProfileDetail (Lot 6).

import { prisma, withDbRetry } from "@/lib/prisma"
import type { UserRole, UserStatus } from "@prisma/client"

export interface User360Scalars {
  id: string
  name: string
  email: string
  image: string | null
  role: UserRole
  status: UserStatus
  segment: string | null
  partnerType: string | null
  partnerOrganization: string | null
  vatNumber: string | null
  isOrgManager: boolean
  canViewRdvHistory: boolean
  emailVerified: boolean
  emailVerifiedAt: string | null
  lastLoginAt: string | null
  passwordChangedAt: string | null
  failedLoginAttempts: number
  lockedUntil: string | null
  banned: boolean
  banReason: string | null
  banExpires: string | null
  createdAt: string
  updatedAt: string
}

export interface User360Counts {
  activeSessions: number
  dossiers: number
  drafts: number
  bookings: number
  costSimulations: number
  documentDrafts: number
  impersonationsAsTarget: number
  impersonationsAsAdmin: number
}

export interface User360 {
  user: User360Scalars
  counts: User360Counts
  hasProfile: boolean
  hasEmployerProfile: boolean
}

const iso = (d: Date | null | undefined): string | null =>
  d ? d.toISOString() : null

/// Charge les scalaires + compteurs de la fiche. `null` si l'utilisateur
/// n'existe pas (la page appelle notFound()).
export async function loadUser360(userId: string): Promise<User360 | null> {
  const now = new Date()

  const user = await withDbRetry(() =>
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        status: true,
        segment: true,
        partnerType: true,
        partnerOrganization: true,
        vatNumber: true,
        isOrgManager: true,
        canViewRdvHistory: true,
        emailVerified: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        passwordChangedAt: true,
        failedLoginAttempts: true,
        lockedUntil: true,
        banned: true,
        banReason: true,
        banExpires: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ).catch(() => null)

  if (!user) return null

  const [
    activeSessions,
    dossiers,
    drafts,
    bookings,
    costSimulations,
    documentDrafts,
    impersonationsAsTarget,
    impersonationsAsAdmin,
    hasProfile,
    hasEmployerProfile,
  ] = await Promise.all([
    withDbRetry(() =>
      prisma.session.count({
        where: { userId, expiresAt: { gt: now } },
      }),
    ),
    withDbRetry(() => prisma.bundleRun.count({ where: { userId } })),
    withDbRetry(() => prisma.pdfFormDraft.count({ where: { userId } })),
    withDbRetry(() => prisma.booking.count({ where: { userId } })),
    withDbRetry(() => prisma.costSimulation.count({ where: { userId } })),
    withDbRetry(() => prisma.documentDraft.count({ where: { userId } })),
    withDbRetry(() =>
      prisma.adminImpersonationLog.count({ where: { targetId: userId } }),
    ),
    withDbRetry(() =>
      prisma.adminImpersonationLog.count({ where: { adminId: userId } }),
    ),
    withDbRetry(() =>
      prisma.userProfile.count({ where: { userId } }),
    ).then((n) => n > 0),
    withDbRetry(() =>
      prisma.employerProfile.count({ where: { userId } }),
    ).then((n) => n > 0),
  ])

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: user.role,
      status: user.status,
      segment: user.segment,
      partnerType: user.partnerType,
      partnerOrganization: user.partnerOrganization,
      vatNumber: user.vatNumber,
      isOrgManager: user.isOrgManager,
      canViewRdvHistory: user.canViewRdvHistory,
      emailVerified: user.emailVerified,
      emailVerifiedAt: iso(user.emailVerifiedAt),
      lastLoginAt: iso(user.lastLoginAt),
      passwordChangedAt: iso(user.passwordChangedAt),
      failedLoginAttempts: user.failedLoginAttempts,
      lockedUntil: iso(user.lockedUntil),
      banned: user.banned,
      banReason: user.banReason,
      banExpires: iso(user.banExpires),
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    },
    counts: {
      activeSessions,
      dossiers,
      drafts,
      bookings,
      costSimulations,
      documentDrafts,
      impersonationsAsTarget,
      impersonationsAsAdmin,
    },
    hasProfile,
    hasEmployerProfile,
  }
}

// ── Sécurité (Lot 4) ─────────────────────────────────────────────────────

export interface UserSessionRow {
  id: string
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
  expiresAt: string
  /// Non-null = session ouverte par un admin en impersonation.
  impersonatedBy: string | null
}

export interface ImpersonationLogRow {
  id: string
  /// Contrepartie affichée : l'admin (pour les impersonations subies) ou la
  /// cible (pour les impersonations menées).
  counterpartName: string | null
  counterpartEmail: string | null
  startedAt: string
  stoppedAt: string | null
  reason: string | null
  ipAddress: string | null
}

export interface UserSecurity {
  activeSessions: UserSessionRow[]
  /// Sessions expirées récentes (contexte), bornées.
  expiredSessionsCount: number
  /// Impersonations dont ce compte a été la CIBLE (qui l'a vu "en tant que").
  impersonationsReceived: ImpersonationLogRow[]
  /// Impersonations que ce compte (admin) a MENÉES sur d'autres.
  impersonationsMade: ImpersonationLogRow[]
}

/// Données de l'onglet Sécurité : sessions actives + historique d'impersonation.
/// Listes bornées (take), aucune donnée sensible (jamais le token de session).
export async function loadUserSecurity(userId: string): Promise<UserSecurity> {
  const now = new Date()

  const [activeSessions, expiredSessionsCount, received, made] =
    await Promise.all([
      withDbRetry(() =>
        prisma.session.findMany({
          where: { userId, expiresAt: { gt: now } },
          select: {
            id: true,
            ipAddress: true,
            userAgent: true,
            createdAt: true,
            expiresAt: true,
            impersonatedBy: true,
          },
          orderBy: { createdAt: "desc" },
          take: 25,
        }),
      ),
      withDbRetry(() =>
        prisma.session.count({ where: { userId, expiresAt: { lte: now } } }),
      ),
      withDbRetry(() =>
        prisma.adminImpersonationLog.findMany({
          where: { targetId: userId },
          select: {
            id: true,
            startedAt: true,
            stoppedAt: true,
            reason: true,
            ipAddress: true,
            admin: { select: { name: true, email: true } },
          },
          orderBy: { startedAt: "desc" },
          take: 10,
        }),
      ),
      withDbRetry(() =>
        prisma.adminImpersonationLog.findMany({
          where: { adminId: userId },
          select: {
            id: true,
            startedAt: true,
            stoppedAt: true,
            reason: true,
            ipAddress: true,
            target: { select: { name: true, email: true } },
          },
          orderBy: { startedAt: "desc" },
          take: 10,
        }),
      ),
    ])

  return {
    activeSessions: activeSessions.map((s) => ({
      id: s.id,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      createdAt: s.createdAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
      impersonatedBy: s.impersonatedBy,
    })),
    expiredSessionsCount,
    impersonationsReceived: received.map((l) => ({
      id: l.id,
      counterpartName: l.admin?.name ?? null,
      counterpartEmail: l.admin?.email ?? null,
      startedAt: l.startedAt.toISOString(),
      stoppedAt: l.stoppedAt ? l.stoppedAt.toISOString() : null,
      reason: l.reason,
      ipAddress: l.ipAddress,
    })),
    impersonationsMade: made.map((l) => ({
      id: l.id,
      counterpartName: l.target?.name ?? null,
      counterpartEmail: l.target?.email ?? null,
      startedAt: l.startedAt.toISOString(),
      stoppedAt: l.stoppedAt ? l.stoppedAt.toISOString() : null,
      reason: l.reason,
      ipAddress: l.ipAddress,
    })),
  }
}

// ── Profil (Lot 6) ─────────────────────────────────────────────────────────

export interface CitizenProfileDetail {
  firstName: string | null
  lastName: string | null
  /// NISS masqué : seuls les 4 derniers chiffres (RGPD — pas de NRN en clair).
  nissLast4: string | null
  birthDate: string | null
  birthPlace: string | null
  nationality: string | null
  gender: string | null
  street: string | null
  streetNum: string | null
  postalCode: string | null
  city: string | null
  country: string
  phone: string | null
  mobilePhone: string | null
  /// IBAN masqué (4 derniers).
  ibanMasked: string | null
  maritalStatus: string | null
  householdMembersCount: number
  employer: string | null
  jobTitle: string | null
  contractType: string | null
  organismePaiement: string | null
  mutuelleCode: string | null
  commissionParitaireCode: string | null
  updatedAt: string
}

export interface EmployerProfileSummary {
  organisationName: string | null
  legalForm: string | null
  enterpriseNumber: string | null
  region: string | null
  sector: string | null
  naceCode: string | null
  jointCommitteeNumber: string | null
  hasEmployees: boolean | null
  scenarioCount: number
}

export interface UserProfileData {
  citizen: CitizenProfileDetail | null
  employer: EmployerProfileSummary | null
}

const maskTail = (value: string | null, keep = 4): string | null => {
  if (!value) return null
  const trimmed = value.replace(/\s+/g, "")
  if (trimmed.length <= keep) return trimmed
  return `•••• ${trimmed.slice(-keep)}`
}

/// Détail des profils rattachés (citoyen UserProfile + employeur
/// EmployerProfile). Données sensibles masquées (NISS/IBAN → 4 derniers).
export async function loadUserProfileDetail(
  userId: string,
): Promise<UserProfileData> {
  const [profile, employer] = await Promise.all([
    withDbRetry(() =>
      prisma.userProfile.findUnique({ where: { userId } }),
    ).catch(() => null),
    withDbRetry(() =>
      prisma.employerProfile.findFirst({
        where: { userId },
        include: { _count: { select: { scenarios: true } } },
      }),
    ).catch(() => null),
  ])

  const citizen: CitizenProfileDetail | null = profile
    ? {
        firstName: profile.firstName,
        lastName: profile.lastName,
        nissLast4: profile.niss ? profile.niss.replace(/\D/g, "").slice(-4) : null,
        birthDate: profile.birthDate ? profile.birthDate.toISOString() : null,
        birthPlace: profile.birthPlace,
        nationality: profile.nationality,
        gender: profile.gender,
        street: profile.street,
        streetNum: profile.streetNum,
        postalCode: profile.postalCode,
        city: profile.city,
        country: profile.country,
        phone: profile.phone,
        mobilePhone: profile.mobilePhone,
        ibanMasked: maskTail(profile.iban),
        maritalStatus: profile.maritalStatus,
        householdMembersCount: Array.isArray(profile.householdMembers)
          ? profile.householdMembers.length
          : 0,
        employer: profile.employer,
        jobTitle: profile.jobTitle,
        contractType: profile.contractType,
        organismePaiement: profile.organismePaiement,
        mutuelleCode: profile.mutuelleCode,
        commissionParitaireCode: profile.commissionParitaireCode,
        updatedAt: profile.updatedAt.toISOString(),
      }
    : null

  const employerSummary: EmployerProfileSummary | null = employer
    ? {
        organisationName: employer.organisationName,
        legalForm: employer.legalForm,
        enterpriseNumber: employer.enterpriseNumber,
        region: employer.region,
        sector: employer.sector,
        naceCode: employer.naceCode,
        jointCommitteeNumber: employer.jointCommitteeNumber,
        hasEmployees: employer.hasEmployees,
        scenarioCount: employer._count.scenarios,
      }
    : null

  return { citizen, employer: employerSummary }
}

// ── Activité (Lot 6) ─────────────────────────────────────────────────────────

export interface ActivityRun {
  id: string
  bundleName: string
  bundleSlug: string
  status: string
  startedAt: string
  updatedAt: string
  completedAt: string | null
}

export interface ActivityDraft {
  id: string
  formTitle: string
  formSlug: string
  updatedAt: string
}

export interface ActivityBooking {
  id: string
  tenantName: string
  date: string
  startTime: string
  status: string
}

export interface UserActivity {
  runs: ActivityRun[]
  drafts: ActivityDraft[]
  bookings: ActivityBooking[]
  totals: { runs: number; drafts: number; bookings: number }
}

/// Activité récente du compte (dossiers, brouillons PDF, RDV). Listes bornées
/// (10 dernières) + total, pas de pagination dans la fiche.
export async function loadUserActivity(userId: string): Promise<UserActivity> {
  const [runs, drafts, bookings, runsTotal, draftsTotal, bookingsTotal] =
    await Promise.all([
      withDbRetry(() =>
        prisma.bundleRun.findMany({
          where: { userId },
          select: {
            id: true,
            status: true,
            startedAt: true,
            updatedAt: true,
            completedAt: true,
            bundle: { select: { name: true, slug: true } },
          },
          orderBy: { startedAt: "desc" },
          take: 10,
        }),
      ),
      withDbRetry(() =>
        prisma.pdfFormDraft.findMany({
          where: { userId },
          select: {
            id: true,
            updatedAt: true,
            form: { select: { title: true, slug: true } },
          },
          orderBy: { updatedAt: "desc" },
          take: 10,
        }),
      ),
      withDbRetry(() =>
        prisma.booking.findMany({
          where: { userId },
          select: {
            id: true,
            date: true,
            startTime: true,
            status: true,
            tenant: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        }),
      ),
      withDbRetry(() => prisma.bundleRun.count({ where: { userId } })),
      withDbRetry(() => prisma.pdfFormDraft.count({ where: { userId } })),
      withDbRetry(() => prisma.booking.count({ where: { userId } })),
    ])

  return {
    runs: runs.map((r) => ({
      id: r.id,
      bundleName: r.bundle?.name ?? "Dossier",
      bundleSlug: r.bundle?.slug ?? "",
      status: r.status,
      startedAt: r.startedAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      completedAt: r.completedAt ? r.completedAt.toISOString() : null,
    })),
    drafts: drafts.map((d) => ({
      id: d.id,
      formTitle: d.form?.title ?? "Formulaire",
      formSlug: d.form?.slug ?? "",
      updatedAt: d.updatedAt.toISOString(),
    })),
    bookings: bookings.map((b) => ({
      id: b.id,
      tenantName: b.tenant?.name ?? "—",
      date: b.date,
      startTime: b.startTime,
      status: String(b.status),
    })),
    totals: { runs: runsTotal, drafts: draftsTotal, bookings: bookingsTotal },
  }
}

/// Vrai si le verrouillage anti-bruteforce est actif à l'instant présent.
export function isLockActive(lockedUntil: string | null): boolean {
  if (!lockedUntil) return false
  return new Date(lockedUntil).getTime() > Date.now()
}

/// Vrai si le bannissement est actif (permanent ou non encore expiré).
export function isBanActive(
  banned: boolean,
  banExpires: string | null,
): boolean {
  if (!banned) return false
  if (!banExpires) return true
  return new Date(banExpires).getTime() > Date.now()
}
