import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireEmployerOrAdminAuth } from "@/lib/auth-check";
import { DOCUMENT_TYPES } from "@/lib/employeur/documents/types";
import { logActivity } from "@/lib/activity-logger";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

const saveSchema = z.object({
  type: z.enum(DOCUMENT_TYPES),
  title: z.string().trim().min(1, "Le titre est requis.").max(200),
  // Valeurs du document (clé → string) telles que rendues par le formulaire.
  content: z.record(z.string(), z.string()),
  scenarioId: z.string().trim().min(1).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireEmployerOrAdminAuth();
  if (!auth.isAuthorized) return auth.error;
  const userId = auth.user.id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: jsonHeaders });
  }

  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides" },
      { status: 400, headers: jsonHeaders }
    );
  }
  const { type, title, content, scenarioId } = parsed.data;

  try {
    const draft = await prisma.documentDraft.create({
      data: {
        userId,
        type,
        title,
        content,
        scenarioId: scenarioId ?? null,
        status: "draft",
      },
      select: { id: true },
    });
    await logActivity(userId, "created", "employer", title || "Document", draft.id, "Document préparé");
    return NextResponse.json({ id: draft.id }, { status: 201, headers: jsonHeaders });
  } catch (error) {
    console.error("[employeur] save document failed:", error);
    return NextResponse.json(
      { error: "Échec de l'enregistrement du document." },
      { status: 500, headers: jsonHeaders }
    );
  }
}

export async function GET() {
  const auth = await requireEmployerOrAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const drafts = await prisma.documentDraft.findMany({
    where: { userId: auth.user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      type: true,
      title: true,
      status: true,
      scenarioId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ drafts }, { status: 200, headers: jsonHeaders });
}
