import Link from "next/link";
import { ClockIcon, SparklesIcon, LockIcon, WrenchIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

/**
 * Vue affichée quand le module Formations n'est pas pleinement accessible
 * (maintenance / coming_soon / forbidden). Le cas `hidden` est géré par
 * notFound() dans la page. Style glass (espace public).
 */
export async function ModuleGate({
  access,
  maintenanceMessage,
}: {
  access: "maintenance" | "coming_soon" | "forbidden";
  maintenanceMessage?: string | null;
}) {
  const t = await getTranslations("public.formations");
  const cfg = {
    maintenance: {
      Icon: WrenchIcon,
      title: t("gateMaintenanceTitle"),
      text: maintenanceMessage || t("gateMaintenanceText"),
    },
    coming_soon: {
      Icon: SparklesIcon,
      title: t("gateComingSoonTitle"),
      text: t("gateComingSoonText"),
    },
    forbidden: {
      Icon: LockIcon,
      title: t("gateForbiddenTitle"),
      text: t("gateForbiddenText"),
    },
  }[access];

  const { Icon } = cfg;

  return (
    <div className="flex flex-col gap-6">
      <section className="glass-surface flex flex-col items-center gap-4 px-6 py-20 text-center">
        <span className="glass-icon-tile flex size-16 items-center justify-center rounded-2xl bg-[color:var(--glass-surface-strong)] text-[color:var(--glass-accent-deep)]">
          <Icon className="size-8" />
        </span>
        <h1 className="glass-display text-[26px] font-semibold">{cfg.title}</h1>
        <p className="max-w-md text-[14px] leading-[1.6] text-[color:var(--glass-ink-soft)]">{cfg.text}</p>
        <Link
          href="/"
          className="glass-cta mt-1 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-bold"
        >
          <ClockIcon className="size-4" />
          {t("gateBackHome")}
        </Link>
      </section>
    </div>
  );
}
