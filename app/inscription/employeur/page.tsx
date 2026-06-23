import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { SignupForm } from "@/components/docbel/partner-signup-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.auth");
  return {
    title: t("employerMetaTitle"),
    description: t("employerMetaDescription"),
  };
}

export default async function EmployerSignupRoute() {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);

  if (session?.user) {
    redirect("/employeur");
  }

  const t = await getTranslations("public.auth");

  return (
    <section className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <header className="flex flex-col gap-2 px-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--glass-ink-faint)]">
          {t("employerEyebrow")}
        </p>
        <h1 className="glass-display text-[36px] font-semibold leading-[1.05] sm:text-[44px]">
          {t.rich("employerTitle", { em: (chunks) => <em>{chunks}</em> })}
        </h1>
        <p className="text-[14px] text-[color:var(--glass-ink-soft)]">
          {t.rich("employerIntro", {
            code: (chunks) => (
              <code className="rounded-md bg-[color:var(--glass-surface)] px-1.5 py-0.5 font-mono text-[12.5px]">
                {chunks}
              </code>
            ),
          })}
        </p>
        <p className="text-[12.5px] text-[color:var(--glass-ink-faint)]">
          {t.rich("employerCrossLink", {
            a: (chunks) => (
              <a
                href="/inscription/partenaire"
                className="font-bold underline underline-offset-2"
              >
                {chunks}
              </a>
            ),
          })}
        </p>
      </header>
      <SignupForm expectedSegment="employeur" />
    </section>
  );
}
