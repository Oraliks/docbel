"use client";

import {
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FlaskConical,
  Globe,
  Pencil,
  Users,
  XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { OrganizationGroup } from "./types";

interface PartnerOverviewCardProps {
  org: OrganizationGroup;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onRename: () => void;
}

/**
 * Card horizontale compacte d'une organisation partenaire.
 *
 * Pattern aligné sur `news-overview-card.tsx` et
 * `calculateurs/overview/overview-card.tsx` — densité verticale max,
 * icône tile à gauche, badge à droite. La différence : ici la card est
 * collapsable (pas de navigation vers une page détail, car l'UX existante
 * de partner-domains-manager est inline).
 *
 * Cliquer sur la card :
 *   - toggle l'expansion (les domaines + users s'affichent en-dessous)
 *
 * Le bouton "renommer" (crayon à droite) ouvre un dialog géré par le shell.
 */
export function PartnerOverviewCard({
  org,
  isExpanded,
  onToggleExpanded,
  onRename,
}: PartnerOverviewCardProps) {
  const t = useTranslations("admin.partenaires");
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggleExpanded}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggleExpanded();
        }
      }}
      aria-expanded={isExpanded}
      className={cn(
        "group relative flex w-full cursor-pointer items-center gap-3 rounded-xl border border-border bg-card p-3 transition-all",
        "hover:bg-muted/40 hover:border-primary/30 hover:shadow-sm",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {/* Chevron expand state */}
      <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground">
        {isExpanded ? (
          <ChevronDown className="size-3.5" />
        ) : (
          <ChevronRight className="size-3.5" />
        )}
      </span>

      {/* Tile icône organisation -------------------------------------- */}
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          org.isActive
            ? "bg-violet-500/10 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
            : "bg-slate-500/10 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
        )}
      >
        <Building2 className="size-4" />
      </div>

      {/* Nom + sous-ligne (counters) ---------------------------------- */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate text-[13.5px] font-semibold text-foreground group-hover:text-primary">
            {org.organizationName}
          </p>
          {org.hasTestDomain ? (
            <Badge
              variant="outline"
              className="gap-1 border-amber-200 bg-amber-50 px-1.5 py-0 text-[10px] font-bold uppercase text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
            >
              <FlaskConical className="size-2.5" />
              {t("badgeTest")}
            </Badge>
          ) : null}
        </div>
        <p className="flex items-center gap-3 text-[11.5px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Globe className="size-2.5" />
            {t("accessCount", { count: org.domainCount })}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="size-2.5" />
            {t("userCount", { count: org.userCount })}
          </span>
        </p>
      </div>

      {/* Badge statut + bouton renommer -------------------------------- */}
      <div className="flex shrink-0 items-center gap-2">
        {org.isActive ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
            <CheckCircle2 className="size-2.5" />
            {t("badgeActive")}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-500/30 bg-slate-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-700 dark:bg-slate-500/15 dark:text-slate-300">
            <XCircle className="size-2.5" />
            {t("badgeInactive")}
          </span>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRename();
          }}
          aria-label={t("renameOrgAria", { name: org.organizationName })}
          title={t("renameOrgTitle")}
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <Pencil className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
