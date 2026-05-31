import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";

function csvEscape(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: NextRequest) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  // Segment via ?segment=employeur (défaut partenaire). Sépare l'export des
  // deux publics pros : role "employer" vs "partner".
  const segment =
    req.nextUrl.searchParams.get("segment") === "employeur"
      ? "employeur"
      : "partenaire";
  const role = segment === "employeur" ? "employer" : "partner";

  const users = await prisma.user.findMany({
    where: { role },
    select: {
      id: true,
      name: true,
      email: true,
      partnerOrganization: true,
      status: true,
      emailVerified: true,
      createdAt: true,
      lastLoginAt: true,
    },
    orderBy: [{ partnerOrganization: "asc" }, { createdAt: "asc" }],
  });

  const header = [
    "id",
    "nom",
    "email",
    "organisation",
    "statut",
    "email_verifie",
    "inscrit_le",
    "derniere_connexion",
  ];

  const rows = users.map((u) =>
    [
      u.id,
      u.name,
      u.email,
      u.partnerOrganization ?? "",
      u.status,
      u.emailVerified ? "oui" : "non",
      u.createdAt.toISOString(),
      u.lastLoginAt?.toISOString() ?? "",
    ]
      .map(csvEscape)
      .join(","),
  );

  const csv = [header.join(","), ...rows].join("\n");

  const today = new Date().toISOString().slice(0, 10);
  const filenamePrefix = segment === "employeur" ? "employeurs" : "partenaires";
  return new NextResponse(`﻿${csv}`, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filenamePrefix}-${today}.csv"`,
    },
  });
}
