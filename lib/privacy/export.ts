import { prisma } from "@/lib/prisma"

export const PRIVACY_EXPORT_DATASETS = [
  "account",
  "profile",
  "sessions",
  "auth_accounts",
  "bundle_runs",
  "pdf_drafts",
  "bookings",
  "employer_profiles",
  "cost_simulations",
  "document_drafts",
  "training_enrollments",
  "training_saved",
  "orientation_results",
  "training_reviews",
] as const

export type PrivacyExportDataset = (typeof PRIVACY_EXPORT_DATASETS)[number]

export const PRIVACY_EXPORT_MAX_PAGE_SIZE = 100

const FORBIDDEN_EXPORT_KEYS = new Set([
  "password",
  "token",
  "accessToken",
  "refreshToken",
  "idToken",
  "confirmationToken",
  "notifyToken",
  "resumeCode",
  "resumeCodeHash",
  "citizenNrnHash",
  "citizenNrnEnc",
  "ipHash",
  "internalNote",
  "adminNote",
  "organizationNote",
])

type ExportRow = { id?: string; userId?: string; [key: string]: unknown }

export interface PrivacyExportPage {
  dataset: PrivacyExportDataset
  records: ExportRow[]
  nextCursor: string | null
  limit: number
}

function cursorArgs(cursor: string | undefined): { cursor?: { id: string }; skip?: number } {
  return cursor ? { cursor: { id: cursor }, skip: 1 } : {}
}

function finishPage(
  dataset: PrivacyExportDataset,
  rows: ExportRow[],
  limit: number,
): PrivacyExportPage {
  const hasMore = rows.length > limit
  const records = hasMore ? rows.slice(0, limit) : rows
  assertNoForbiddenExportKeys(records)
  const last = records.at(-1)
  return {
    dataset,
    records,
    nextCursor: hasMore ? (last?.id ?? last?.userId ?? null) : null,
    limit,
  }
}

export function assertNoForbiddenExportKeys(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) assertNoForbiddenExportKeys(item)
    return
  }
  if (!value || typeof value !== "object" || value instanceof Date) return
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_EXPORT_KEYS.has(key)) {
      throw new Error(`Forbidden privacy export key: ${key}`)
    }
    assertNoForbiddenExportKeys(nested)
  }
}

/**
 * Export paginé d'un seul jeu de données. Chaque requête est scellée par userId
 * et utilise une liste blanche Prisma ; aucune recherche par email ou texte libre.
 */
