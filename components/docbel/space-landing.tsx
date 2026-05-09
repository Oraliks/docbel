"use client";

import Link from "next/link";
import {
  ArrowRightIcon,
  ShieldCheckIcon,
  UserPlusIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getAudience, type AudienceId } from "@/lib/audience";
import { getToolsByAudience, getToolSlug } from "@/lib/docbel-data";

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
          Vos outils{" "}
          <span className="bg-linear-to-br from-violet-700 to-violet-500 bg-clip-text text-transparent">
            RH
          </span>{" "}
          au quotidien
        </>
      ),
      subtitle:
        "Generez les C4, suivez vos attestations et anticipez vos obligations sociales. Acces libre pour le moment.",
    },
    toolsHeading: "Outils pour employeurs",
    toolsSubheading:
      "Selection d'outils utiles pour la gestion RH et les obligations sociales.",
    note: {
      label: "Bon a savoir",
      text: "Aucun compte requis pour le moment. Une inscription pourra etre demandee a mesure que la plateforme grandit.",
    },
  },
  partenaire: {
    hero: {
      eyebrow: "Espace Partenaire",
      title: (
        <>
          Tableau de bord{" "}
          <span className="bg-linear-to-br from-violet-300 via-violet-500 to-violet-900 bg-clip-text text-transparent">
            partenaires
          </span>
        </>
      ),
      subtitle:
        "CPAS, syndicats, mutuelles : suivez vos dossiers, accedez aux statistiques et collaborez avec DocBel.",
    },
    toolsHeading: "Outils partenaires",
    toolsSubheading:
      "Ressources et outils pour les institutions partenaires.",
    note: {
      label: "Acces reserve",
      text: "L'inscription sera bientot reservee aux adresses email professionnelles autorisees (ex: @cpas.brussels). Contactez-nous pour ajouter votre organisation.",
    },
  },
};

interface SpaceLandingProps {
  audience: Exclude<AudienceId, "citoyen">;
}

export function SpaceLanding({ audience }: SpaceLandingProps) {
  const audienceMeta = getAudience(audience);
  const copy = COPY[audience];
  const tools = getToolsByAudience(audience);

  return (
    <div className="flex flex-col gap-8 py-2">
      <section className="rounded-3xl border bg-linear-to-br from-violet-50 via-white to-violet-100/30 p-6 dark:from-violet-500/10 dark:via-background dark:to-violet-500/5 lg:p-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-10">
          <div
            className={cn(
              "flex size-16 shrink-0 items-center justify-center rounded-2xl",
              audienceMeta.logoMarkClass,
            )}
          >
            <audienceMeta.Icon className="size-7" />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-300">
              {copy.hero.eyebrow}
            </span>
            <h1 className="text-3xl font-bold tracking-tight lg:text-4xl">
              {copy.hero.title}
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground lg:text-base">
              {copy.hero.subtitle}
            </p>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-2">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              {copy.toolsHeading}
            </h2>
            <p className="text-sm text-muted-foreground">
              {copy.toolsSubheading}
            </p>
          </div>
        </div>

        {tools.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
              <span
                className={cn(
                  "flex size-12 items-center justify-center rounded-xl",
                  audienceMeta.iconBgClass,
                )}
              >
                <audienceMeta.Icon className="size-6" />
              </span>
              <p className="text-sm font-medium">Outils en cours de preparation</p>
              <p className="text-xs text-muted-foreground">
                Une selection d&apos;outils dedies arrivera prochainement dans cet espace.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((tool) => (
              <Link
                key={tool.id}
                href={`/outils/${getToolSlug(tool)}`}
                className="group block"
              >
                <Card className="h-full transition-colors group-hover:border-primary/40">
                  <CardContent className="flex h-full flex-col gap-3 p-5">
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "flex size-10 items-center justify-center rounded-lg text-xl",
                          audienceMeta.iconBgClass,
                        )}
                      >
                        {tool.icon}
                      </span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {tool.time}
                      </span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold">{tool.title}</h3>
                      <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">
                        {tool.desc}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                      Ouvrir <ArrowRightIcon className="size-3.5" />
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <aside className="flex flex-col items-start gap-3 rounded-2xl border bg-muted/40 p-4 sm:flex-row sm:items-center">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300">
          <ShieldCheckIcon className="size-4" />
        </span>
        <div className="flex flex-1 flex-col gap-0.5">
          <span className="text-sm font-semibold">{copy.note.label}</span>
          <p className="text-sm text-muted-foreground">{copy.note.text}</p>
        </div>
        {audience === "partenaire" && (
          <Link
            href="/inscription/partenaire"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <UserPlusIcon className="size-4" />
            S&apos;inscrire
          </Link>
        )}
      </aside>
    </div>
  );
}
