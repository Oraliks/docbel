/**
 * Header partagé des pages du module Assistant IA Chômage.
 *
 * Server component. Affiche le breadcrumb, le titre, le sous-titre et la
 * navigation interne (3 onglets : Sources / Chat / Générateur).
 */

import Link from "next/link";
import { ArrowLeft, Sparkles, MessageSquare, BookOpen, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { UsageBadge } from "@/components/admin/chomage-ia/usage-badge";

interface IaHeaderProps {
  /** Onglet actif courant. */
  activeTab: "sources" | "chat" | "prompt-builder";
  /** Stats optionnelles à afficher à droite ("sources" count, "sessions" count). */
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
    id: "sources" as const,
    href: "/admin/chomage/ia/sources",
    label: "Sources",
    icon: BookOpen,
  },
  {
    id: "chat" as const,
    href: "/admin/chomage/ia/chat",
    label: "Chat",
    icon: MessageSquare,
  },
  {
    id: "prompt-builder" as const,
    href: "/admin/chomage/ia/prompt-builder",
    label: "Générateur",
    icon: Wand2,
  },
];

export function IaHeader({ activeTab, stats, domain = "chomage" }: IaHeaderProps) {
  return (
    <header className="flex flex-col gap-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
        <Link
          href="/admin/chomage/outils"
          className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          Retour Chômage
        </Link>
        <span>/</span>
        <span className="truncate">Assistant IA</span>
      </nav>

      {/* Titre + stats + crédit IA */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold leading-tight">
              Assistant IA Chômage
            </h1>
            <p className="text-sm text-muted-foreground">
              Knowledge base + chat sourcé + générateur de prompts Claude Code.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {stats ? (
            <div className="flex flex-wrap items-center gap-2 text-[12px]">
              {typeof stats.sources === "number" ? (
                <Pill
                  label={`${stats.sources} source${stats.sources > 1 ? "s" : ""}`}
                  tone="muted"
                  title={
                    typeof stats.enabledSources === "number"
                      ? `${stats.enabledSources} activée${stats.enabledSources > 1 ? "s" : ""}`
                      : undefined
                  }
                />
              ) : null}
              {typeof stats.sessions === "number" ? (
                <Pill
                  label={`${stats.sessions} conversation${stats.sessions > 1 ? "s" : ""}`}
                  tone="muted"
                />
              ) : null}
              {typeof stats.prompts === "number" ? (
                <Pill
                  label={`${stats.prompts} prompt${stats.prompts > 1 ? "s" : ""}`}
                  tone="muted"
                />
              ) : null}
            </div>
          ) : null}
          <UsageBadge domain={domain} />
        </div>
      </div>

      {/* Tabs */}
      <nav
        role="tablist"
        aria-label="Sections IA chômage"
        className="-mx-1 flex flex-wrap items-end gap-1 overflow-x-auto border-b border-border"
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
                "relative inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-[13px] font-medium transition-colors",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-3.5" />
              {tab.label}
              <span
                aria-hidden
                className={cn(
                  "absolute inset-x-2 -bottom-px h-0.5 rounded-full transition-colors",
                  isActive ? "bg-primary" : "bg-transparent"
                )}
              />
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

function Pill({
  label,
  tone,
  title,
}: {
  label: string;
  tone: "muted" | "primary";
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        tone === "primary"
          ? "bg-primary/10 text-primary"
          : "bg-muted text-muted-foreground"
      )}
    >
      {label}
    </span>
  );
}
