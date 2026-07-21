import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ResumeForm } from "@/components/docbel/onboarding/resume-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.dossier");
  return {
    title: t("reprendreMetaTitle"),
    description: t("reprendreMetaDescription"),
  };
}

export default async function ReprendrePage() {
  const t = await getTranslations("public.dossier");
  return (
    <section className="flex w-full flex-col gap-6 sm:gap-8">
      <header className="flex flex-col gap-3 px-1 sm:px-2">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--glass-ink-faint)]">
          {t("reprendreEyebrow")}
        </p>
        <h1 className="glass-display text-4xl font-semibold leading-[1.05] sm:text-5xl">
          {t.rich("reprendreTitle", { em: (chunks) => <em>{chunks}</em> })}
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-[color:var(--glass-ink-soft)]">
          {t("reprendreIntro")}
        </p>
      </header>

      <ResumeForm />
    </section>
  );
}