export async function exportPrivacyDataset(input: {
  userId: string
  dataset: PrivacyExportDataset
  cursor?: string
  limit: number
}): Promise<PrivacyExportPage> {
  const limit = Math.min(Math.max(1, input.limit), PRIVACY_EXPORT_MAX_PAGE_SIZE)
  const take = limit + 1
  let rows: ExportRow[]

  switch (input.dataset) {
    case "account":
      rows = await prisma.user.findMany({
        where: { id: input.userId },
        select: {
          id: true, name: true, email: true, emailVerified: true, image: true,
          role: true, status: true, emailVerifiedAt: true, lastLoginAt: true,
          partnerOrganization: true, segment: true, partnerType: true, vatNumber: true,
          isOrgManager: true, canViewRdvHistory: true, createdAt: true, updatedAt: true,
        },
        orderBy: { id: "asc" }, take, ...cursorArgs(input.cursor),
      })
      break
    case "profile":
      rows = await prisma.userProfile.findMany({
        where: { userId: input.userId },
        select: {
          userId: true, firstName: true, lastName: true, niss: true, birthDate: true,
          birthPlace: true, nationality: true, gender: true, street: true, streetNum: true,
          postalCode: true, city: true, country: true, phone: true, mobilePhone: true,
          iban: true, bic: true, maritalStatus: true, householdMembers: true,
          employer: true, employerBce: true, jobTitle: true, contractType: true,
          contractStart: true, organismePaiement: true, commissionParitaireCode: true,
          mutuelleCode: true, createdAt: true, updatedAt: true,
        },
        orderBy: { userId: "asc" }, take,
      })
      break
    case "sessions":
      rows = await prisma.session.findMany({
        where: { userId: input.userId },
        select: { id: true, expiresAt: true, ipAddress: true, userAgent: true, createdAt: true, updatedAt: true },
        orderBy: { id: "asc" }, take, ...cursorArgs(input.cursor),
      })
      break
    case "auth_accounts":
      rows = await prisma.account.findMany({
        where: { userId: input.userId },
        select: {
          id: true, accountId: true, providerId: true, scope: true,
          accessTokenExpiresAt: true, refreshTokenExpiresAt: true, createdAt: true, updatedAt: true,
        },
        orderBy: { id: "asc" }, take, ...cursorArgs(input.cursor),
      })
      break
    case "bundle_runs":
      rows = await prisma.bundleRun.findMany({
        where: { userId: input.userId },
        select: {
          id: true, bundleId: true, resumeCodeExpiresAt: true, resumeEmail: true,
          payloads: true, eligibilityAnswers: true, completedTemplateIds: true,
          status: true, startedAt: true, updatedAt: true, completedAt: true,
          anonymizedAt: true, orientationAnswers: true, lastFormId: true,
          lastStepId: true, lastActiveField: true, draftPayloads: true,
          regulatoryDecisionSnapshot: true,
        },
        orderBy: { id: "asc" }, take, ...cursorArgs(input.cursor),
      })
      break
    case "pdf_drafts":
      rows = await prisma.pdfFormDraft.findMany({
        where: { userId: input.userId },
        select: { id: true, formId: true, payload: true, expiresAt: true, createdAt: true, updatedAt: true },
        orderBy: { id: "asc" }, take, ...cursorArgs(input.cursor),
      })
      break
    case "bookings":
      rows = await prisma.booking.findMany({
        where: { userId: input.userId },
        select: {
          id: true, tenantId: true, locationId: true, date: true, startTime: true,
          endTime: true, serviceCode: true, formData: true, citizenName: true,
          citizenEmail: true, citizenPhone: true, citizenNrnLast4: true,
          citizenPostalCode: true, citizenCommuneId: true, status: true,
          autoApproved: true, confirmedAt: true, approvedAt: true, rejectionReason: true,
          cancelReason: true, cancelledAt: true, reminderSentAt: true,
          noShowFollowupSentAt: true, presenceConfirmedAt: true, verifiedAt: true,
          locale: true, createdAt: true, updatedAt: true,
        },
        orderBy: { id: "asc" }, take, ...cursorArgs(input.cursor),
      })
      break
    case "employer_profiles":
      rows = await prisma.employerProfile.findMany({
        where: { userId: input.userId },
        select: {
          id: true, organisationName: true, legalForm: true, enterpriseNumber: true,
          hasEmployees: true, hasOnssNumber: true, onssNumber: true, region: true,
          sector: true, naceCode: true, jointCommitteeKnown: true,
          jointCommitteeNumber: true, createdAt: true, updatedAt: true,
        },
        orderBy: { id: "asc" }, take, ...cursorArgs(input.cursor),
      })
      break
    case "cost_simulations":
      rows = await prisma.costSimulation.findMany({
        where: { userId: input.userId },
        select: {
          id: true, scenarioId: true, title: true, inputs: true, grossMonthlySalary: true,
          estimatedEmployerContributions: true, estimatedMonthlyEmployerCost: true,
          estimatedAnnualEmployerCost: true, estimatedNetSalary: true, assumptions: true,
          missingData: true, reliability: true, warnings: true, createdAt: true, updatedAt: true,
        },
        orderBy: { id: "asc" }, take, ...cursorArgs(input.cursor),
      })
      break
    case "document_drafts":
      rows = await prisma.documentDraft.findMany({
        where: { userId: input.userId },
        select: { id: true, scenarioId: true, type: true, title: true, content: true, status: true, createdAt: true, updatedAt: true },
        orderBy: { id: "asc" }, take, ...cursorArgs(input.cursor),
      })
      break
    case "training_enrollments":
      rows = await prisma.trainingEnrollment.findMany({
        where: { userId: input.userId },
        select: {
          id: true, sessionId: true, trainingId: true, organizationId: true,
          citizenName: true, citizenEmail: true, citizenPhone: true, status: true,
          message: true, motivation: true, paymentStatus: true, paymentReference: true,
          certificateId: true, locale: true, requestedAt: true, acceptedAt: true,
          refusedAt: true, cancelledAt: true, completedAt: true, attendanceMarkedAt: true,
          certificateUrl: true, createdAt: true, updatedAt: true,
        },
        orderBy: { id: "asc" }, take, ...cursorArgs(input.cursor),
      })
      break
    case "training_saved":
      rows = await prisma.trainingSaved.findMany({
        where: { userId: input.userId },
        select: { id: true, trainingId: true, createdAt: true },
        orderBy: { id: "asc" }, take, ...cursorArgs(input.cursor),
      })
      break
    case "orientation_results":
      rows = await prisma.orientationResult.findMany({
        where: { userId: input.userId },
        select: {
          id: true, primaryBranchId: true, secondaryBranchIds: true, scoresJson: true,
          answersJson: true, confidenceScore: true, summary: true, saved: true,
          createdAt: true, updatedAt: true,
        },
        orderBy: { id: "asc" }, take, ...cursorArgs(input.cursor),
      })
      break
    case "training_reviews":
      rows = await prisma.trainingReview.findMany({
        where: { userId: input.userId },
        select: {
          id: true, trainingId: true, sessionId: true, enrollmentId: true,
          rating: true, clarityRating: true, usefulnessRating: true,
          organizationRating: true, comment: true, isPublic: true,
          isVerified: true, status: true, createdAt: true, updatedAt: true,
        },
        orderBy: { id: "asc" }, take, ...cursorArgs(input.cursor),
      })
      break
  }

  return finishPage(input.dataset, rows, limit)
}
