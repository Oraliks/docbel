import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowRightIcon,
  Building2Icon,
  CheckIcon,
  HandshakeIcon,
} from "lucide-react";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Inscription | DocBel",
  description:
    "Inscrivez votre organisation (partenaire) ou votre entreprise (employeur) à DocBel.",
};

// Animations locales (orbes flottantes). L'entrée réutilise le keyframe global
// `fadeInUp` défini dans app/globals.css.
const ANIM_CSS = `
@keyframes inscr-float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(14px, -18px) scale(1.08); }
}
@keyframes inscr-float-2 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(-16px, 14px) scale(1.12); }
}
`;

const PARTNER_GRADIENT =
  "linear-gradient(140deg, #8B5CF6 0%, #6D28D9 52%, #4C1D95 100%)";
const EMPLOYER_GRADIENT =
  "linear-gradient(140deg, #16C0AE 0%, #0F766E 52%, #134E4A 100%)";

const PARTNER_PERKS = [
  "Outils & calculateurs réservés aux partenaires",
  "Tableau de bord d'équipe partagé",
  "Accès via votre adresse email professionnelle",
];
const EMPLOYER_PERKS = [
  "Attestations sociales (C4…) automatisées",
  "L'alternative moderne au secrétariat social",
  "Inscription via votre numéro de TVA",
];

export default async function InscriptionRoute() {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);

  if (session?.user) redirect("/");

  return (
    <section className="flex w-full flex-col gap-10 py-4">
      <style dangerouslySetInnerHTML={{ __html: ANIM_CSS }} />

      <header
        className="flex flex-col items-center gap-3 text-center"
        style={{ animation: "fadeInUp 0.6s cubic-bezier(0.22,1,0.36,1) both" }}
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--glass-ink-faint)]">
          Inscription
        </p>
        <h1 className="glass-display text-[38px] font-semibold leading-[1.03] sm:text-[52px]">
          Bienvenue. <em>Quel est votre profil&nbsp;?</em>
        </h1>
        <p className="max-w-xl text-[15px] text-[color:var(--glass-ink-soft)]">
          Choisissez l&apos;espace qui vous correspond. Les citoyens, eux,
          n&apos;ont besoin d&apos;aucun compte pour utiliser DocBel.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChoicePanel
          href="/inscription/partenaire"
          Icon={HandshakeIcon}
          title="Partenaire"
          tagline="CPAS, syndicat, mutuelle, ONEM, organisme de paiement"
          desc="Vous accompagnez les citoyens dans leurs démarches."
          perks={PARTNER_PERKS}
          gradient={PARTNER_GRADIENT}
          delay="0.12s"
        />
        <ChoicePanel
          href="/inscription/employeur"
          Icon={Building2Icon}
          title="Employeur"
          tagline="Entreprise — gestion RH & obligations sociales"
          desc="Générez et automatisez vos documents employeur."
          perks={EMPLOYER_PERKS}
          gradient={EMPLOYER_GRADIENT}
          delay="0.22s"
        />
      </div>

      <p
        className="text-center text-[13px] text-[color:var(--glass-ink-soft)]"
        style={{ animation: "fadeInUp 0.6s cubic-bezier(0.22,1,0.36,1) both", animationDelay: "0.32s" }}
      >
        Vous avez déjà un compte ?{" "}
        <Link
          href="/login"
          className="font-bold text-[color:var(--glass-accent-deep)] underline underline-offset-2"
        >
          Connectez-vous
        </Link>
      </p>
    </section>
  );
}

function ChoicePanel({
  href,
  Icon,
  title,
  tagline,
  desc,
  perks,
  gradient,
  delay,
}: {
  href: string;
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  tagline: string;
  desc: string;
  perks: string[];
  gradient: string;
  delay: string;
}) {
  return (
    <div style={{ animation: "fadeInUp 0.7s cubic-bezier(0.22,1,0.36,1) both", animationDelay: delay }}>
      <Link
        href={href}
        className="group relative flex min-h-[460px] flex-col justify-between overflow-hidden rounded-[28px] p-8 text-white shadow-[0_18px_50px_-12px_rgba(40,15,80,0.45)] transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-[0_30px_70px_-15px_rgba(40,15,80,0.6)] sm:p-10"
        style={{ backgroundImage: gradient }}
      >
        {/* Orbes flottantes décoratives */}
        <span
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-12 size-52 rounded-full blur-3xl"
          style={{
            background: "rgba(255,255,255,0.22)",
            animation: "inscr-float 9s ease-in-out infinite",
          }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-16 -left-10 size-56 rounded-full blur-3xl"
          style={{
            background: "rgba(255,255,255,0.14)",
            animation: "inscr-float-2 11s ease-in-out infinite",
          }}
        />

        <div className="relative flex flex-col gap-5">
          <span className="flex size-16 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur-sm">
            <Icon className="size-8" />
          </span>
          <div className="flex flex-col gap-1.5">
            <h2 className="glass-display text-[34px] font-semibold leading-none">
              {title}
            </h2>
            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-white/70">
              {tagline}
            </p>
          </div>
          <p className="max-w-md text-[15px] text-white/85">{desc}</p>

          <ul className="mt-1 flex flex-col gap-2.5">
            {perks.map((perk) => (
              <li key={perk} className="flex items-center gap-2.5 text-[13.5px] text-white/90">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white/20">
                  <CheckIcon className="size-3" />
                </span>
                {perk}
              </li>
            ))}
          </ul>
        </div>

        <span className="relative mt-8 inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-5 py-3 text-[14px] font-bold ring-1 ring-white/25 backdrop-blur-sm transition-colors group-hover:bg-white/25">
          S&apos;inscrire comme {title.toLowerCase()}
          <ArrowRightIcon className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
        </span>
      </Link>
    </div>
  );
}
