import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { SignupForm } from "@/components/docbel/partner-signup-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.auth");
  return {
    title: t("partnerMetaTitle"),
    description: t("partnerMetaDescription"),
  };
}

export default async function PartnerSignupRoute() {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);

  if (session?.user) {
    redirect("/partenaire");
  }

  const t = await getTranslations("public.auth");

  return (
    <section className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <header className="flex flex-col gap-2 px-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--glass-ink-faint)]">
          {t("partnerEyebrow")}
        </p>
        <h1 className="glass-display text-[36px] font-semibold leading-[1.05] sm:text-[44px]">
          {t.rich("partnerTitle", { em: (chunks) => <em>{chunks}</em> })}
        </h1>
        <p className="text-[14px] text-[color:var(--glass-ink-soft)]">
          {t.rich("partnerIntro", {
            code: (chunks) => (
              <code className="rounded-md bg-[color:var(--glass-surface)] px-1.5 py-0.5 font-mono text-[12.5px]">
                {chunks}
              </code>
            ),
          })}
        </p>
        <p className="text-[12.5px] text-[color:var(--glass-ink-faint)]">
          {t.rich("partnerCrossLink", {
            a: (chunks) => (
              <a
                href="/inscription/employeur"
                className="font-bold underline underline-offset-2"
              >
                {chunks}
              </a>
            ),
          })}
        </p>
      </header>
      <SignupForm expectedSegment="partenaire" />
    </section>
  );
}
