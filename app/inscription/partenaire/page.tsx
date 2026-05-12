import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { PartnerSignupForm } from "@/components/docbel/partner-signup-form";

export const metadata: Metadata = {
  title: "Inscription partenaire | DocBel",
  description:
    "Inscrivez votre organisation (CPAS, syndicat, mutuelle) à l'espace partenaire DocBel.",
};

export default async function PartnerSignupRoute() {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);

  if (session?.user) {
    redirect("/partenaire");
  }

  return (
    <section className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <header className="flex flex-col gap-2 px-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--glass-ink-faint)]">
          Espace Partenaire
        </p>
        <h1 className="glass-display text-[36px] font-semibold leading-[1.05] sm:text-[44px]">
          Inscription <em>partenaire.</em>
        </h1>
        <p className="text-[14px] text-[color:var(--glass-ink-soft)]">
          L&apos;inscription est réservée aux adresses email professionnelles
          autorisées (ex :{" "}
          <code className="rounded-md bg-[color:var(--glass-surface)] px-1.5 py-0.5 font-mono text-[12.5px]">
            @cpas.brussels
          </code>
          ). Si votre organisation n&apos;est pas encore référencée,
          contactez-nous.
        </p>
      </header>
      <PartnerSignupForm />
    </section>
  );
}
