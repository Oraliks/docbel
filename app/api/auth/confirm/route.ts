import { NextRequest, NextResponse } from "next/server";
import { UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { consumePartnerConfirmationToken } from "@/lib/partner-confirmation";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Requête invalide" },
      { status: 400, headers: jsonHeaders },
    );
  }

  const token = (body as { token?: string }).token?.trim();
  if (!token) {
    return NextResponse.json(
      { error: "Token manquant" },
      { status: 400, headers: jsonHeaders },
    );
  }

  const consumed = await consumePartnerConfirmationToken(token);
  if (!consumed) {
    return NextResponse.json(
      { error: "Lien invalide ou expiré" },
      { status: 400, headers: jsonHeaders },
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: consumed.email },
  });
  if (!user) {
    return NextResponse.json(
      { error: "Compte introuvable" },
      { status: 404, headers: jsonHeaders },
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerifiedAt: new Date(),
      status: UserStatus.active,
    },
  });

  return NextResponse.json(
    { ok: true, email: consumed.email },
    { headers: jsonHeaders },
  );
}
