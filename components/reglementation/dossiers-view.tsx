"use client";

import Link from "next/link";
import { Folder, Trash2, Printer, X } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  useDossiers,
  deleteDossier,
  removeFromDossier,
  renameDossier,
} from "./dossiers-store";

/** Vue des dossiers de travail (localStorage). Édition du nom, retrait, impression. */
export function DossiersView() {
  const dossiers = useDossiers();

  if (dossiers.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Aucun dossier pour l’instant. Depuis une fiche article, utilisez
          «&nbsp;Ajouter à un dossier&nbsp;» pour regrouper les articles d’un cas.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Printer className="size-4" aria-hidden />
          Imprimer la liste
        </button>
      </div>

      {dossiers.map((d) => (
        <Card key={d.id} className="break-inside-avoid">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <div className="flex min-w-0 items-center gap-2">
              <Folder className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <input
                defaultValue={d.name}
                onBlur={(e) => renameDossier(d.id, e.target.value)}
                className="min-w-0 flex-1 rounded bg-transparent px-1 font-semibold outline-none focus:bg-muted/50 print:bg-transparent"
                aria-label="Nom du dossier"
              />
              <span className="shrink-0 text-xs text-muted-foreground">
                {d.items.length}
              </span>
            </div>
            <button
              type="button"
              onClick={() => deleteDossier(d.id)}
              className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive print:hidden"
              aria-label="Supprimer le dossier"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </CardHeader>
          <CardContent className="space-y-1">
            {d.items.length === 0 && (
              <p className="text-sm text-muted-foreground">Dossier vide.</p>
            )}
            {d.items.map((it) => (
              <div key={it.riolexId} className="flex items-center gap-2 text-sm">
                <Link
                  href={`/partenaire/reglementation/${encodeURIComponent(it.riolexId)}`}
                  className="min-w-0 flex-1 truncate underline-offset-2 hover:underline"
                >
                  <span className="font-medium">Art. {it.articleNumber}</span>
                  <span className="text-muted-foreground"> — {it.loi} — {it.title}</span>
                </Link>
                <button
                  type="button"
                  onClick={() => removeFromDossier(d.id, it.riolexId)}
                  className="rounded p-0.5 text-muted-foreground hover:text-destructive print:hidden"
                  aria-label="Retirer"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
