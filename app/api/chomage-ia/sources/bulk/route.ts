/**
 * POST /api/chomage-ia/sources/bulk
 *
 * Actions en lot sur plusieurs sources de la knowledge base.
 *
 * Body :
 *   {
 *     ids: string[],                                                 // 1-200 max
 *     action: "enable" | "disable" | "delete" | "reindex"
 *           | "add-tags" | "remove-tags",
 *     tags?: string[]                                                // requis pour add/remove-tags
 *   }
 *
 * Retourne :
 *   { updated: number, failed: { id, error }[] }
 *
 * Notes :
 *  - Auth admin requise.
 *  - Pour add-tags/remove-tags, on doit lire chaque source (les `tags` sont
 *    un array Postgres non-modifiable via `updateMany`). Boucle parallélisée
 *    avec `Promise.all` + `Promise.allSettled` pour ne pas tomber au premier
 *    fail.
 *  - Pour "reindex", lance `runIndexInBackground(id)` (fire-and-forget) :
 *    la route renvoie immédiatement, l'indexing tourne côté serveur.
 *  - Le cap à 200 IDs/batch garde la requête sous quelques secondes même
 *    en mode "add-tags" qui fait N round-trips DB.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { runIndexInBackground } from "@/lib/chomage-ia/indexer";

const BulkRequestSchema = z
  .object({
    ids: z.array(z.string().min(1).max(50)).min(1).max(200),
    action: z.enum([
      "enable",
      "disable",
      "delete",
      "reindex",
      "add-tags",
      "remove-tags",
      "move-to-folder",
    ]),
    tags: z
      .array(z.string().min(1).max(50))
      .max(20)
      .optional(),
    /**
     * Migration 21 — requis pour action="move-to-folder".
     * `null` → retire les sources de leur dossier (vers racine "Sans dossier").
     * `string` → id du KnowledgeFolder cible.
     */
    folderId: z.string().min(1).max(50).nullable().optional(),
  })
  .refine(
    (val) =>
      val.action !== "add-tags" && val.action !== "remove-tags"
        ? true
        : Array.isArray(val.tags) && val.tags.length > 0,
    {
      message: "Le champ `tags` est requis pour add-tags / remove-tags.",
      path: ["tags"],
    },
  )
  .refine(
    (val) =>
      val.action !== "move-to-folder" ? true : val.folderId !== undefined,
    {
      message:
        "Le champ `folderId` est requis pour move-to-folder (passer null pour retirer du dossier).",
      path: ["folderId"],
    },
  );

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = BulkRequestSchema.parse(body);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof z.ZodError
            ? err.issues[0]?.message || "Validation error"
            : "Validation error",
      },
      { status: 400 }
    );
  }

  const { ids, action, tags, folderId } = parsed;
  const failed: Array<{ id: string; error: string }> = [];
  let updated = 0;

  try {
    switch (action) {
      case "enable":
      case "disable": {
        const result = await prisma.knowledgeSource.updateMany({
          where: { id: { in: ids } },
          data: { enabled: action === "enable" },
        });
        updated = result.count;
        break;
      }

      case "delete": {
        const result = await prisma.knowledgeSource.deleteMany({
          where: { id: { in: ids } },
        });
        updated = result.count;
        break;
      }

      case "reindex": {
        // Vérifie l'existence avant de queuer (évite les jobs orphelins).
        const existing = await prisma.knowledgeSource.findMany({
          where: { id: { in: ids } },
          select: { id: true },
        });
        for (const s of existing) {
          runIndexInBackground(s.id);
        }
        updated = existing.length;
        // Sources demandées mais introuvables → marquées failed.
        const foundIds = new Set(existing.map((s) => s.id));
        for (const id of ids) {
          if (!foundIds.has(id)) {
            failed.push({ id, error: "Source introuvable" });
          }
        }
        break;
      }

      case "move-to-folder": {
        // Si folderId n'est pas null, vérifie l'existence pour éviter le crash FK.
        if (folderId !== null && folderId !== undefined) {
          const folder = await prisma.knowledgeFolder.findUnique({
            where: { id: folderId },
            select: { id: true },
          });
          if (!folder) {
            return NextResponse.json(
              { error: "Dossier cible introuvable" },
              { status: 400 },
            );
          }
        }
        const result = await prisma.knowledgeSource.updateMany({
          where: { id: { in: ids } },
          data: { folderId: folderId ?? null },
        });
        updated = result.count;
        break;
      }

      case "add-tags":
      case "remove-tags": {
        // Charge les sources puis met à jour le tableau de tags individuellement
        // (Postgres array, non-modifiable par updateMany).
        const sources = await prisma.knowledgeSource.findMany({
          where: { id: { in: ids } },
          select: { id: true, tags: true },
        });
        const foundIds = new Set(sources.map((s) => s.id));
        for (const id of ids) {
          if (!foundIds.has(id)) {
            failed.push({ id, error: "Source introuvable" });
          }
        }

        const tagsToApply = (tags ?? []).map((t) => t.trim()).filter(Boolean);

        const results = await Promise.allSettled(
          sources.map(async (s) => {
            let nextTags: string[];
            if (action === "add-tags") {
              const set = new Set(s.tags);
              for (const t of tagsToApply) set.add(t);
              nextTags = Array.from(set).slice(0, 20);
            } else {
              const removeSet = new Set(tagsToApply);
              nextTags = s.tags.filter((t) => !removeSet.has(t));
            }
            // Skip update si rien n'a changé (évite write DB inutile).
            if (
              nextTags.length === s.tags.length &&
              nextTags.every((t, i) => t === s.tags[i])
            ) {
              return s.id;
            }
            await prisma.knowledgeSource.update({
              where: { id: s.id },
              data: { tags: nextTags },
            });
            return s.id;
          })
        );

        for (let i = 0; i < results.length; i++) {
          const r = results[i];
          if (r.status === "fulfilled") {
            updated++;
          } else {
            failed.push({
              id: sources[i].id,
              error:
                r.reason instanceof Error
                  ? r.reason.message
                  : String(r.reason),
            });
          }
        }
        break;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Action en lot échouée : ${message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ updated, failed });
}
