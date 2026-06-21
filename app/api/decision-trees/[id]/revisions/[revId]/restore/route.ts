/// Decision Builder — restauration d'une révision vers le brouillon.
/// Clone le contenu de la révision dans `draftContent` (jamais d'écrasement
/// direct du publié — l'admin doit re-publier explicitement).

import type { NextRequest } from "next/server";
import { requireAdminAuth } from "@/lib/auth-check";
import { restoreRevisionToDraft } from "@/lib/decision-builder/server";
import { jsonError, jsonOk } from "@/lib/decision-builder/api-helpers";

type Params = { params: Promise<{ id: string; revId: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id, revId } = await params;
  const result = await restoreRevisionToDraft(id, revId, auth.user.id);

  if (!result.ok) {
    return jsonError(
      404,
      result.reason === "tree_not_found"
        ? "Arbre introuvable."
        : "Révision introuvable.",
    );
  }

  return jsonOk({ ok: true, restoredFrom: result.restoredFrom });
}
