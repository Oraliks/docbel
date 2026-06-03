import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRightIcon, Building2Icon, HandshakeIcon } from "lucide-react";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Inscription | DocBel",
  description:
    "Inscrivez votre organisation (partenaire) ou votre entreprise (employeur) à DocBel.",
};

export default async function InscriptionRoute() {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);

  if (session?.user) redirect("/");

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--glass-ink-faint)]">
          Inscription
        </p>
        <h1 className="glass-display text-[36px] font-semibold leading-[1.05] sm:text-[44px]">
          Quel est votre profil ?
        </h1>
        <p className="text-[14px] text-[color:var(--glass-ink-soft)]">
          Choisissez l&apos;espace qui vous correspond. Les citoyens, eux,
          n&apos;ont pas besoin de compte pour utiliser DocBel.
        </p>
      </header>

      <div className="grid gap-5 sm:grid-cols-2">
        <ChoiceCard
          href="/inscription/partenaire"
          Icon={HandshakeIcon}
          title="Partenaire"
          desc="CPAS, syndicat, mutuelle, ONEM, organisme de paiement — vous accompagnez les citoyens dans leurs démarches."
        />
        <ChoiceCard
          href="/inscription/employeur"
          Icon={Building2Icon}
          title="Employeur"
          desc="Entreprise : gestion RH, attestations sociales (C4…) et automatisation de vos documents."
        />
      </div>

      <p className="text-center text-[12.5px] text-[color:var(--glass-ink-soft)]">
        Vous avez déjà un compte ?{" "}
        <Link
          href="/login"
          className="font-bold underline underline-offset-2 text-[color:var(--glass-accent-deep)]"
        >
          Connectez-vous
        </Link>
      </p>
    </section>
  );
}

function ChoiceCard({
  href,
  Icon,
  title,
  desc,
}: {
  href: string;
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-3xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-6 transition hover:border-[color:var(--glass-accent-deep)] hover:shadow-[0_12px_40px_rgba(40,15,80,0.12)]"
    >
      <span
        className="flex size-12 items-center justify-center rounded-2xl text-white"
        style={{
          backgroundImage:
            "linear-gradient(135deg, var(--glass-accent-a), var(--glass-accent-deep))",
        }}
      >
        <Icon className="size-6" />
      </span>
      <h2 className="glass-display text-[22px] font-semibold">{title}</h2>
      <p className="flex-1 text-[13.5px] text-[color:var(--glass-ink-soft)]">
        {desc}
      </p>
      <span className="inline-flex items-center gap-1 text-[13px] font-bold text-[color:var(--glass-accent-deep)]">
        S&apos;inscrire
        <ArrowRightIcon className="size-4 transition group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
