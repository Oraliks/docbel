"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRightIcon, XIcon } from "lucide-react";
import { useAuthSession } from "@/components/auth-session-provider";

interface AlreadyLoggedInBannerProps {
  /** Chemin de destination (ex: `/partenaire`, `/employeur`). */
  targetPath: string;
  /** Libellé humain de la destination (ex: "votre espace partenaire"). */
  label: string;
}

/**
 * Bannière informative affichée en haut des landings `/p/*` quand un
 * utilisateur connecté arrive sur la page marketing. NE force PAS de redirect
 * (« informatif jamais bloquant ») : propose juste un lien direct vers son
 * espace et reste fermable. Si pas de session, retourne null.
 */
export function AlreadyLoggedInBanner({
  targetPath,
  label,
}: AlreadyLoggedInBannerProps) {
  const t = useTranslations("public.home");
  const { data: session } = useAuthSession();
  const [dismissed, setDismissed] = useState(false);

  if (!session?.user || dismissed) return null;

  return (
    <div
      role="status"
      className="glass-surface flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-[13px]"
      style={{
        borderColor: "color-mix(in oklab, var(--glass-accent-deep) 22%, transparent)",
        background:
          "linear-gradient(135deg, color-mix(in oklab, var(--glass-accent-a) 14%, var(--glass-surface)) 0%, color-mix(in oklab, var(--glass-accent-c) 10%, var(--glass-surface)) 100%)",
      }}
    >
      <div className="flex flex-wrap items-center gap-2 text-[color:var(--glass-ink-soft)]">
        <span
          className="inline-flex size-2 rounded-full"
          style={{ background: "var(--glass-accent-deep)" }}
          aria-hidden
        />
        <span>
          {t("loggedInNotice")}
        </span>
        <Link
          href={targetPath}
          className="inline-flex items-center gap-1.5 font-bold text-[color:var(--glass-ink)] underline decoration-[color:var(--glass-accent-deep)] decoration-2 underline-offset-4 transition hover:opacity-80"
        >
          {t("loggedInAccess", { label })}
          <ArrowRightIcon className="size-3.5" strokeWidth={2.4} />
        </Link>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label={t("bannerClose")}
        className="inline-flex size-7 items-center justify-center rounded-full text-[color:var(--glass-ink-faint)] transition hover:bg-[color:var(--glass-surface)] hover:text-[color:var(--glass-ink)]"
      >
        <XIcon className="size-3.5" strokeWidth={2.4} />
      </button>
    </div>
  );
}
