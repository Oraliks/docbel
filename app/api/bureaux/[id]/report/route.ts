import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma, withDbRetry } from "@/lib/prisma";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

const VALID_CATEGORIES = ["hours", "address", "phone", "closed", "other"] as const;
type Category = (typeof VALID_CATEGORIES)[number];

// Rate-limit naïf en mémoire (par IP, 5 reports / heure)
const rateMap = new Map<string, { count: number; resetAt: number }>();

function checkRate(ip: string): boolean {
  const now = Date.now();
  const e = rateMap.get(ip);
  if (!e || e.resetAt < now) {
    rateMap.set(ip, { count: 1, resetAt: now + 3600_000 });
    return true;
  }
  if (e.count >= 5) return false;
  e.count++;
  return true;
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  if (!checkRate(ip)) {
    return NextResponse.json(
      { error: "Trop de signalements depuis cette IP. Réessayez plus tard." },
      { status: 429, headers: jsonHeaders }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "JSON invalide" },
      { status: 400, headers: jsonHeaders }
    );
  }

  const raw = body as Record<string, unknown>;
  const category = String(raw.category ?? "").trim().toLowerCase() as Category;
  const message = String(raw.message ?? "").trim();
  const reporterEmail = (raw.reporterEmail ?? null) as string | null;

  if (!VALID_CATEGORIES.includes(category)) {
    return NextResponse.json(
      { error: `category invalide (${VALID_CATEGORIES.join(", ")})` },
      { status: 400, headers: jsonHeaders }
    );
  }
  if (message.length < 5 || message.length > 1000) {
    return NextResponse.json(
      { error: "message : 5–1000 caractères" },
      { status: 400, headers: jsonHeaders }
    );
  }
  if (reporterEmail && typeof reporterEmail === "string") {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(reporterEmail) || reporterEmail.length > 200) {
      return NextResponse.json(
        { error: "reporterEmail invalide" },
        { status: 400, headers: jsonHeaders }
      );
    }
  }

  // Vérifie que le bureau existe
  const bureau = await withDbRetry(() => prisma.bureau.findUnique({ where: { id } }));
  if (!bureau) {
    return NextResponse.json(
      { error: "Bureau introuvable" },
      { status: 404, headers: jsonHeaders }
    );
  }

  const ipHash = createHash("sha256").update(ip).digest("hex").slice(0, 16);
  const userAgent = req.headers.get("user-agent")?.slice(0, 200) ?? null;

  const created = await withDbRetry(() =>
    prisma.bureauReport.create({
      data: {
        bureauId: id,
        category,
        message,
        reporterEmail: typeof reporterEmail === "string" ? reporterEmail : null,
        ipHash,
        userAgent,
      },
    })
  );

  return NextResponse.json(
    { ok: true, id: created.id },
    { status: 201, headers: jsonHeaders }
  );
}
