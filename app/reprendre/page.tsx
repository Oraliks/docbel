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
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 px-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--glass-ink-faint)]">
          {t("reprendreEyebrow")}
        </p>
        <h1 className="glass-display text-[40px] font-semibold leading-[1.05] sm:text-[48px]">
          {t.rich("reprendreTitle", { em: (chunks) => <em>{chunks}</em> })}
        </h1>
        <p className="max-w-2xl text-[14px] text-[color:var(--glass-ink-soft)]">
          {t("reprendreIntro")}
        </p>
      </header>

      <ResumeForm />
    </section>
  );
}
