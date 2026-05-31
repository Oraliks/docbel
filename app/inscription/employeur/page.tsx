import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SignupForm } from "@/components/docbel/partner-signup-form";

export const metadata: Metadata = {
  title: "Inscription employeur | DocBel",
  description:
    "Gérez vos attestations sociales (C4, déclarations) et automatisez vos documents RH avec DocBel — l'alternative moderne au secrétariat social.",
};

export default async function EmployerSignupRoute() {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);

  if (session?.user) {
    redirect("/employeur");
  }

  return (
    <section className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <header className="flex flex-col gap-2 px-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--glass-ink-faint)]">
          Espace Employeur
        </p>
        <h1 className="glass-display text-[36px] font-semibold leading-[1.05] sm:text-[44px]">
          Inscription <em>employeur.</em>
        </h1>
        <p className="text-[14px] text-[color:var(--glass-ink-soft)]">
          Gérez les attestations sociales de vos travailleurs (C4, déclarations
          ONEM) et automatisez la production de vos documents RH. DocBel se veut
          l&apos;alternative moderne au secrétariat social : rapide, en libre
          accès, sans dossier papier. L&apos;inscription se fait avec une
          adresse email professionnelle de votre entreprise (ex :{" "}
          <code className="rounded-md bg-[color:var(--glass-surface)] px-1.5 py-0.5 font-mono text-[12.5px]">
            prenom.nom@votre-entreprise.be
          </code>
          ).
        </p>
        <p className="text-[12.5px] text-[color:var(--glass-ink-faint)]">
          Vous représentez un CPAS, un syndicat ou une mutuelle ?{" "}
          <a
            href="/inscription/partenaire"
            className="font-bold underline underline-offset-2"
          >
            Inscrivez-vous sur l&apos;espace partenaire
          </a>
          .
        </p>
      </header>
      <SignupForm expectedSegment="employeur" />
    </section>
  );
}
