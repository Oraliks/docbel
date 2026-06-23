import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Wrench, ArrowLeft } from "lucide-react";

interface Props {
  toolName: string;
}

/**
 * Vue présentée quand un outil existe en DB mais a été désactivé par l'admin
 * (active=false). Préférable au 404 brut : l'utilisateur comprend que c'est
 * temporaire et qu'on a un plan.
 */
export async function DisabledToolView({ toolName }: Props) {
  const t = await getTranslations("public.outils");
  return (
    <section className="flex flex-col gap-6">
      <div className="glass-surface relative flex flex-col items-center gap-5 px-8 py-16 text-center">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-orange-100 text-orange-600 dark:bg-orange-950/30 dark:text-orange-300">
          <Wrench className="size-7" />
        </span>

        <div className="max-w-xl space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--glass-ink-faint)]">
            {t("disabledEyebrow")}
          </p>
          <h1 className="glass-display text-[32px] font-semibold leading-[1.1] sm:text-[40px]">
            {toolName}{" "}
            <em className="text-[color:var(--glass-ink-soft)]">
              {t("disabledTitle")}
            </em>
          </h1>
          <p className="text-[14px] text-[color:var(--glass-ink-soft)]">
            {t.rich("disabledBody", {
              strong: (c) => (
                <strong className="text-[color:var(--glass-ink)]">{c}</strong>
              ),
            })}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            href="/outils"
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-4 py-2 text-[13px] font-semibold text-[color:var(--glass-ink)] transition hover:bg-white/55"
          >
            <ArrowLeft className="size-3.5" />
            {t("backToCatalog")}
          </Link>
          <Link
            href="/aidez-moi"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold text-[color:var(--glass-bg-a)] transition"
            style={{ background: "var(--glass-ink)" }}
          >
            {t("needHelp")}
          </Link>
        </div>

        <p className="pt-4 text-[11px] text-[color:var(--glass-ink-faint)]">
          {t.rich("disabledReport", {
            report: (c) => (
              <Link href="/aidez-moi" className="underline">
                {c}
              </Link>
            ),
          })}
        </p>
      </div>
    </section>
  );
}
