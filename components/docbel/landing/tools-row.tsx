import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { type Tool, getToolSlug } from "@/lib/docbel-data";
import { glyphForTool } from "@/lib/tool-glyphs";

interface LandingToolsRowProps {
  /** Outils à afficher dans la timeline (ex: uniquement les populaires). */
  tools: Tool[];
  /** Nombre max d'icônes affichées. Défaut 8. */
  max?: number;
}

/**
 * « Vos outils, en un geste » — version TIMELINE (maquette home 2026-06).
 *
 * Un seul bandeau verre : titre + accent vertical à gauche, puis une frise
 * horizontale où chaque outil est une pastille colorée posée au-dessus d'un
 * nœud numéroté sur la ligne ; à droite, un bouton rond « Voir tous les outils ».
 *
 * Interactions (CSS only, composant serveur) :
 *   - chaque icône entre en fondu décalé (fadeInUp) puis flotte doucement
 *     (toolFloat, neutralisé par prefers-reduced-motion via `motion-safe:`) ;
 *   - au survol d'une icône, son NOM apparaît (tooltip) et l'icône se soulève ;
 *   - chaque icône est un lien direct vers l'outil.
 *
 * Reste dynamique : la liste vient du catalogue réel filtré sur les outils
 * populaires (cf. app/page.tsx) — un nouvel outil marqué populaire s'ajoute ici.
 */
export function LandingToolsRow({ tools, max = 8 }: LandingToolsRowProps) {
  const visible = tools.slice(0, max);

  return (
    <section className="glass-surface flex flex-col gap-8 p-7 lg:flex-row lg:items-center lg:gap-10 lg:p-9">
      {/* Titre + accent vertical -------------------------------------- */}
      <div className="flex shrink-0 items-stretch gap-4 lg:max-w-[200px]">
        <div
          aria-hidden
          className="relative w-px shrink-0 rounded-full bg-gradient-to-b from-[color:var(--glass-accent-a)] via-[color:var(--glass-accent-a)]/40 to-transparent"
        >
          <span className="absolute -left-[3.5px] -top-1 size-2 rounded-full bg-[color:var(--glass-accent-deep)] ring-4 ring-[color:var(--glass-accent-a)]/20" />
        </div>
        <h2 className="glass-display text-[26px] font-semibold leading-[1.05]">
          Vos outils,
          <br />
          <em className="text-[color:var(--glass-accent-deep)]">en un geste.</em>
        </h2>
      </div>

      {/* Frise d'outils — s'adapte au nombre d'outils, JAMAIS de scroll :
          chaque outil prend une part égale (flex-1), l'icône remplit sa colonne
          jusqu'à un plafond (56px) puis rétrécit quand il y en a beaucoup. */}
      <div className="w-full min-w-0 lg:flex-1">
        <div className="relative pt-6">
          {/* Ligne horizontale (passe au centre des nœuds numérotés). */}
          <div
            aria-hidden
            className="absolute inset-x-1 bottom-[11px] h-px bg-gradient-to-r from-transparent via-[color:var(--glass-ink-line)] to-transparent"
          />
          <ol className="relative flex items-end gap-1.5 sm:gap-2.5 lg:gap-3">
            {visible.map((tool, index) => {
              const { Icon, hue } = glyphForTool(tool);
              const href = tool.href ?? `/outils/${getToolSlug(tool)}`;
              const tint = `color-mix(in oklab, ${hue} 15%, transparent)`;
              return (
                <li
                  key={tool.id}
                  className="group relative flex min-w-0 flex-1 animate-[fadeInUp_0.5s_ease_both] flex-col items-center gap-2.5"
                  style={{ animationDelay: `${index * 70}ms` }}
                >
                  {/* Nom au survol : texte gras posé au-dessus de l'icône
                      (sans pastille), fondu + montée douce. Pro & lisible. */}
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 translate-y-1 whitespace-nowrap text-center text-[13px] font-extrabold tracking-tight text-[color:var(--glass-ink)] opacity-0 transition-all duration-200 ease-out group-hover:translate-y-0 group-hover:opacity-100">
                    {tool.title}
                  </span>

                  {/* Icône flottante + cliquable (taille fluide, plafonnée à 56px) */}
                  <span
                    className="w-full max-w-[56px] motion-safe:animate-[toolFloat_4.5s_ease-in-out_infinite]"
                    style={{ animationDelay: `${index * 260}ms` }}
                  >
                    <Link
                      href={href}
                      aria-label={tool.title}
                      title={tool.title}
                      className="flex aspect-square w-full items-center justify-center rounded-full ring-1 ring-inset ring-white/50 transition-[transform,box-shadow] duration-300 hover:shadow-[0_10px_24px_-8px_rgba(80,50,160,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)] group-hover:-translate-y-1 group-hover:scale-110 dark:ring-white/10"
                      style={{ background: tint, color: hue }}
                    >
                      <Icon className="h-1/2 w-1/2" strokeWidth={1.9} aria-hidden />
                    </Link>
                  </span>

                  {/* Nœud numéroté posé sur la ligne */}
                  <span
                    className="relative z-[1] flex size-[22px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold ring-4 ring-[color:var(--glass-surface)] transition-transform duration-300 group-hover:scale-110"
                    style={{ background: tint, color: hue }}
                  >
                    {index + 1}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      {/* Voir tous les outils ----------------------------------------- */}
      <div className="flex shrink-0 items-center gap-4">
        <div
          aria-hidden
          className="hidden h-16 w-px bg-[color:var(--glass-ink-line)] lg:block"
        />
        <Link
          href="/outils"
          className="group/all flex items-center gap-3 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-[color:var(--glass-accent-deep)] text-white shadow-[0_8px_20px_-6px_rgba(80,50,160,0.6)] transition-transform duration-300 group-hover/all:translate-x-0.5 group-hover/all:scale-105">
            <ArrowRightIcon className="size-5" />
          </span>
          <span className="text-[13.5px] font-bold leading-tight text-[color:var(--glass-ink)]">
            Voir tous
            <br />
            les outils
          </span>
        </Link>
      </div>
    </section>
  );
}
