"use client";

import Link from "next/link";
import { ShieldCheckIcon, UserPlusIcon } from "lucide-react";
import { LandingToolCard } from "@/components/docbel/landing/tool-card";
import { getAudience, type AudienceId } from "@/lib/audience";
import { getToolsByAudience, type Tool } from "@/lib/docbel-data";

type SpaceCopy = {
  hero: {
    eyebrow: string;
    title: React.ReactNode;
    subtitle: string;
  };
  toolsHeading: string;
  toolsSubheading: string;
  note: {
    label: string;
    text: string;
  };
};

const COPY: Record<Exclude<AudienceId, "citoyen">, SpaceCopy> = {
  employeur: {
    hero: {
      eyebrow: "Espace Employeur",
      title: (
        <>
          Vos outils <em>RH</em> au quotidien
        </>
      ),
      subtitle:
        "Générez les C4, suivez vos attestations et anticipez vos obligations sociales. Accès libre pour le moment.",
    },
    toolsHeading: "Outils pour employeurs",
    toolsSubheading:
      "Sélection d'outils utiles pour la gestion RH et les obligations sociales.",
    note: {
      label: "Bon à savoir",
      text: "Aucun compte requis pour le moment. Une inscription pourra être demandée à mesure que la plateforme grandit.",
    },
  },
  partenaire: {
    hero: {
      eyebrow: "Espace Partenaire",
      title: (
        <>
          Tableau de bord <em>partenaires</em>
        </>
      ),
      subtitle:
        "CPAS, syndicats, mutuelles : suivez vos dossiers, accédez aux statistiques et collaborez avec DocBel.",
    },
    toolsHeading: "Outils partenaires",
    toolsSubheading:
      "Ressources et outils pour les institutions partenaires.",
    note: {
      label: "Accès réservé",
      text: "L'inscription sera bientôt réservée aux adresses email professionnelles autorisées (ex: @cpas.brussels). Contactez-nous pour ajouter votre organisation.",
    },
  },
};

interface SpaceLandingProps {
  audience: Exclude<AudienceId, "citoyen">;
  /**
   * Liste d'outils déjà filtrés par audience (source DB côté serveur).
   * Si non fourni, fallback sur le catalogue statique `TOOLS_DATA` filtré
   * par `getToolsByAudience`.
   */
  tools?: Tool[];
}

export function SpaceLanding({ audience, tools: toolsProp }: SpaceLandingProps) {
  const audienceMeta = getAudience(audience);
  const copy = COPY[audience];
  const tools = toolsProp ?? getToolsByAudience(audience);
  const HeroIcon = audienceMeta.Icon;

  const heroBg =
    audience === "employeur"
      ? "linear-gradient(135deg, var(--glass-accent-c) 0%, var(--glass-accent-d) 100%)"
      : "linear-gradient(135deg, var(--glass-accent-deep) 0%, var(--glass-accent-a) 100%)";

  return (
    <section className="flex flex-col gap-8">
      <article className="glass-surface relative grid gap-6 overflow-hidden p-8 sm:p-10 lg:grid-cols-[1fr_320px] lg:items-center">
        <div className="flex flex-col gap-4">
          <span
            className="inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em]"
            style={{
              background: "var(--glass-ink)",
              color: "var(--glass-bg-a)",
            }}
          >
            <span
              className="size-1.5 rounded-full"
              style={{ background: "var(--glass-accent-c)" }}
            />
            {copy.hero.eyebrow}
          </span>
          <h1 className="glass-display text-[36px] font-semibold leading-[1.05] sm:text-[44px]">
            {copy.hero.title}
          </h1>
          <p className="max-w-xl text-[14.5px] leading-[1.55] text-[color:var(--glass-ink-soft)]">
            {copy.hero.subtitle}
          </p>
        </div>
        <div
          className="relative flex h-[200px] items-center justify-center overflow-hidden rounded-[20px]"
          style={{ backgroundImage: heroBg }}
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 80% 80%, rgba(255,255,255,0.4) 0%, transparent 50%)",
            }}
          />
          <HeroIcon className="relative size-20 text-white" strokeWidth={1.4} />
        </div>
      </article>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1 px-2">
          <h2 className="glass-display text-[28px] font-semibold leading-none">
            {copy.toolsHeading}
          </h2>
          <p className="text-[13px] text-[color:var(--glass-ink-soft)]">
            {copy.toolsSubheading}
          </p>
        </div>

        {tools.length === 0 ? (
          <div className="glass-surface flex flex-col items-center gap-2 p-10 text-center">
            <HeroIcon className="size-10 text-[color:var(--glass-accent-deep)]" />
            <p className="text-[14px] font-semibold">
              Outils en cours de préparation
            </p>
            <p className="text-[12.5px] text-[color:var(--glass-ink-soft)]">
              Une sélection d&apos;outils dédiés arrivera prochainement dans
              cet espace.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((tool, index) => (
              <LandingToolCard key={tool.id} tool={tool} index={index} />
            ))}
          </div>
        )}
      </section>

      <aside className="glass-surface flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center">
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-2xl text-white"
          style={{
            backgroundImage:
              "linear-gradient(135deg, var(--glass-accent-a), var(--glass-accent-deep))",
          }}
        >
          <ShieldCheckIcon className="size-5" />
        </span>
        <div className="flex flex-1 flex-col gap-0.5">
          <span className="text-[13.5px] font-bold">{copy.note.label}</span>
          <p className="text-[12.5px] text-[color:var(--glass-ink-soft)]">
            {copy.note.text}
          </p>
        </div>
        {audience === "partenaire" ? (
          <Link
            href="/inscription/partenaire"
            className="inline-flex shrink-0 items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-bold transition hover:opacity-90"
            style={{
              background: "var(--glass-ink)",
              color: "var(--glass-bg-a)",
            }}
          >
            <UserPlusIcon className="size-4" />
            S&apos;inscrire
          </Link>
        ) : null}
      </aside>
    </section>
  );
}
