"use client";

import Link from "next/link";
import { BellIcon, SparklesIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useChangelogNotifications,
  type ChangelogNotification,
} from "@/hooks/useChangelogNotifications";

const TYPE_LABEL_KEYS: Record<ChangelogNotification["type"], string> = {
  feature: "notifTypeFeature",
  fix: "notifTypeFix",
  improvement: "notifTypeImprovement",
  breaking: "notifTypeBreaking",
};

const TYPE_DOT: Record<ChangelogNotification["type"], string> = {
  feature: "bg-[color:var(--chart-3)]",
  fix: "bg-[color:var(--chart-5)]",
  improvement: "bg-[color:var(--chart-2)]",
  breaking: "bg-[color:var(--chart-1)]",
};

export function NotificationBell() {
  const t = useTranslations("public.chrome");
  const locale = useLocale();
  const { entries, unreadCount, lastSeenAt, loading, markAllRead } =
    useChangelogNotifications();

  const formatRelative = (iso: string) => {
    const diffMs = Date.now() - new Date(iso).getTime();
    const minutes = Math.round(diffMs / 60_000);
    if (minutes < 1) return t("notifRelativeNow");
    if (minutes < 60) return t("notifRelativeMin", { value: minutes });
    const hours = Math.round(minutes / 60);
    if (hours < 24) return t("notifRelativeHour", { value: hours });
    const days = Math.round(hours / 24);
    if (days < 30) return t("notifRelativeDay", { value: days });
    const dateLocale = locale === "nl" ? "nl-BE" : locale === "en" ? "en-GB" : "fr-BE";
    return new Date(iso).toLocaleDateString(dateLocale, {
      day: "numeric",
      month: "short",
    });
  };

  const ariaLabel =
    unreadCount > 0
      ? t("notifAriaLabelUnread", { count: unreadCount })
      : t("notifAriaLabel");

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open && unreadCount > 0) markAllRead();
      }}
    >
      <DropdownMenuTrigger
        aria-label={ariaLabel}
        className="relative flex size-10 items-center justify-center rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] text-[color:var(--glass-ink)] transition-colors hover:bg-white/55 dark:hover:bg-white/10"
      >
        <BellIcon className="size-4" />
        {unreadCount > 0 ? (
          <span
            className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
            style={{
              background: "var(--glass-accent-deep)",
              boxShadow: "0 0 0 2px var(--glass-surface)",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="glass-popup glass-surface-strong w-[340px] border-0 p-2 text-[color:var(--glass-ink)]"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center justify-between px-3 pt-2 pb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[color:var(--glass-ink-faint)]">
              {t("notifWhatsNew")}
            </span>
            {unreadCount > 0 ? (
              <span className="text-[10px] font-bold text-[color:var(--glass-accent-deep)]">
                {t("notifUnreadCount", { count: unreadCount })}
              </span>
            ) : null}
          </DropdownMenuLabel>
        </DropdownMenuGroup>

        {loading && entries.length === 0 ? (
          <div className="px-3 py-6 text-center text-[12px] text-[color:var(--glass-ink-soft)]">
            {t("notifLoading")}
          </div>
        ) : entries.length === 0 ? (
          <div className="px-3 py-6 text-center text-[12px] text-[color:var(--glass-ink-soft)]">
            {t("notifEmpty")}
          </div>
        ) : (
          <div className="flex flex-col">
            {entries.map((entry) => {
              const isUnread =
                new Date(entry.publishedAt).getTime() > lastSeenAt;
              return (
                <DropdownMenuItem
                  key={entry.id}
                  render={<Link href={`/changelog#v${entry.version}`} />}
                  className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors data-[highlighted]:bg-white/40 dark:data-[highlighted]:bg-white/5"
                >
                  <span
                    aria-hidden
                    className={`mt-1 inline-block size-2 shrink-0 rounded-full ${TYPE_DOT[entry.type]}`}
                  />
                  <div className="flex min-w-0 flex-1 flex-col leading-tight">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[color:var(--glass-ink-faint)]">
                        {t(TYPE_LABEL_KEYS[entry.type] as Parameters<typeof t>[0])} · v{entry.version}
                      </span>
                      {isUnread ? (
                        <span className="ml-auto inline-flex size-1.5 rounded-full bg-[color:var(--glass-accent-deep)]" />
                      ) : null}
                    </div>
                    <span className="mt-0.5 truncate text-[13px] font-semibold">
                      {entry.title}
                    </span>
                    <span className="text-[11px] text-[color:var(--glass-ink-soft)]">
                      {formatRelative(entry.publishedAt)}
                    </span>
                  </div>
                </DropdownMenuItem>
              );
            })}
          </div>
        )}

        <DropdownMenuSeparator className="my-1 bg-[color:var(--glass-ink-line)]" />
        <DropdownMenuItem
          render={<Link href="/changelog" />}
          className="flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-[12px] font-semibold text-[color:var(--glass-accent-deep)] data-[highlighted]:bg-white/40 dark:data-[highlighted]:bg-white/5"
        >
          <SparklesIcon className="size-3.5" />
          {t("notifSeeAllHistory")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
