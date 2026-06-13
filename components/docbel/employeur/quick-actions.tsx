"use client";

/**
 * Bloc « Actions rapides » du tableau de bord employeur, avec recherche
 * fonctionnelle : le champ filtre en direct les tuiles (insensible à la casse
 * et aux accents). Chaque tuile mène à une page réelle.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  Calculator,
  ClipboardList,
  FileText,
  FileSignature,
  FileCheck2,
  FolderOpen,
  BookOpen,
  CalendarDays,
} from "lucide-react";

const ACTIONS = [
  { id: "cout", label: "Simuler un coût", href: "/employeur/simulateur-cout", icon: Calculator },
  { id: "engagement", label: "Préparer un engagement", href: "/employeur/nouveau-dossier", icon: ClipboardList },
  { id: "contrat", label: "Générer un contrat", href: "/employeur/contrats", icon: FileSignature },
  { id: "document", label: "Préparer un document", href: "/employeur/documents", icon: FileText },
  { id: "fiche", label: "Vérifier une fiche", href: "/employeur/controle", icon: FileCheck2 },
  { id: "dossiers", label: "Mes dossiers", href: "/employeur/dossiers", icon: FolderOpen },
  { id: "calendrier", label: "Calendrier social", href: "/employeur/calendrier", icon: CalendarDays },
  { id: "biblio", label: "Bibliothèque", href: "/employeur/bibliotheque", icon: BookOpen },
];

/** minuscule + suppression des accents (insensible casse/diacritiques). */
const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

export function QuickActions({ dossiersBadge }: { dossiersBadge: number }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const n = norm(q.trim());
    if (!n) return ACTIONS;
    return ACTIONS.filter((a) => norm(a.label).includes(n));
  }, [q]);

  return (
    <section className="flex h-full flex-col p-5">
      <h2 className="text-base font-semibold tracking-tight">Actions rapides</h2>

      <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs transition-colors focus-within:border-primary/40">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher une action…"
          aria-label="Rechercher une action rapide"
          className="w-full bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
        />
        {q ? (
          <button
            type="button"
            onClick={() => setQ("")}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Effacer la recherche"
          >
            ✕
          </button>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-border bg-background/50 py-6 text-center text-xs text-muted-foreground">
          Aucune action ne correspond à « {q} ».
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {filtered.map((a) => {
            const Icon = a.icon;
            const badge = a.id === "dossiers" && dossiersBadge > 0 ? dossiersBadge : null;
            return (
              <Link
                key={a.id}
                href={a.href}
                className="group relative flex flex-col items-center gap-1.5 rounded-lg border border-border bg-background p-2.5 text-center no-underline transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                {badge !== null ? (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                    {badge > 99 ? "99+" : badge}
                  </span>
                ) : null}
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                  <Icon className="size-4" />
                </span>
                <span className="text-[11px] font-medium leading-tight">{a.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
