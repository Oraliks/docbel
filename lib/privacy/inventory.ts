import { createHash } from "node:crypto"
import { prisma } from "@/lib/prisma"
import {
  PRIVACY_INVENTORY_VERSION,
  type PrivacyDeletionPreview,
  type PrivacyInventory,
  type PrivacyInventoryEntry,
  type PrivacySubjectSummary,
  type PrivacyTechnicalAction,
} from "./types"

type EntryDefinition = Omit<PrivacyInventoryEntry, "count">

function entry(
  source: string,
  relation: string,
  relationKind: EntryDefinition["relationKind"],
  technicalAction: PrivacyTechnicalAction,
  reason: string,
  exportDataset: string | null = null,
): EntryDefinition {
  return {
    source,
    relation,
    relationKind,
    technicalAction,
    policyStatus: technicalAction === "retain_shared" || technicalAction === "review"
      ? "review_required"
      : "unapproved",
    exportDataset,
    reason,
  }
}

async function loadSubject(userId: string): Promise<PrivacySubjectSummary | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  })
  if (!user) return null
  return {
    ...user,
    role: String(user.role),
    status: String(user.status),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  }
}

/**
 * Inventaire par références exactes (ID du compte) et, séparément, par email exact.
 * Les correspondances en JSON/texte libre ne sont volontairement jamais inférées.
 */
