"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRightIcon, XIcon } from "lucide-react";
import { FolderOpen } from "@phosphor-icons/react";

/**
 * Clé sessionStorage ET nom du cookie de session posés à la fermeture (✕).
 * Le cookie jumeau permet au serveur (lib/landing/resume.ts) de ne plus
 * rendre la bande au prochain chargement complet → pas de mismatch
 * d'hydratation entre le HTML serveur et le premier rendu client.
 */
const DISMISS_KEY = "docbel-resume-dismissed";

/**
 * Données du dossier en cours — type local (mêmes champs que
 * `ActiveBundleRun` de lib/landing/resume.ts) pour ne pas importer un
 * module serveur (next/headers, prisma) depuis un composant client.
 */
export interface ResumeStripRun {
  slug: string;
  name: string;
  color: string;
  completed: number;
  total: number;
  startedAt: string;
}

interface ResumeStripProps {
  run: ResumeStripRun;
}

/** Lecture SSR-safe du flag de fermeture (navigation privée : peut jeter). */
function readDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Bande fine « Reprenez votre dossier » — posée au-dessus du hero de la home
 * quand un parcours (BundleRun) est en cours. Fermable pour la session de
 * navigation (✕ → sessionStorage + cookie de session), progression animée à
 * l'apparition, entrée fadeInUp ; tout est neutralisé par
 * prefers-reduced-motion via les utilitaires motion-reduce.
 */
export function ResumeStrip({ run }: ResumeStripProps) {
  // Initialisation paresseuse (SSR-safe) : pas d'accès à window côté serveur.
  const [dismissed, setDismissed] = useState<boolean>(readDismissed);
  // Pilote la transition de largeur de la barre de progression : false au
  // premier rendu (barre à 0 %), passe à true après montage.
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    // Double rAF : on laisse le navigateur peindre la barre à 0 % avant de
    // déclencher la transition de largeur (sinon elle apparaît sans
    // animation). setState dans un callback rAF = asynchrone → conforme à
    // react-hooks/set-state-in-effect.
    let second = 0;
    const first = window.requestAnimationFrame(() => {
      second = window.requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      window.cancelAnimationFrame(first);
      window.cancelAnimationFrame(second);
    };
  }, []);

  if (dismissed) return null;

  const pct =
    run.total > 0
      ? Math.min(100, Math.round((run.completed / run.total) * 100))
      : 0;
  const plural = run.completed > 1 ? "s" : "";

  const dismiss = () => {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Stockage indisponible (navigation privée) : on masque quand même
      // pour ce rendu, le cookie ci-dessous prend le relais côté serveur.
    }
    // Cookie de session jumeau (sans expiration → meurt avec le navigateur,
    // comme sessionStorage) : le serveur ne re-rendra pas la bande.
    document.cookie = `${DISMISS_KEY}=1; path=/; SameSite=Lax`;
  };

  return (
    <aside
      aria-label={`Dossier en cours : ${run.name}`}
      className="glass-surface relative flex w-full animate-[fadeInUp_0.45s_ease] flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 motion-reduce:animate-none sm:flex-nowrap sm:px-5"
    >
      {/* Pastille dossier — accent violet, icône Phosphor duotone. */}
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-xl"
        style={{
          background:
            "color-mix(in oklab, var(--glass-accent-deep) 14%, transparent)",
        }}
      >
        <FolderOpen
          weight="duotone"
          size={22}
          color="var(--glass-accent-deep)"
        />
      </span>

      {/* Texte + barre de progression fine. */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] leading-snug text-[color:var(--glass-ink-soft)]">
          <span className="font-bold text-[color:var(--glass-ink)]">
            Reprenez votre dossier «&nbsp;{run.name}&nbsp;»
          </span>
          <span className="hidden sm:inline">
            {" — "}
            {run.completed} document{plural} sur {run.total} complété{plural}
          </span>
        </p>
        {/* Sur mobile, le compte passe sous le titre plutôt que d'être tronqué. */}
        <p className="text-[11.5px] text-[color:var(--glass-ink-faint)] sm:hidden">
          {run.completed} document{plural} sur {run.total} complété{plural}
        </p>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={run.total}
          aria-valuenow={run.completed}
          aria-label={`Progression : ${run.completed} document${plural} sur ${run.total}`}
          className="mt-1.5 h-1 w-full max-w-[420px] overflow-hidden rounded-full"
          style={{
            background:
              "color-mix(in oklab, var(--glass-accent-deep) 14%, transparent)",
          }}
        >
          <div
            className="h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none"
            style={{
              width: entered ? `${pct}%` : "0%",
              background: "var(--glass-accent-deep)",
            }}
          />
        </div>
      </div>

      {/* CTA reprendre + fermer. */}
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href={`/d/${run.slug}`}
          className="glass-cta inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-bold"
        >
          Reprendre
          <ArrowRightIcon className="size-3.5" />
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Masquer cette bande pour cette session"
          className="inline-flex size-8 items-center justify-center rounded-full text-[color:var(--glass-ink-faint)] transition-colors hover:bg-white/50 hover:text-[color:var(--glass-ink)] focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)] focus-visible:outline-none motion-reduce:transition-none dark:hover:bg-white/10"
        >
          <XIcon className="size-4" />
        </button>
      </div>
    </aside>
  );
}
