"use client";

// Bannière de consentement cookies (RGPD_QUEUE §1).
// - Barre compacte tant qu'aucune décision n'est prise.
// - Panneau « Personnaliser » inline (mêmes catégories) rouvrable depuis le
//   footer (« Gérer mes cookies ») même après décision.
// Montée hors `.glass-root` (niveau racine) → on stylise via les tokens
// `--glass-*` (définis sur :root/.dark) plutôt que par héritage.

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { CookieIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useConsent } from "@/components/cookie-consent/consent-provider";

export function CookieBanner() {
  const t = useTranslations("public.cookieConsent");
  const pathname = usePathname();
  const { consent, bannerOpen, prefsOpen, acceptAll, rejectAll, save, openPreferences } =
    useConsent();

  // Hors front public : pas de bannière (les traceurs ne tournent pas en /admin,
  // qui suit le design shadcn). Aligné sur WelcomeLocaleModal.
  if (pathname?.startsWith("/admin")) return null;
  if (!bannerOpen && !prefsOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={t("title")}
      // Conteneur pleine largeur ancré en bas : `pointer-events-none` pour que
      // ses gouttières transparentes latérales n'avalent PAS les clics sur le
      // contenu situé derrière (liens catalogue, footer…). La carte réactive
      // les pointer-events (`pointer-events-auto`) pour ses propres boutons.
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center px-3 pb-3 sm:px-4 sm:pb-4"
    >
      <div
        className="glass-surface-strong animate-fade-in-up pointer-events-auto w-full max-w-3xl rounded-2xl p-4 sm:p-5"
        style={{ color: "var(--glass-ink)" }}
      >
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full"
            style={{ background: "var(--glass-pop-bg)", color: "var(--glass-pop-fg)" }}
          >
            <CookieIcon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{t("title")}</p>
            <p
              className="mt-1 text-[13px] leading-relaxed"
              style={{ color: "var(--glass-ink-soft)" }}
            >
              {t("description")}{" "}
              <Link
                href="/politique-confidentialite"
                className="font-semibold underline underline-offset-2"
                style={{ color: "var(--glass-ink)" }}
              >
                {t("learnMore")}
              </Link>
            </p>
          </div>
        </div>

        {prefsOpen ? (
          // Monté UNIQUEMENT quand le panneau est ouvert → l'initialisateur
          // useState ré-amorce le switch sur le consentement courant à chaque
          // ouverture, sans setState dans un effet.
          <PreferencesPanel
            initialAnalytics={consent?.analytics ?? false}
            onSave={save}
            onReject={rejectAll}
            onAccept={acceptAll}
          />
        ) : (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <Button
              variant="ghost"
              size="lg"
              onClick={openPreferences}
              className="w-full sm:mr-auto sm:w-auto"
              style={{ color: "var(--glass-ink-soft)" }}
            >
              {t("customize")}
            </Button>
            <RejectAcceptButtons t={t} onReject={rejectAll} onAccept={acceptAll} />
          </div>
        )}
      </div>
    </div>
  );
}

function PreferencesPanel({
  initialAnalytics,
  onSave,
  onReject,
  onAccept,
}: {
  initialAnalytics: boolean;
  onSave: (choices: { analytics: boolean }) => void;
  onReject: () => void;
  onAccept: () => void;
}) {
  const t = useTranslations("public.cookieConsent");
  const [analytics, setAnalytics] = useState(initialAnalytics);

  return (
    <>
      <div className="mt-4 flex flex-col gap-2 rounded-xl p-1" aria-label={t("prefsTitle")}>
        <CategoryRow
          title={t("necessaryTitle")}
          desc={t("necessaryDesc")}
          locked
          lockedLabel={t("alwaysOn")}
        />
        <CategoryRow
          title={t("analyticsTitle")}
          desc={t("analyticsDesc")}
          checked={analytics}
          onChange={setAnalytics}
        />
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        <Button
          variant="ghost"
          size="lg"
          onClick={() => onSave({ analytics })}
          className="w-full sm:mr-auto sm:w-auto"
          style={{ color: "var(--glass-ink)" }}
        >
          {t("save")}
        </Button>
        <RejectAcceptButtons t={t} onReject={onReject} onAccept={onAccept} />
      </div>
    </>
  );
}

// « Tout refuser » et « Tout accepter » au MÊME rang visuel (exigence APD).
function RejectAcceptButtons({
  t,
  onReject,
  onAccept,
}: {
  t: ReturnType<typeof useTranslations>;
  onReject: () => void;
  onAccept: () => void;
}) {
  return (
    <>
      <Button
        variant="outline"
        size="lg"
        onClick={onReject}
        className="w-full border-[color:var(--glass-border)] bg-transparent sm:w-auto"
        style={{ color: "var(--glass-ink)" }}
      >
        {t("reject")}
      </Button>
      <Button
        size="lg"
        onClick={onAccept}
        className="w-full sm:w-auto"
        style={{ background: "var(--glass-ink)", color: "var(--glass-bg-a)" }}
      >
        {t("accept")}
      </Button>
    </>
  );
}

function CategoryRow({
  title,
  desc,
  checked,
  onChange,
  locked,
  lockedLabel,
}: {
  title: string;
  desc: string;
  checked?: boolean;
  onChange?: (v: boolean) => void;
  locked?: boolean;
  lockedLabel?: string;
}) {
  return (
    <div
      className="flex items-center justify-between gap-4 rounded-xl px-3 py-2.5"
      style={{ background: "var(--glass-surface)" }}
    >
      <div className="min-w-0">
        <p className="text-[13px] font-semibold" style={{ color: "var(--glass-ink)" }}>
          {title}
        </p>
        <p className="text-xs" style={{ color: "var(--glass-ink-faint)" }}>
          {desc}
        </p>
      </div>
      {locked ? (
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
          style={{ background: "var(--glass-pop-bg)", color: "var(--glass-pop-fg)" }}
        >
          {lockedLabel}
        </span>
      ) : (
        <Switch
          checked={checked}
          onCheckedChange={onChange}
          aria-label={title}
          className="shrink-0"
        />
      )}
    </div>
  );
}
