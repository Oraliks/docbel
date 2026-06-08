import Link from "next/link";
import { ConstructionIcon, ArrowLeftIcon, CalendarIcon } from "lucide-react";

/**
 * Placeholder affiché aux comptes connectés sur /partenaire et /employeur en
 * attendant la refonte du vrai tableau de bord (V2 hors du front website).
 * Volontairement sobre : on indique que c'est en construction et on renvoie
 * vers l'accueil ou un outil clé.
 *
 * NB : les vitrines marketing publiques vivent désormais sous /p/partenaire
 * et /p/employeur — ce composant est strictement pour les utilisateurs
 * authentifiés.
 */

type SpaceConfig = {
  label: string;
  primaryTool?: {
    href: string;
    label: string;
  };
};

const SPACES: Record<"partenaire" | "employeur", SpaceConfig> = {
  partenaire: {
    label: "Partenaire",
    primaryTool: {
      href: "/partenaire/booking",
      label: "Agenda des rendez-vous",
    },
  },
  employeur: {
    label: "Employeur",
  },
};

export function UnderConstructionPanel({
  space,
}: {
  space: "partenaire" | "employeur";
}) {
  const config = SPACES[space];

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <span
        className="flex size-20 items-center justify-center rounded-full glass-surface"
        style={{ color: "var(--glass-accent-deep)" }}
      >
        <ConstructionIcon className="size-9" />
      </span>

      <h1 className="glass-display text-[32px] font-semibold leading-tight sm:text-[38px]">
        Espace <em>{config.label}</em> en construction
      </h1>

      <p className="max-w-md text-[15px] leading-relaxed text-[color:var(--glass-ink-soft)]">
        Nous travaillons sur votre nouveau tableau de bord. En attendant,
        accédez à vos outils via le menu de navigation.
      </p>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-[13px] font-bold transition-colors"
          style={{
            background: "var(--glass-ink)",
            color: "var(--glass-bg-a)",
          }}
        >
          <ArrowLeftIcon className="size-4" />
          Retour à l&apos;accueil
        </Link>

        {config.primaryTool ? (
          <Link
            href={config.primaryTool.href}
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-5 py-3 text-[13px] font-semibold text-[color:var(--glass-ink-soft)] transition-colors"
          >
            <CalendarIcon className="size-4" />
            {config.primaryTool.label}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
