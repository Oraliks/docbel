/**
 * Bandeau affiché quand le toggle AI_HELP_ENABLED est désactivé OU quand la
 * variable ANTHROPIC_API_KEY est manquante.
 *
 * L'admin garde l'accès à toute l'UI (gestion sources, lecture historique),
 * mais le chat et le prompt-builder afficheront un état "désactivé" gracieux.
 */

import Link from "next/link";
import { AlertCircle, Settings, KeyRound } from "lucide-react";
import { getTranslations } from "next-intl/server";

interface AiDisabledBannerProps {
  /** Toggle DB (`SETTING_KEYS.AI_HELP_ENABLED`) — true si activé. */
  enabled: boolean;
  /** True si `ANTHROPIC_API_KEY` est définie côté serveur. */
  hasKey: boolean;
}

export async function AiDisabledBanner({ enabled, hasKey }: AiDisabledBannerProps) {
  if (enabled && hasKey) return null;

  const t = await getTranslations("admin.chomageIa");

  const reason: string[] = [];
  if (!enabled) reason.push(t("aiDisabledReasonToggle"));
  if (!hasKey) reason.push(t("aiDisabledReasonKey"));

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-amber-300/60 bg-amber-50/40 p-4 text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-200">
      <div className="flex items-start gap-2.5">
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        <div className="flex flex-col gap-1">
          <div className="text-[13px] font-bold">{t("aiDisabledTitle")}</div>
          <p className="text-[12.5px] leading-relaxed">
            {t("aiDisabledBody", { reason: reason.join(t("and")) })}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {!enabled ? (
          <Link
            href="/admin/documents/settings?tab=ai"
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-background/60 px-3 py-1.5 text-[12.5px] font-semibold hover:bg-background/80"
          >
            <Settings className="size-3.5" />
            {t("aiDisabledEnableCta")}
          </Link>
        ) : null}
        {!hasKey ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-background/50 px-3 py-1.5 text-[12.5px] font-semibold opacity-80">
            <KeyRound className="size-3.5" />
            {t("aiDisabledKeyMissing")}
          </span>
        ) : null}
      </div>
    </div>
  );
}
