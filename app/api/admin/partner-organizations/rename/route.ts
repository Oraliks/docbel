import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

export async function POST(req: NextRequest) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: jsonHeaders },
    );
  }

  const { from, to } = body as { from?: string; to?: string };
  const fromName = from?.trim();
  const toName = to?.trim();

  if (!fromName || !toName) {
    return NextResponse.json(
      { error: "Les noms 'from' et 'to' sont requis" },
      { status: 400, headers: jsonHeaders },
    );
  }
  if (fromName === toName) {
    return NextResponse.json(
      { error: "Le nouveau nom est identique à l'ancien" },
      { status: 400, headers: jsonHeaders },
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const domains = await tx.partnerDomain.updateMany({
        where: { organizationName: fromName },
        data: { organizationName: toName },
      });
      const users = await tx.user.updateMany({
        where: { partnerOrganization: fromName },
        data: { partnerOrganization: toName },
      });
      return {
        domainsUpdated: domains.count,
        usersUpdated: users.count,
      };
    });

    return NextResponse.json(
      { ok: true, ...result, from: fromName, to: toName },
      { headers: jsonHeaders },
    );
  } catch (error) {
    console.error("Error renaming organization:", error);
    return NextResponse.json(
      { error: "Failed to rename organization" },
      { status: 500, headers: jsonHeaders },
    );
  }
}
