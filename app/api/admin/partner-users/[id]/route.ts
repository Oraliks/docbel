import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Prisma, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import {
  createPartnerConfirmationToken,
  sendPartnerConfirmationEmail,
} from "@/lib/partner-confirmation";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

type Action = "resend-confirmation" | "activate" | "set-status" | "set-flag";

/** Indicateurs d'accès à l'historique des RDV, modifiables par un admin. */
const ALLOWED_FLAGS = ["isOrgManager", "canViewRdvHistory"] as const;
type UserFlag = (typeof ALLOWED_FLAGS)[number];

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: jsonHeaders },
    );
  }

  const { action, status, flag, value } = body as {
    action?: Action;
    status?: UserStatus;
    flag?: string;
    value?: boolean;
  };

  let user;
  try {
    user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        emailVerified: true,
        partnerOrganization: true,
        role: true,
      },
    });
  } catch (error) {
    console.error("Error finding user:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500, headers: jsonHeaders },
    );
  }

  if (!user) {
    return NextResponse.json(
      { error: "Utilisateur introuvable" },
      { status: 404, headers: jsonHeaders },
    );
  }

  if (user.role !== "partner") {
    return NextResponse.json(
      { error: "Cet utilisateur n'est pas un partenaire" },
      { status: 400, headers: jsonHeaders },
    );
  }

  if (action === "resend-confirmation") {
    if (user.emailVerified && user.status === UserStatus.active) {
      return NextResponse.json(
        { error: "Ce compte est déjà activé" },
        { status: 400, headers: jsonHeaders },
      );
    }
    try {
      await prisma.verification.deleteMany({
        where: {
          identifier: `partner-confirm:${user.email}`,
        },
      });
      const token = await createPartnerConfirmationToken(user.email);
      const headerList = await headers();
      const baseUrl =
        process.env.NEXT_PUBLIC_BETTER_AUTH_URL ||
        process.env.BETTER_AUTH_URL ||
        new URL(req.url).origin ||
        `https://${headerList.get("host")}`;
      const confirmationUrl = `${baseUrl}/auth/confirm?token=${encodeURIComponent(
        token,
      )}`;

      await sendPartnerConfirmationEmail({
        to: user.email,
        recipientName: user.name,
        organizationName: user.partnerOrganization ?? "votre organisation",
        confirmationUrl,
      });

      return NextResponse.json(
        { ok: true, message: "Email de confirmation renvoyé" },
        { headers: jsonHeaders },
      );
    } catch (error) {
      console.error("Error resending confirmation:", error);
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Echec de l'envoi de l'email",
        },
        { status: 500, headers: jsonHeaders },
      );
    }
  }

  if (action === "activate") {
    try {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: {
            emailVerified: true,
            emailVerifiedAt: user.emailVerified ? undefined : new Date(),
            status: UserStatus.active,
            failedLoginAttempts: 0,
            lockedUntil: null,
          },
        }),
        prisma.verification.deleteMany({
          where: { identifier: `partner-confirm:${user.email}` },
        }),
      ]);
      return NextResponse.json(
        { ok: true, message: "Compte activé manuellement" },
        { headers: jsonHeaders },
      );
    } catch (error) {
      console.error("Error activating user:", error);
      return NextResponse.json(
        { error: "Echec de l'activation" },
        { status: 500, headers: jsonHeaders },
      );
    }
  }

  if (action === "set-status") {
    if (
      !status ||
      !Object.values(UserStatus).includes(status as UserStatus)
    ) {
      return NextResponse.json(
        { error: "Status invalide" },
        { status: 400, headers: jsonHeaders },
      );
    }
    try {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
          status,
          ...(status === UserStatus.active
            ? { failedLoginAttempts: 0, lockedUntil: null }
            : {}),
        },
        select: { id: true, status: true },
      });
      return NextResponse.json(
        { ok: true, user: updated },
        { headers: jsonHeaders },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        return NextResponse.json(
          { error: "Utilisateur introuvable" },
          { status: 404, headers: jsonHeaders },
        );
      }
      console.error("Error setting user status:", error);
      return NextResponse.json(
        { error: "Echec de la mise à jour" },
        { status: 500, headers: jsonHeaders },
      );
    }
  }

  if (action === "set-flag") {
    if (!flag || !ALLOWED_FLAGS.includes(flag as UserFlag)) {
      return NextResponse.json(
        { error: "Indicateur invalide" },
        { status: 400, headers: jsonHeaders },
      );
    }
    if (typeof value !== "boolean") {
      return NextResponse.json(
        { error: "Valeur invalide" },
        { status: 400, headers: jsonHeaders },
      );
    }
    try {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { [flag as UserFlag]: value },
        select: { id: true, isOrgManager: true, canViewRdvHistory: true },
      });
      return NextResponse.json(
        { ok: true, user: updated },
        { headers: jsonHeaders },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        return NextResponse.json(
          { error: "Utilisateur introuvable" },
          { status: 404, headers: jsonHeaders },
        );
      }
      console.error("Error setting user flag:", error);
      return NextResponse.json(
        { error: "Echec de la mise à jour" },
        { status: 500, headers: jsonHeaders },
      );
    }
  }

  return NextResponse.json(
    { error: "Action inconnue" },
    { status: 400, headers: jsonHeaders },
  );
}
