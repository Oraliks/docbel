/**
 * Inscription self-service d'un organisme de formation (Lot A).
 *
 * Différence clé avec `/api/inscription/partenaire` : ce parcours ne passe PAS
 * par l'allowlist `PartnerDomain` (elle n'a de sens que pour les organisations
 * connues d'avance). N'importe quelle école / ASBL / société peut candidater ;
 * c'est la validation admin qui fait office de contrôle.
 *
 * À la soumission on crée, en une transaction :
 *   - la `FormationOrganization` (status=pending, submittedAt),
 *   - le `User` propriétaire (role=organisme, status=pending → connexion
 *     bloquée tant que l'admin n'a pas validé), + sa ligne `Account`,
 *   - le `FormationOrgMember` (role=owner).
 *
 * `partnerOrganization` est renseigné avec le nom de l'organisation : c'est la
 * condition exigée par `requireProOrAdminAuth()` pour les guards pro.
 */
import "server-only";
import bcrypt from "bcryptjs";
import { Prisma, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import { verifyEnterpriseNumber } from "./org-verification";
import {
  sendOrgApplicationReceivedEmail,
  sendAdminNewOrgNotice,
} from "./emails";
import { ORG_TYPE_LABELS, type FormationOrgType } from "./constants";
import type { OrgApplicationInput } from "./schemas";

export type OrgSignupError =
  | { code: "email_taken"; message: string }
  | { code: "org_exists"; message: string }
  | { code: "internal"; message: string };

export interface OrgSignupSuccess {
  organizationId: string;
  slug: string;
  userId: string;
  enterpriseVerified: boolean;
  verificationMessage: string;
}

export type OrgSignupResult =
  | { ok: true; data: OrgSignupSuccess }
  | { ok: false; error: OrgSignupError };

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "organisme";
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = slugify(base);
  for (let i = 0; i < 5; i++) {
    const clash = await prisma.formationOrganization.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!clash) return slug;
    slug = `${slugify(base)}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return `${slugify(base)}-${Date.now().toString(36)}`;
}

/** Crée la demande d'organisme + le compte propriétaire. */
export async function createOrgApplication(
  input: OrgApplicationInput,
): Promise<OrgSignupResult> {
  const email = input.contactEmail.trim().toLowerCase();

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existingUser) {
    return {
      ok: false,
      error: {
        code: "email_taken",
        message:
          "Un compte existe déjà avec cet email. Connectez-vous, ou utilisez une autre adresse.",
      },
    };
  }

  // Vérification BCE (best-effort, jamais bloquante).
  const verification = input.enterpriseNumber
    ? await verifyEnterpriseNumber(input.enterpriseNumber)
    : null;

  if (verification?.enterpriseNumber) {
    const dup = await prisma.formationOrganization.findFirst({
      where: { enterpriseNumber: verification.enterpriseNumber },
      select: { id: true, name: true },
    });
    if (dup) {
      return {
        ok: false,
        error: {
          code: "org_exists",
          message: `Une organisation est déjà enregistrée avec ce numéro d'entreprise (${dup.name}). Demandez une invitation à son responsable.`,
        },
      };
    }
  }

  const slug = await uniqueSlug(input.name);
  const passwordHash = await bcrypt.hash(input.password, 10);
  const now = new Date();

  try {
    const { organizationId, userId } = await prisma.$transaction(async (tx) => {
      const org = await tx.formationOrganization.create({
        data: {
          slug,
          name: input.name.trim(),
          type: input.type,
          description: input.description.trim(),
          website: input.website || null,
          contactEmail: email,
          notifyEmail: email,
          contactName: input.contactName.trim(),
          contactRole: input.contactRole || null,
          contactPhone: input.contactPhone || null,
          street: verification?.street ?? input.street ?? null,
          postalCode: verification?.postalCode ?? input.postalCode ?? null,
          city: verification?.city ?? input.city ?? null,
          enterpriseNumber: verification?.enterpriseNumber ?? null,
          legalName: verification?.legalName ?? null,
          enterpriseVerified: verification?.verified ?? false,
          enterpriseVerifiedAt: verification?.verified ? now : null,
          status: "pending",
          submittedAt: now,
          // Pont utilisé par les guards pro (requireProOrAdminAuth).
          partnerOrganization: input.name.trim(),
        },
      });

      const user = await tx.user.create({
        data: {
          name: input.contactName.trim(),
          email,
          password: passwordHash,
          role: "organisme",
          segment: "organisme",
          status: UserStatus.pending,
          emailVerified: false,
          partnerOrganization: org.name,
        },
      });

      await tx.account.create({
        data: {
          id: `acc_${user.id}_credential`,
          accountId: user.id,
          providerId: "credential",
          userId: user.id,
          password: passwordHash,
        },
      });

      await tx.formationOrgMember.create({
        data: { organizationId: org.id, userId: user.id, role: "owner" },
      });

      await tx.formationOrganization.update({
        where: { id: org.id },
        data: { createdById: user.id },
      });

      return { organizationId: org.id, userId: user.id };
    });

    // Emails best-effort (hors transaction).
    await sendOrgApplicationReceivedEmail({
      to: email,
      orgName: input.name.trim(),
      contactName: input.contactName.trim(),
    });
    const adminEmail = process.env.CONTACT_EMAIL_FROM || process.env.EMAIL_FROM;
    if (adminEmail) {
      await sendAdminNewOrgNotice({
        to: adminEmail.replace(/^.*<|>.*$/g, ""),
        orgName: input.name.trim(),
        orgType: ORG_TYPE_LABELS[input.type as FormationOrgType] ?? input.type,
        enterpriseVerified: verification?.verified ?? false,
      });
    }

    await logActivity(
      userId,
      "created",
      "formation_org",
      input.name.trim(),
      organizationId,
      `demande self-service (${input.type})`,
    );

    return {
      ok: true,
      data: {
        organizationId,
        slug,
        userId,
        enterpriseVerified: verification?.verified ?? false,
        verificationMessage: verification?.message ?? "",
      },
    };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return {
        ok: false,
        error: {
          code: "email_taken",
          message: "Un compte existe déjà avec cet email.",
        },
      };
    }
    console.error("[formations/org-signup] error:", e);
    return {
      ok: false,
      error: { code: "internal", message: "Une erreur est survenue. Réessayez." },
    };
  }
}
