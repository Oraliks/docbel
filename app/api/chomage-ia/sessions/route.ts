/**
 * GET /api/chomage-ia/sessions?domain=chomage[&archived=false][&folderId=xxx]
 *
 * Liste des sessions de chat pour le domaine donné.
 *
 * Tri (migration 17) :
 *   1. `pinned` DESC  → les épinglées remontent en haut
 *   2. `updatedAt` DESC → puis les plus récentes
 *
 * Filtres :
 *   - `archived` (default false) → exclut les archivées sauf si =true ou =all
 *   - `folderId` → ne renvoie que les sessions de ce dossier
 *                  Valeur spéciale "null" / "none" → sessions hors-dossier.
 *
 * Renvoie aussi un compteur de messages par session pour l'affichage sidebar
 * + les champs `pinned`, `archived`, `folderId` pour piloter le rail UI.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { DEFAULT_DOMAIN } from "@/lib/chomage-ia/types";

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const url = new URL(req.url);
  const domain = url.searchParams.get("domain") ?? DEFAULT_DOMAIN;
  const archivedParam = url.searchParams.get("archived");
  const folderIdParam = url.searchParams.get("folderId");

  // Filtre archived : par défaut false. Accepte "true" (uniquement archives)
  // ou "all" (tout, sans filtre) pour les écrans avancés.
  let archivedFilter: { archived?: boolean } = { archived: false };
  if (archivedParam === "true") archivedFilter = { archived: true };
  else if (archivedParam === "all") archivedFilter = {};

  // Filtre folder : null/none = sessions sans dossier ; sinon match exact.
  let folderFilter: { folderId?: string | null } = {};
  if (folderIdParam === "null" || folderIdParam === "none") {
    folderFilter = { folderId: null };
  } else if (folderIdParam) {
    folderFilter = { folderId: folderIdParam };
  }

  const sessions = await prisma.chatSession.findMany({
    where: { domain, ...archivedFilter, ...folderFilter },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    take: 100,
    select: {
      id: true,
      title: true,
      domain: true,
      pinned: true,
      archived: true,
      folderId: true,
      preferredModel: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
  });

  return NextResponse.json({
    items: sessions.map((s) => ({
      id: s.id,
      title: s.title,
      domain: s.domain,
      pinned: s.pinned,
      archived: s.archived,
      folderId: s.folderId,
      preferredModel: s.preferredModel,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      messageCount: s._count.messages,
    })),
  });
}
