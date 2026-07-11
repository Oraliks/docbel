"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Info, CircleCheck, TriangleAlert, CircleAlert, X } from "lucide-react";
import { useSiteSettings } from "@/components/site-settings/site-settings-provider";
import {
  isAnnouncementLive,
  type AnnouncementLevel,
} from "@/lib/site-settings";

const STYLES: Record<
  AnnouncementLevel,
  { wrap: string; icon: typeof Info }
> = {
  info: {
    wrap: "bg-blue-500/10 text-blue-800 dark:text-blue-200 border-blue-500/25",
    icon: Info,
  },
  success: {
    wrap: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 border-emerald-500/25",
    icon: CircleCheck,
  },
  warning: {
    wrap: "bg-amber-500/15 text-amber-900 dark:text-amber-200 border-amber-500/30",
    icon: TriangleAlert,
  },
  critical: {
    wrap: "bg-red-500/10 text-red-800 dark:text-red-200 border-red-500/25",
    icon: CircleAlert,
  },
};

/**
 * Bannière d'annonce globale (haut des pages publiques). Pilotée par les
 * Paramètres globaux (admin). Rendue uniquement côté client après montage pour
 * éviter tout écart d'hydratation sur les bornes de planification. Masquable
 * pour la session (état local, non persisté).
 */
export function AnnouncementBanner() {
  const settings = useSiteSettings();
  const [now, setNow] = useState<Date | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setNow(new Date());
    // Réévalue les bornes de planification chaque minute.
    const t = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  if (!now || !settings || dismissed) return null;

  const a = settings.announcement;
  if (!isAnnouncementLive(a, now)) return null;

  // Périmètre : shell public (visiteurs anonymes + citoyens). Un ciblage
  // partenaire/employeur exclusif ne s'affiche donc pas ici.
  const targeted =
    a.segments.length === 0 ||
    a.segments.includes("public") ||
    a.segments.includes("citizen");
  if (!targeted) return null;

  const style = STYLES[a.level];
  const Icon = style.icon;

  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${style.wrap}`}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="[overflow-wrap:anywhere]">{a.message}</span>
        {a.linkHref && a.linkLabel && (
          <>
            {" "}
            <Link
              href={a.linkHref}
              className="font-semibold underline underline-offset-2 hover:opacity-80"
            >
              {a.linkLabel}
            </Link>
          </>
        )}
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Masquer l'annonce"
        className="shrink-0 rounded-md p-0.5 opacity-70 transition-opacity hover:opacity-100"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
