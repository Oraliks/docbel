import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdminAuth } from "@/lib/auth-check";
import {
  deletePartnerDomain,
  updatePartnerDomain,
} from "@/lib/partner-domains";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

export async function PATCH(
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

  const input = body as {
    domain?: string;
    organizationName?: string;
    notes?: string | null;
    isTest?: boolean;
    isActive?: boolean;
  };

  if (input.domain !== undefined) {
    const DOMAIN_REGEX = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/;
    const normalized = input.domain.trim().toLowerCase().replace(/^@/, "");
    if (!normalized || !DOMAIN_REGEX.test(normalized)) {
      return NextResponse.json(
        { error: "Domaine invalide (ex: cpas.brussels)" },
        { status: 400, headers: jsonHeaders },
      );
    }
    input.domain = normalized;
  }

  try {
    const updated = await updatePartnerDomain(id, input);
    return NextResponse.json({ item: updated }, { headers: jsonHeaders });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Ce domaine est déjà enregistré" },
        { status: 409, headers: jsonHeaders },
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { error: "Domaine introuvable" },
        { status: 404, headers: jsonHeaders },
      );
    }
    console.error("Error updating partner domain:", error);
    return NextResponse.json(
      { error: "Failed to update partner domain" },
      { status: 500, headers: jsonHeaders },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  const { id } = await context.params;

  try {
    await deletePartnerDomain(id);
    return NextResponse.json({ ok: true }, { headers: jsonHeaders });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { error: "Domaine introuvable" },
        { status: 404, headers: jsonHeaders },
      );
    }
    console.error("Error deleting partner domain:", error);
    return NextResponse.json(
      { error: "Failed to delete partner domain" },
      { status: 500, headers: jsonHeaders },
    );
  }
}
