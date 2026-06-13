import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { logActivity } from "@/lib/activity-logger";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: jsonHeaders });
  }

  const b = body as {
    code?: string;
    title?: string;
    institution?: string;
    url?: string;
    contentSummary?: string;
    reliability?: string;
    appliesToModules?: string[];
  };

  if (!b.code?.trim() || !b.title?.trim() || !b.institution?.trim() || !b.url?.trim()) {
    return NextResponse.json(
      { error: "Code, titre, institution et URL sont obligatoires." },
      { status: 400, headers: jsonHeaders }
    );
  }

  try {
    const source = await prisma.employerLegalSource.create({
      data: {
        code: b.code.trim(),
        title: b.title.trim(),
        institution: b.institution.trim(),
        url: b.url.trim(),
        contentSummary: b.contentSummary?.trim() || null,
        reliability: b.reliability || null,
        appliesToModules: Array.isArray(b.appliesToModules) ? b.appliesToModules : [],
      },
    });
    await logActivity(auth.user.email, "created", "employer", `Source ${source.code}`, source.id);
    return NextResponse.json({ id: source.id }, { status: 201, headers: jsonHeaders });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "Ce code de source existe déjà." },
        { status: 409, headers: jsonHeaders }
      );
    }
    console.error("[admin/employeur] create source failed:", error);
    return NextResponse.json({ error: "Échec de la création." }, { status: 500, headers: jsonHeaders });
  }
}