export async function buildPrivacyInventory(userId: string): Promise<PrivacyInventory | null> {
  const subject = await loadSubject(userId)
  if (!subject) return null

  const definitions: EntryDefinition[] = [
    entry("User", "id", "subject", "delete_candidate", "Compte racine ; mot de passe et état de sécurité ne sont jamais exportés.", "account"),
    entry("UserProfile", "userId", "subject", "delete_candidate", "Profil exclusivement rattaché au compte.", "profile"),
    entry("Session", "userId", "subject", "delete_candidate", "Sessions du compte ; les tokens sont exclus de l'export.", "sessions"),
    entry("Session", "impersonatedBy", "actor", "review", "Sessions créées pendant une impersonation ; preuve de sécurité à qualifier."),
    entry("Account", "userId", "subject", "delete_candidate", "Comptes d'authentification ; aucun token ni secret n'est exporté.", "auth_accounts"),
    entry("AdminImpersonationLog", "adminId", "actor", "review", "Journal de sécurité où le compte est administrateur."),
    entry("AdminImpersonationLog", "targetId", "subject", "review", "Journal de sécurité où le compte est la cible."),
    entry("BundleRun", "userId", "subject", "anonymize_candidate", "Dossier personnel ; les pseudonymes et la rétention doivent rester cohérents.", "bundle_runs"),
    entry("BundleAnalyticsEvent", "userId", "subject", "anonymize_candidate", "Événement pseudonyme directement lié au compte."),
    entry("PdfFormDraft", "userId", "subject", "delete_candidate", "Brouillon exclusivement rattaché au compte.", "pdf_drafts"),
    entry("PdfFormSubmissionLog", "userId", "subject", "review", "Trace d'intégrité/anti-abus ; durée de conservation à valider."),
    entry("Booking", "userId", "subject", "detach_candidate", "Réservation détenue avec un organisme ; notes et preuves peuvent appartenir à un tiers.", "bookings"),
    entry("Booking", "approvedById/rejectedById/assignedToUserId", "actor", "retain_shared", "Action professionnelle sur une réservation tierce."),
    entry("BookingWaitlist", "userId", "subject", "detach_candidate", "Liste d'attente partagée avec un organisme ; rétention non validée."),
    entry("BookingTenantMember", "userId", "actor", "retain_shared", "Adhésion à un tenant partagé ; le tenant ne doit pas être supprimé."),
    entry("BookingSlotRule", "createdById", "actor", "retain_shared", "Règle de planning partagée."),
    entry("BookingException", "createdById", "actor", "retain_shared", "Exception de planning partagée."),
    entry("RendezVousHistory", "createdById", "actor", "retain_shared", "Historique d'organisation contenant potentiellement des tiers."),
    entry("EmployerProfile", "userId", "subject", "delete_candidate", "Profil employeur exclusivement rattaché au compte.", "employer_profiles"),
    entry("WorkerScenario", "EmployerProfile.userId", "subject", "delete_candidate", "Scénario enfant du profil employeur."),
    entry("EmployerChecklist", "WorkerScenario.EmployerProfile.userId", "subject", "delete_candidate", "Checklist enfant d'un scénario employeur."),
    entry("ChecklistItem", "EmployerChecklist.WorkerScenario.EmployerProfile.userId", "subject", "delete_candidate", "Élément enfant d'une checklist employeur."),
    entry("CostSimulation", "userId", "subject", "delete_candidate", "Simulation exclusivement rattachée au compte.", "cost_simulations"),
    entry("DocumentDraft", "userId", "subject", "delete_candidate", "Document brouillon exclusivement rattaché au compte.", "document_drafts"),
    entry("FormationOrgMember", "userId", "actor", "retain_shared", "Adhésion à une organisation partagée."),
    entry("FormationOrgInvite", "invitedById/acceptedByUserId", "actor", "review", "Invitation impliquant d'autres personnes et une organisation."),
    entry("FormationOrganization", "createdById/reviewedById", "actor", "retain_shared", "Organisation partagée ; jamais supprimée avec son créateur ou réviseur."),
    entry("OrganizationTrainingPermission", "updatedById", "actor", "retain_shared", "Configuration d'une organisation partagée."),
    entry("Training", "createdById/reviewedById", "actor", "retain_shared", "Contenu de formation partagé."),
    entry("TrainingBadgeOnTraining", "grantedById", "actor", "retain_shared", "Attribution de badge sur un contenu partagé."),
    entry("TrainingSession", "instructorId", "actor", "retain_shared", "Session de formation partagée."),
    entry("TrainingEnrollment", "userId", "subject", "review", "Inscription contenant des données et décisions d'organisation.", "training_enrollments"),
    entry("TrainingEnrollment", "approvedById", "actor", "retain_shared", "Décision sur l'inscription d'un tiers."),
    entry("TrainingSaved", "userId", "subject", "delete_candidate", "Favori exclusivement rattaché au compte.", "training_saved"),
    entry("TrainingAccessRule", "userId", "subject", "review", "Règle d'accès à un contenu partagé."),
    entry("TrainingAccessRule", "createdById", "actor", "retain_shared", "Règle d'accès créée pour un contenu partagé."),
    entry("OrientationResult", "userId", "subject", "delete_candidate", "Résultat d'orientation directement rattaché au compte.", "orientation_results"),
    entry("TrainingCertificate", "userId", "subject", "review", "Attestation susceptible d'une conservation légitime."),
    entry("TrainingNotificationLog", "recipientId", "subject", "review", "Journal de notification ; durée de conservation à valider."),
    entry("TrainingAnalyticsEvent", "userId", "subject", "anonymize_candidate", "Événement analytique pseudonyme."),
    entry("TrainingReview", "userId", "subject", "review", "Avis lié à un contenu partagé.", "training_reviews"),
    entry("TrainingReport", "reporterId/resolvedById", "actor", "review", "Signalement de formation impliquant potentiellement des tiers."),
    entry("KnowledgeSource", "createdById", "actor", "retain_shared", "Corpus partagé ; auteur ne signifie pas propriétaire exclusif."),
    entry("KnowledgeFolder", "createdById", "actor", "retain_shared", "Classement du corpus partagé."),
    entry("ChatSession", "createdById", "actor", "review", "Conversation administrative pouvant citer des tiers."),
    entry("ChatFolder", "createdById", "actor", "review", "Dossier de conversations administratives."),
    entry("GeneratedPrompt", "createdById", "actor", "review", "Contenu généré pouvant citer des tiers."),
    entry("ChatSnippet", "createdById", "actor", "retain_shared", "Snippet partagé."),
    entry("ChatMemory", "createdById", "actor", "retain_shared", "Mémoire partagée susceptible d'être utilisée par d'autres comptes."),
    entry("File", "createdBy", "actor", "retain_shared", "Fichier potentiellement partagé ; usages et blob doivent être revus."),
    entry("Report", "reporterId/resolvedById", "actor", "review", "Signalement ou décision impliquant potentiellement des tiers."),
    entry("Verification", "identifier=email", "indirect_email", "review", "Correspondance email exacte ; valeur de vérification secrète non exportée."),
    entry("NewsletterSubscriber", "email", "indirect_email", "review", "Correspondance email exacte sans preuve automatique de propriété du compte."),
    entry("FormationOrgInvite", "email", "indirect_email", "review", "Invitation reçue par email ; relation organisationnelle à revoir."),
    entry("TrainingAccessRule", "email", "indirect_email", "review", "Accès accordé par email à un contenu partagé."),
    entry("TrainingNotificationLog", "recipientEmail", "indirect_email", "review", "Notification adressée à l'email ; journal à qualifier."),
  ]

  const counts = await Promise.all([
    Promise.resolve(1),
    prisma.userProfile.count({ where: { userId } }),
    prisma.session.count({ where: { userId } }),
    prisma.session.count({ where: { impersonatedBy: userId } }),
    prisma.account.count({ where: { userId } }),
    prisma.adminImpersonationLog.count({ where: { adminId: userId } }),
    prisma.adminImpersonationLog.count({ where: { targetId: userId } }),
    prisma.bundleRun.count({ where: { userId } }),
    prisma.bundleAnalyticsEvent.count({ where: { userId } }),
    prisma.pdfFormDraft.count({ where: { userId } }),
    prisma.pdfFormSubmissionLog.count({ where: { userId } }),
    prisma.booking.count({ where: { userId } }),
    prisma.booking.count({ where: { OR: [{ approvedById: userId }, { rejectedById: userId }, { assignedToUserId: userId }] } }),
    prisma.bookingWaitlist.count({ where: { userId } }),
    prisma.bookingTenantMember.count({ where: { userId } }),
    prisma.bookingSlotRule.count({ where: { createdById: userId } }),
    prisma.bookingException.count({ where: { createdById: userId } }),
    prisma.rendezVousHistory.count({ where: { createdById: userId } }),
    prisma.employerProfile.count({ where: { userId } }),
    prisma.workerScenario.count({ where: { employerProfile: { userId } } }),
    prisma.employerChecklist.count({ where: { scenario: { employerProfile: { userId } } } }),
    prisma.checklistItem.count({ where: { checklist: { scenario: { employerProfile: { userId } } } } }),
    prisma.costSimulation.count({ where: { userId } }),
    prisma.documentDraft.count({ where: { userId } }),
    prisma.formationOrgMember.count({ where: { userId } }),
    prisma.formationOrgInvite.count({ where: { OR: [{ invitedById: userId }, { acceptedByUserId: userId }] } }),
    prisma.formationOrganization.count({ where: { OR: [{ createdById: userId }, { reviewedById: userId }] } }),
    prisma.organizationTrainingPermission.count({ where: { updatedById: userId } }),
    prisma.training.count({ where: { OR: [{ createdById: userId }, { reviewedById: userId }] } }),
    prisma.trainingBadgeOnTraining.count({ where: { grantedById: userId } }),
    prisma.trainingSession.count({ where: { instructorId: userId } }),
    prisma.trainingEnrollment.count({ where: { userId } }),
    prisma.trainingEnrollment.count({ where: { approvedById: userId } }),
    prisma.trainingSaved.count({ where: { userId } }),
    prisma.trainingAccessRule.count({ where: { userId } }),
    prisma.trainingAccessRule.count({ where: { createdById: userId } }),
    prisma.orientationResult.count({ where: { userId } }),
    prisma.trainingCertificate.count({ where: { userId } }),
    prisma.trainingNotificationLog.count({ where: { recipientId: userId } }),
    prisma.trainingAnalyticsEvent.count({ where: { userId } }),
    prisma.trainingReview.count({ where: { userId } }),
    prisma.trainingReport.count({ where: { OR: [{ reporterId: userId }, { resolvedById: userId }] } }),
    prisma.knowledgeSource.count({ where: { createdById: userId } }),
    prisma.knowledgeFolder.count({ where: { createdById: userId } }),
    prisma.chatSession.count({ where: { createdById: userId } }),
    prisma.chatFolder.count({ where: { createdById: userId } }),
    prisma.generatedPrompt.count({ where: { createdById: userId } }),
    prisma.chatSnippet.count({ where: { createdById: userId } }),
    prisma.chatMemory.count({ where: { createdById: userId } }),
    prisma.file.count({ where: { createdBy: userId } }),
    prisma.report.count({ where: { OR: [{ reporterId: userId }, { resolvedById: userId }] } }),
    prisma.verification.count({ where: { identifier: subject.email } }),
    prisma.newsletterSubscriber.count({ where: { email: subject.email } }),
    prisma.formationOrgInvite.count({ where: { email: subject.email } }),
    prisma.trainingAccessRule.count({ where: { email: subject.email } }),
    prisma.trainingNotificationLog.count({ where: { recipientEmail: subject.email } }),
  ])

  if (definitions.length !== counts.length) {
    throw new Error("Privacy inventory definition/count mismatch")
  }
  const entries = definitions.map((definition, index) => ({ ...definition, count: counts[index] }))
  const unresolvedScopes = [
    {
      source: "FormSubmission.data and other free-text/JSON fields",
      reason: "No account ID relation; content scanning would create false positives and expose third parties.",
    },
    {
      source: "Activity.user and legacy string actor fields",
      reason: "The field is not a stable account ID and cannot be attributed safely.",
    },
    {
      source: "PageView, infrastructure logs and backups",
      reason: "No direct account ID exists; retention and backup expiry require an operational policy.",
    },
    {
      source: "External AI, email, storage and notification providers",
      reason: "Provider-side deletion cannot be inferred from the application database.",
    },
  ]
  const inventoryHash = createHash("sha256")
    .update(JSON.stringify({ version: PRIVACY_INVENTORY_VERSION, subject, entries, unresolvedScopes }))
    .digest("hex")

  return {
    version: PRIVACY_INVENTORY_VERSION,
    subject,
    entries,
    unresolvedScopes,
    inventoryHash,
    policy: { executionEnabled: false, reason: "retention_matrix_unapproved" },
  }
}

export function buildDeletionPreview(inventory: PrivacyInventory): PrivacyDeletionPreview {
  const summary: Record<PrivacyTechnicalAction, number> = {
    delete_candidate: 0,
    anonymize_candidate: 0,
    detach_candidate: 0,
    retain_shared: 0,
    review: 0,
  }
  for (const item of inventory.entries) summary[item.technicalAction] += item.count

  return {
    inventory,
    summary,
    execution: {
      allowed: false,
      code: "retention_matrix_unapproved",
      ambiguousSources: inventory.entries
        .filter((item) => item.count > 0 && item.policyStatus === "review_required")
        .map((item) => `${item.source}.${item.relation}`)
        .concat(inventory.unresolvedScopes.map((scope) => scope.source)),
    },
  }
}
