import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import * as bcrypt from "bcryptjs";
import { Prisma, UserStatus } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isEmailAuthorized } from "@/lib/partner-domains";
import {
  createPartnerConfirmationToken,
  sendPartnerConfirmationEmail,
} from "@/lib/partner-confirmation";
import { normalizeBelgianTVA } from "@/lib/pdf-forms/validators";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);
  if (session?.user) {
    return NextResponse.json(
      { error: "Vous êtes déjà connecté" },
      { status: 403, headers: jsonHeaders },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Requête invalide" },
      { status: 400, headers: jsonHeaders },
    );
  }

  const input = body as {
    name?: string;
    email?: string;
    password?: string;
    vatNumber?: string;
  };

  const name = input.name?.trim() ?? "";
  const email = input.email?.trim().toLowerCase() ?? "";
  const password = input.password ?? "";

  if (!name || !email || !password) {
    return NextResponse.json(
      { error: "Tous les champs sont requis" },
      { status: 400, headers: jsonHeaders },
    );
  }

  if (!EMAIL_REGEX.test(email)) {
    return NextResponse.json(
      { error: "Email invalide" },
      { status: 400, headers: jsonHeaders },
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Le mot de passe doit faire au moins 8 caractères" },
      { status: 400, headers: jsonHeaders },
    );
  }

  const authorization = await isEmailAuthorized(email);
  if (!authorization.authorized || !authorization.organizationName) {
    return NextResponse.json(
      {
        error:
          "Ce domaine n'est pas autorisé. Contactez DocBel pour ajouter votre organisation à la liste des partenaires.",
      },
      { status: 403, headers: jsonHeaders },
    );
  }
  const organizationName = authorization.organizationName;
  const segment = authorization.segment ?? "partenaire";
  const partnerType = authorization.partnerType ?? null;
  const role = authorization.segment === "employeur" ? "employer" : "partner";

  // Employeur : numéro de TVA obligatoire, valide (checksum mod-97) et unique.
  let vatNumber: string | null = null;
  if (segment === "employeur") {
    const normalizedVat = normalizeBelgianTVA(
      typeof input.vatNumber === "string" ? input.vatNumber : "",
    );
    if (!normalizedVat) {
      return NextResponse.json(
        {
          error:
            "Numéro de TVA belge invalide (format attendu : BE0123456789).",
        },
        { status: 400, headers: jsonHeaders },
      );
    }
    const vatTaken = await prisma.user.findFirst({
      where: { vatNumber: normalizedVat },
      select: { id: true },
    });
    if (vatTaken) {
      return NextResponse.json(
        { error: "Ce numéro de TVA est déjà associé à un compte." },
        { status: 409, headers: jsonHeaders },
      );
    }
    vatNumber = normalizedVat;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "Un compte existe déjà pour cette adresse email" },
      { status: 409, headers: jsonHeaders },
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: passwordHash,
        role,
        segment,
        partnerType,
        status: UserStatus.pending,
        emailVerified: false,
        partnerOrganization: organizationName,
        vatNumber,
      },
    });

    await prisma.account.create({
      data: {
        id: `acc_${user.id}_credential`,
        accountId: user.id,
        providerId: "credential",
        userId: user.id,
        password: passwordHash,
      },
    });

    const token = await createPartnerConfirmationToken(email);
    const baseUrl =
      process.env.NEXT_PUBLIC_BETTER_AUTH_URL ||
      process.env.BETTER_AUTH_URL ||
      new URL(req.url).origin;
    const confirmationUrl = `${baseUrl}/auth/confirm?token=${encodeURIComponent(token)}`;

    await sendPartnerConfirmationEmail({
      to: email,
      recipientName: name,
      organizationName,
      confirmationUrl,
      segment: segment === "employeur" ? "employeur" : "partenaire",
    });

    return NextResponse.json(
      {
        ok: true,
        message:
          "Inscription enregistrée. Consultez votre boîte mail pour activer votre compte.",
      },
      { headers: jsonHeaders },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const target = error.meta?.target;
      const onVat = Array.isArray(target)
        ? target.includes("vatNumber")
        : typeof target === "string" && target.includes("vatNumber");
      return NextResponse.json(
        {
          error: onVat
            ? "Ce numéro de TVA est déjà associé à un compte."
            : "Un compte existe déjà pour cette adresse email",
        },
        { status: 409, headers: jsonHeaders },
      );
    }
    console.error("Partner registration error:", error);
    return NextResponse.json(
      {
        error:
          "Une erreur est survenue. Si elle persiste, contactez l'administrateur.",
      },
      { status: 500, headers: jsonHeaders },
    );
  }
}
