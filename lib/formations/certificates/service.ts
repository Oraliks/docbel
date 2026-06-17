/** Émission & vérification des attestations/certificats. */
import "server-only";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { isFlagEnabled } from "@/lib/formations/module";
import { durationText } from "@/components/formations/format";
import { buildCertificatePdf } from "./pdf";

const APP_URL =
  process.env.NEXT_PUBLIC_BETTER_AUTH_URL || process.env.BETTER_AUTH_URL || "https://docbel.be";

function certNumber(): string {
  const year = new Date().getFullYear();
  return `DOCBEL-${year}-${nanoid(8).toUpperCase().replace(/[^A-Z0-9]/g, "X")}`;
}
function verifyCode(): string {
  return nanoid(12).toUpperCase().replace(/[^A-Z0-9]/g, "X");
}
export function verifyUrl(code: string): string {
  return `${APP_URL}/formations/certificats/verifier/${code}`;
}

/**
 * Émet une attestation pour une inscription terminée, si la formation en prévoit
 * une et que le flag `certificates` est actif. Idempotent (réutilise l'existant).
 */
export async function issueCertificateForEnrollment(enrollmentId: string) {
  if (!(await isFlagEnabled("certificates"))) return null;

  const enrollment = await prisma.trainingEnrollment.findUnique({ where: { id: enrollmentId } });
  if (!enrollment) return null;
  if (enrollment.certificateId) {
    return prisma.trainingCertificate.findUnique({ where: { id: enrollment.certificateId } });
  }

  const training = await prisma.training.findUnique({
    where: { id: enrollment.trainingId },
    select: { title: true, certificateType: true, durationHours: true, totalDurationLabel: true },
  });
  if (!training || training.certificateType === "none") return null;

  const [org, session] = await Promise.all([
    prisma.formationOrganization.findUnique({
      where: { id: enrollment.organizationId },
      select: { name: true },
    }),
    enrollment.sessionId
      ? prisma.trainingSession.findUnique({
          where: { id: enrollment.sessionId },
          select: { startsAt: true },
        })
      : Promise.resolve(null),
  ]);

  const certType =
    training.certificateType === "docbel"
      ? "docbel_certified"
      : training.certificateType === "partner"
        ? "partner_certificate"
        : "participation";

  const cert = await prisma.trainingCertificate.create({
    data: {
      trainingId: enrollment.trainingId,
      sessionId: enrollment.sessionId,
      enrollmentId: enrollment.id,
      userId: enrollment.userId,
      organizationId: enrollment.organizationId,
      type: certType,
      status: "issued",
      certificateNumber: certNumber(),
      verificationCode: verifyCode(),
      holderName: enrollment.citizenName ?? "Participant",
      trainingTitle: training.title,
      orgName: org?.name ?? null,
    },
  });

  await prisma.trainingEnrollment.update({
    where: { id: enrollment.id },
    data: { certificateId: cert.id, status: "certificate_available" },
  });

  return cert;
}

export async function getCertificate(id: string) {
  return prisma.trainingCertificate.findUnique({ where: { id } });
}

export async function verifyByCode(code: string) {
  return prisma.trainingCertificate.findUnique({ where: { verificationCode: code } });
}

/** Génère le PDF d'un certificat à la demande (pas de stockage requis). */
export async function buildPdfForCertificate(certId: string): Promise<Buffer | null> {
  const cert = await prisma.trainingCertificate.findUnique({ where: { id: certId } });
  if (!cert) return null;
  const training = await prisma.training.findUnique({
    where: { id: cert.trainingId },
    select: { durationHours: true, totalDurationLabel: true },
  });
  return buildCertificatePdf({
    holderName: cert.holderName,
    trainingTitle: cert.trainingTitle,
    orgName: cert.orgName,
    type: cert.type,
    certificateNumber: cert.certificateNumber,
    verificationCode: cert.verificationCode,
    issuedAt: cert.issuedAt,
    durationLabel: durationText(training?.durationHours ?? null, training?.totalDurationLabel ?? null),
    sessionLabel: null,
    verifyUrl: verifyUrl(cert.verificationCode),
  });
}
