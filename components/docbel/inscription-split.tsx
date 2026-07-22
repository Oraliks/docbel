"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowLeftIcon, Building2Icon, HandshakeIcon } from "lucide-react";
import {
  SignupForm,
  type ExpectedSegment,
} from "@/components/docbel/partner-signup-form";

/**
 * Couleurs/dégradés par segment (non traduisibles). Les libellés (badge,
 * tagline) sont résolus via i18n (`public.auth.split*`) au rendu.
 */
const THEME: Record<
  ExpectedSegment,
  { bg: string; accent: string }
> = {
  partenaire: {
    bg: "radial-gradient(ellipse at 30% 30%, var(--glass-accent-d) 0%, transparent 60%), linear-gradient(135deg, var(--glass-accent-c) 0%, var(--glass-accent-a) 60%, var(--glass-accent-deep) 100%)",
    accent: "#6D28D9",
  },
  employeur: {
    bg: "radial-gradient(ellipse at 30% 30%, rgba(94,234,212,0.45) 0%, transparent 60%), linear-gradient(135deg, #2DD4BF 0%, #0F766E 60%, #134E4A 100%)",
    accent: "#0F766E",
  },
};

export function InscriptionSplit() {
  const t = useTranslations("public.auth");
  const [segment, setSegment] = useState<ExpectedSegment>("partenaire");
  const theme = THEME[segment];
  const badge =
    segment === "partenaire" ? t("splitBadgePartner") : t("splitBadgeEmployer");
  const tagline =
    segment === "partenaire"
      ? t("splitTaglinePartner")
      : t("splitTaglineEmployer");

  return (
    <div className="glass-root">
      <div className="grid min-h-screen w-full lg:grid-cols-[1fr_1.1fr]">
        {/* ---------------- Aside visuel (plein écran, recoloré selon le segment) ---------------- */}
        <aside
          className="relative hidden items-center justify-center overflow-hidden p-10 transition-[background] duration-500 lg:flex"
          style={{ backgroundImage: theme.bg }}
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 80% 80%, rgba(255,255,255,0.5) 0%, transparent 40%)",
            }}
          />
          <div className="relative flex flex-col items-center gap-6 text-center text-white">
            {/* Maquette "document" (reprise de /login) */}
            <div className="relative">
              <div className="relative flex h-[280px] w-[220px] -rotate-6 flex-col gap-3 rounded-2xl bg-white/95 p-5 shadow-[0_18px_50px_rgba(40,15,80,0.30)]">
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className="text-[10px] font-extrabold tracking-[0.12em]"
                    style={{ color: theme.accent }}
                  >
                    DOCBEL
                  </span>
                  <span
                    className="text-[10px] font-bold"
                    style={{ color: theme.accent }}
                  >
                    ● ● ●
                  </span>
                </div>
                <div className="h-1.5 w-3/4 rounded-full bg-black/10" />
                <div className="h-1.5 rounded-full bg-black/10" />
                <div className="h-1.5 w-1/2 rounded-full bg-black/10" />
                <div className="h-1.5 rounded-full bg-black/10" />
                <div className="h-1.5 w-3/4 rounded-full bg-black/10" />
                <div
                  className="absolute right-3 bottom-3 size-10 rounded-xl transition-colors duration-500"
                  style={{ background: theme.accent }}
                />
              </div>
              <div className="absolute -right-12 top-32 flex w-[140px] -rotate-[10deg] flex-col gap-1.5 rounded-xl bg-white/95 p-3 shadow-[0_12px_30px_rgba(40,15,80,0.25)] rotate-[10deg]">
                <div className="h-1 rounded-full bg-black/10" />
                <div className="h-1 w-1/2 rounded-full bg-black/10" />
                <div className="h-1 w-3/4 rounded-full bg-black/10" />
              </div>
            </div>

            <div
              key={segment}
              className="relative max-w-sm"
              style={{
                animation: "fadeInUp 0.5s cubic-bezier(0.22,1,0.36,1) both",
              }}
            >
              <span className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ring-1 ring-white/25 backdrop-blur-sm">
                {segment === "partenaire" ? (
                  <HandshakeIcon className="size-3.5" />
                ) : (
                  <Building2Icon className="size-3.5" />
                )}
                {badge}
              </span>
              <p className="glass-display text-[28px] font-semibold leading-tight">
                {t("asideTitleLead")}{" "}
                <em className="not-italic text-white/90">
                  {t("asideTitleEm")}
                </em>
              </p>
              <p className="mt-3 text-[14px] text-white/80">{tagline}</p>
            </div>
          </div>
        </aside>

        {/* ---------------- Colonne formulaire ---------------- */}
        <main className="relative flex flex-col p-6 sm:p-10 lg:p-14">
          <Link
            href="/"
            className="inline-flex w-fit items-center gap-2 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-4 py-2 text-[12.5px] font-semibold text-[color:var(--glass-ink-soft)] transition hover:bg-[color:var(--glass-surface-strong)]"
          >
            <ArrowLeftIcon className="size-4" />
            {t("backToHome")}
          </Link>

          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
            <header className="mb-6 flex flex-col gap-2 text-center sm:text-left">
              <h1 className="glass-display text-[40px] font-semibold leading-[1.05] sm:text-[48px]">
                {t("splitTitle")}
              </h1>
              <p className="text-[14px] text-[color:var(--glass-ink-soft)]">
                {t("splitSubtitle")}
              </p>
            </header>

            {/* Switch Partenaire / Employeur — bien visible */}
            <div className="mb-6 flex flex-col gap-2">
              <span className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-[color:var(--glass-ink-soft)]">
                {t("splitRegisterAs")}
              </span>
              <div
                role="tablist"
                aria-label={t("splitAccountType")}
                className="inline-flex w-full gap-1 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-1"
              >
                <SegTab
                  active={segment === "partenaire"}
                  onClick={() => setSegment("partenaire")}
                  Icon={HandshakeIcon}
                  label={t("splitTabPartner")}
                  accent={THEME.partenaire.accent}
                />
                <SegTab
                  active={segment === "employeur"}
                  onClick={() => setSegment("employeur")}
                  Icon={Building2Icon}
                  label={t("splitTabEmployer")}
                  accent={THEME.employeur.accent}
                />
              </div>
            </div>

            <SignupForm
              expectedSegment={segment}
              framed={false}
              onSwitchSegment={setSegment}
            />

            <p className="mt-6 text-center text-[12.5px] text-[color:var(--glass-ink-soft)]">
              {t("splitHaveAccount")}{" "}
              <Link
                href="/login"
                className="font-bold text-[color:var(--glass-accent-deep)] hover:underline"
              >
                {t("signIn")}
              </Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

function SegTab({
  active,
  onClick,
  Icon,
  label,
  accent,
}: {
  active: boolean;
  onClick: () => void;
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  accent: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-[13.5px] font-bold transition-all duration-200 ${
        active
          ? "text-white shadow-sm"
          : "text-[color:var(--glass-ink-soft)] hover:text-[color:var(--glass-ink)]"
      }`}
      style={active ? { background: accent } : undefined}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}
