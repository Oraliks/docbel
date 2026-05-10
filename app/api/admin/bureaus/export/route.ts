import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma, withDbRetry } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";

const csvHeaders = {
  "Content-Type": "text/csv; charset=utf-8",
  "Content-Disposition": `attachment; filename="bureaus-${new Date()
    .toISOString()
    .slice(0, 10)}.csv"`,
};

const HEADERS = [
  "type",
  "organismeCode",
  "name",
  "street",
  "streetNum",
  "postalCode",
  "city",
  "insCode",
  "phone",
  "email",
  "website",
  "appointmentUrl",
  "lat",
  "lng",
  "active",
  "verified",
  "lastVerifiedAt",
  "services",
] as const;

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const sp = req.nextUrl.searchParams;
  const filter = sp.get("filter") ?? "all";
  const type = sp.get("type")?.trim().toUpperCase();

  const where: Prisma.BureauWhereInput = {};
  if (filter === "active") where.active = true;
  if (filter === "inactive") where.active = false;
  if (filter === "verified") where.verified = true;
  if (filter === "unverified") where.verified = false;
  if (type) where.type = type as "CPAS" | "COMMUNE" | "ONEM" | "SYNDICAT" | "PERMANENCE" | "AUTRE";

  const items = await withDbRetry(() =>
    prisma.bureau.findMany({
      where,
      orderBy: [{ type: "asc" }, { city: "asc" }, { name: "asc" }],
      include: { organisme: { select: { code: true } }, commune: { select: { insCode: true } } },
    })
  );

  const rows: string[] = [];
  rows.push(HEADERS.join(";"));

  for (const b of items) {
    const cols = [
      b.type,
      b.organisme?.code ?? "",
      b.name,
      b.street,
      b.streetNum ?? "",
      b.postalCode,
      b.city,
      b.commune?.insCode ?? "",
      b.phone ?? "",
      b.email ?? "",
      b.website ?? "",
      b.appointmentUrl ?? "",
      b.lat?.toString() ?? "",
      b.lng?.toString() ?? "",
      b.active ? "1" : "0",
      b.verified ? "1" : "0",
      b.lastVerifiedAt?.toISOString() ?? "",
      Array.isArray(b.services) ? (b.services as string[]).join("|") : "",
    ];
    rows.push(cols.map(escapeCsv).join(";"));
  }

  // BOM UTF-8 + CRLF (compat Excel)
  const body = "﻿" + rows.join("\r\n") + "\r\n";
  return new NextResponse(body, { headers: csvHeaders });
}

function escapeCsv(v: string): string {
  if (v.includes(";") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}
