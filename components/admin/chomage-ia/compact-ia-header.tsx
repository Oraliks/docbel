/**
 * Header compact (1 ligne, ~48 px) pour le module Assistant IA Chômage.
 *
 * Remplace `ia-header.tsx` (qui empilait breadcrumb + titre + stats + tabs).
 * Ici : breadcrumb + 2 tabs centrés + stats inline + UsageBadge à droite.
 *
 * Server component (aucune logique interactive — UsageBadge est client mais
 * accepte d'être placé dans un server component).
 */

import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UsageBadge } from "@/components/admin/chomage-ia/usage-badge";

interface CompactIaHeaderProps {
  /** Onglet actif courant. */
  activeTab: "sources" | "chat";
  /** Stats inline (sources, conversations, prompts générés). */
  stats?: {
    sources?: number;
    enabledSources?: number;
    sessions?: number;
    prompts?: number;
  };
  /** Domaine pour le compteur de crédit IA (par défaut "chomage"). */
  domain?: string;
}

const TABS = [
  {
    id: "chat" as const,
    href: "/admin/chomage/ia/chat",
    label: "Chat",
    icon: MessageSquare,
  },
  {
    id: "sources" as const,
    href: "/admin/chomage/ia/sources",
    label: "Sources",
    icon: BookOpen,
  },
];

export function CompactIaHeader({
  activeTab,
  stats,
  domain = "chomage",
}: CompactIaHeaderProps) {
  return (
    <header
      role="banner"
      className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card/60 px-4 backdrop-blur-sm"
    >
      {/* Bloc gauche : breadcrumb + titre slim */}
      <div className="flex min-w-0 items-center gap-2">
        <Link
          href="/admin"
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-[11.5px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Retour au dashboard admin"
        >
          <ArrowLeft className="size-3.5" />
          <span className="hidden sm:inline">Retour</span>
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Sparkles className="size-3.5" />
          </span>
          <span className="text-[13px] font-bold leading-none">
            Assistant IA Chômage
          </span>
        </div>
      </div>

      {/* Tabs centrés (sous-élément flex-1) */}
      <nav
        role="tablist"
        aria-label="Sections IA chômage"
        className="ml-2 flex shrink-0 items-center gap-0.5 rounded-lg border border-border bg-background/80 p-0.5"
      >
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              role="tab"
              aria-selected={isActive}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-semibold transition-all",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="size-3.5" />
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Stats inline */}
      {stats ? (
        <div className="hidden flex-wrap items-center gap-1.5 lg:flex">
          {typeof stats.sources === "number" ? (
            <StatPill
              value={stats.sources}
              label={stats.sources > 1 ? "sources" : "source"}
              hint={
                typeof stats.enabledSources === "number"
                  ? `${stats.enabledSources} activée${stats.enabledSources > 1 ? "s" : ""}`
                  : undefined
              }
            />
          ) : null}
          {typeof stats.sessions === "number" ? (
            <StatPill
              value={stats.sessions}
              label={stats.sessions > 1 ? "conv." : "conv."}
            />
          ) : null}
          {typeof stats.prompts === "number" ? (
            <StatPill
              value={stats.prompts}
              label={stats.prompts > 1 ? "prompts" : "prompt"}
            />
          ) : null}
        </div>
      ) : null}

      {/* Crédit IA */}
      <UsageBadge domain={domain} />
    </header>
  );
}

function StatPill({
  value,
  label,
  hint,
}: {
  value: number;
  label: string;
  hint?: string;
}) {
  return (
    <span
      title={hint}
      className="inline-flex items-baseline gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] tabular-nums"
    >
      <span className="font-bold text-foreground">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}
