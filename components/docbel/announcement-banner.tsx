"use client";

import { useState } from "react";
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
    wrap: "bg-[color:var(--glass-info)] text-[color:var(--info-foreground)]",
    icon: Info,
  },
  success: {
    wrap: "bg-[color:var(--glass-success)] text-[color:var(--success-foreground)]",
    icon: CircleCheck,
  },
  warning: {
    wrap: "bg-[color:var(--glass-warning)] text-[color:var(--attention-foreground)]",
    icon: TriangleAlert,
  },
  critical: {
    wrap: "bg-[color:var(--destructive)] text-[color:var(--destructive-foreground)]",
    icon: CircleAlert,
  },
};

/**
 * Bandeau d'annonce global — barre pleine largeur collée en haut des pages
 * publiques (style « promo bar » Shopify). Piloté par les Paramètres globaux
 * (admin). Rendu côté serveur (aucune dépendance au temps) → pas de saut de
 * mise en page. La croix de fermeture n'apparaît que si l'admin l'autorise
 * (`announcement.dismissible`) ; le masquage est local à la session.
 */
export function AnnouncementBanner() {
  const settings = useSiteSettings();
  const [dismissed, setDismissed] = useState(false);

  if (!settings || dismissed) return null;

  const a = settings.announcement;
  if (!isAnnouncementLive(a)) return null;

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
    <div role="status" className={`relative w-full ${style.wrap}`}>
      <div className="mx-auto flex w-full max-w-[1840px] items-center justify-center gap-2.5 px-10 py-2.5 text-center text-sm font-medium">
        <Icon className="size-4 shrink-0" />
        <span className="[overflow-wrap:anywhere]">
          {a.message}
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
        </span>
      </div>
      {a.dismissible && (
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Masquer l'annonce"
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 opacity-80 transition hover:bg-black/10 hover:opacity-100"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
