import { NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const BUNDLE_COOKIE = "beldoc-bundle-session";

/// DELETE /api/bundles/runs/[runId]
///
/// Soft-delete d'un run en cours : passe le `status` à `abandoned` plutôt
/// que de supprimer la ligne — préserve les éventuels payloads pour audit /
/// reprise via code de reprise expiré. La prochaine ouverture de la page
/// du dossier ne trouvera plus aucun `in_progress` et démarrera un nouveau
/// run vide.
///
/// Auth : on accepte le propriétaire du run, qu'il soit identifié par
/// `userId` (utilisateur connecté) ou par `sessionId` (parcours anonyme).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;

  const run = await prisma.bundleRun.findUnique({ where: { id: runId } });
  if (!run) {
    return NextResponse.json({ error: "Run introuvable" }, { status: 404 });
  }

  // Contrôle d'accès : le run doit appartenir à l'utilisateur / la session
  // qui le réinitialise. Pas de cross-tenant possible.
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id || null;
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(BUNDLE_COOKIE)?.value || null;

  const ownedByUser = userId && run.userId === userId;
  const ownedBySession = sessionId && run.sessionId === sessionId;
  if (!ownedByUser && !ownedBySession) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (run.status !== "in_progress") {
    // Déjà fini / abandonné — opération idempotente, on renvoie ok.
    return NextResponse.json({ ok: true, alreadyClosed: true });
  }

  await prisma.bundleRun.update({
    where: { id: runId },
    data: { status: "abandoned" },
  });
  return NextResponse.json({ ok: true });
}
