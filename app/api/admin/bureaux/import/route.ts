import { NextRequest, NextResponse } from "next/server";
import { Prisma, BureauType } from "@prisma/client";
import { prisma, withDbRetry } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { logActivity } from "@/lib/activity-logger";
import type { BureauTypeCode } from "@/lib/bureaus/types";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };
const VALID_TYPES: BureauTypeCode[] = ["CPAS", "COMMUNE", "ONEM", "SYNDICAT", "PERMANENCE", "AUTRE"];

type CsvRow = {
  type: BureauTypeCode;
  organismeCode: string;
  name: string;
  street: string;
  streetNum: string;
  postalCode: string;
  city: string;
  insCode: string;
  phone: string;
  email: string;
  website: string;
  appointmentUrl: string;
  lat: string;
  lng: string;
};

type ParseError = { row: number; message: string };

const HEADERS_REQUIRED = ["type", "organismeCode", "name", "street", "postalCode", "city"];

export async function POST(req: NextRequest) {
  const authCheck = await requireAdminAuth();
  if (!authCheck.isAuthorized) return authCheck.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400, headers: jsonHeaders });
  }

  const csv = (body as { csv?: string })?.csv;
  const dryRun = (body as { dryRun?: boolean })?.dryRun !== false;
  if (typeof csv !== "string" || csv.trim().length === 0) {
    return NextResponse.json({ error: "Champ 'csv' requis" }, { status: 400, headers: jsonHeaders });
  }

  // Parsing simple : on assume ; comme séparateur (Excel BE), virgule en fallback.
  const lines = csv
    .replace(/^﻿/, "") // BOM
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) {
    return NextResponse.json({ error: "CSV vide" }, { status: 400, headers: jsonHeaders });
  }

  const sep = lines[0].includes(";") ? ";" : ",";
  const header = lines[0].split(sep).map((h) => h.trim());
  const missing = HEADERS_REQUIRED.filter((h) => !header.includes(h));
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Colonnes manquantes : ${missing.join(", ")}` },
      { status: 400, headers: jsonHeaders }
    );
  }

  const rows: CsvRow[] = [];
  const errors: ParseError[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i], sep);
    const obj: Record<string, string> = {};
    header.forEach((h, idx) => (obj[h] = (cols[idx] ?? "").trim()));
    const typeUp = obj.type.toUpperCase() as BureauTypeCode;
    if (!VALID_TYPES.includes(typeUp)) {
      errors.push({ row: i + 1, message: `type invalide: ${obj.type}` });
      continue;
    }
    if (!obj.organismeCode || !obj.name || !obj.street || !obj.postalCode || !obj.city) {
      errors.push({ row: i + 1, message: "champs requis manquants" });
      continue;
    }
    if (!/^\d{4}$/.test(obj.postalCode)) {
      errors.push({ row: i + 1, message: "code postal invalide" });
      continue;
    }
    rows.push({
      type: typeUp,
      organismeCode: obj.organismeCode.trim(),
      name: obj.name,
      street: obj.street,
      streetNum: obj.streetNum ?? "",
      postalCode: obj.postalCode,
      city: obj.city,
      insCode: obj.insCode ?? "",
      phone: obj.phone ?? "",
      email: obj.email ?? "",
      website: obj.website ?? "",
      appointmentUrl: obj.appointmentUrl ?? "",
      lat: obj.lat ?? "",
      lng: obj.lng ?? "",
    });
  }

  // Résolution des FK
  const orgs = await prisma.organisme.findMany();
  const orgByCode = new Map(orgs.map((o) => [o.code, o]));
  const communes = await prisma.commune.findMany();
  const insToId = new Map(communes.map((c) => [c.insCode, c.id]));

  const orgErrors: ParseError[] = [];
  const insErrors: ParseError[] = [];
  for (const [i, r] of rows.entries()) {
    if (!orgByCode.has(r.organismeCode)) {
      orgErrors.push({ row: i + 2, message: `organisme '${r.organismeCode}' inconnu` });
    }
    if (r.insCode && !insToId.has(r.insCode)) {
      insErrors.push({ row: i + 2, message: `INS '${r.insCode}' inconnu` });
    }
  }

  const allErrors = [...errors, ...orgErrors, ...insErrors];

  if (dryRun) {
    return NextResponse.json(
      {
        dryRun: true,
        valid: rows.length - orgErrors.length - insErrors.length,
        errors: allErrors,
        preview: rows.slice(0, 10),
      },
      { headers: jsonHeaders }
    );
  }

  if (allErrors.length > 0) {
    return NextResponse.json(
      { error: "Erreurs dans le CSV", details: allErrors },
      { status: 400, headers: jsonHeaders }
    );
  }

  let created = 0;
  let updated = 0;

  for (const r of rows) {
    const org = orgByCode.get(r.organismeCode)!;
    const communeId = r.insCode ? insToId.get(r.insCode) ?? null : null;

    const data = {
      organismeId: org.id,
      type: r.type as BureauType,
      name: r.name,
      street: r.street,
      streetNum: r.streetNum || null,
      postalCode: r.postalCode,
      city: r.city,
      lat: r.lat ? Number(r.lat) || null : null,
      lng: r.lng ? Number(r.lng) || null : null,
      communeId,
      phone: r.phone || null,
      email: r.email || null,
      website: r.website || null,
      appointmentUrl: r.appointmentUrl || null,
      hours: [] as Prisma.InputJsonValue,
      services: [] as Prisma.InputJsonValue,
      updatedBy: authCheck.user.id,
    };

    // Idempotence : on cherche un bureau avec [type, postalCode, name] identique.
    const existing = await withDbRetry(() =>
      prisma.bureau.findFirst({
        where: { type: r.type as BureauType, postalCode: r.postalCode, name: r.name },
      })
    );

    if (existing) {
      await withDbRetry(() => prisma.bureau.update({ where: { id: existing.id }, data }));
      updated++;
    } else {
      await withDbRetry(() => prisma.bureau.create({ data }));
      created++;
    }
  }

  await logActivity(
    authCheck.user.name,
    "created_bulk",
    "setting",
    `Import CSV bureaus`,
    undefined,
    `${created} créés, ${updated} mis à jour`
  );

  return NextResponse.json({ created, updated, total: rows.length }, { headers: jsonHeaders });
}

function parseCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (ch === sep && !inQuote) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}
