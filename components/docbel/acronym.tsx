"use client";

// <Acronym/> — pastille de glossaire pour les sigles administratifs belges.
//
// Pourquoi ce composant existe :
//   ONEM, CAPAC, RIS, AGR, C4, BCE… ces sigles sont des murs pour le
//   citoyen lambda. Plutôt que d'alourdir chaque phrase par une définition
//   entre parenthèses, on les enveloppe d'un <Acronym/> qui montre un
//   tooltip glass au survol et au focus clavier.
//
// Usage typique :
//   <Acronym code="ONEM">ONEM</Acronym>        // lookup auto + tooltip
//   <Acronym>CAPAC</Acronym>                   // children = code, idem
//   <Acronym code="ONEM">l'Office</Acronym>    // label custom, définition ONEM
//   <Acronym title="…">XYZ</Acronym>           // sigle hors glossaire
//
// Accessibilité :
//   - Rendu en <abbr title="…"> → tooltip natif si JS HS.
//   - tabIndex=0 → focusable, le tooltip s'ouvre au focus clavier.
//   - Soulignement pointillé → indique au lecteur qu'on peut interagir.
//
// Le composant **n'a pas besoin** d'un <TooltipProvider> englobant :
//   le Tooltip Root de base-ui fonctionne en standalone (le provider ne
//   sert qu'à partager un délai entre tooltips groupés).

import * as React from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { lookupAcronym, splitWithAcronyms } from "@/lib/acronyms";
import { cn } from "@/lib/utils";

export type AcronymProps = {
  /**
   * Clé à chercher dans le glossaire. Si absent, on prend `children` (à
   * condition que ce soit une string). Insensible à la casse.
   */
  code?: string;
  /**
   * Override manuel de la définition. Utile pour un sigle qui n'est pas
   * (encore) dans le glossaire, ou pour préciser le contexte.
   */
  title?: string;
  /**
   * Texte affiché. Par défaut = `code`. Permet d'afficher autre chose
   * que le sigle lui-même tout en gardant la définition liée.
   */
  children?: React.ReactNode;
  className?: string;
};

export function Acronym({ code, title, children, className }: AcronymProps) {
  const childText = typeof children === "string" ? children : undefined;
  const lookupKey = code ?? childText ?? "";
  const entry = lookupAcronym(lookupKey);

  const definition = title ?? entry?.definition;
  const label = entry?.label;
  const display = children ?? entry?.code ?? code ?? lookupKey;

  // Pas de définition trouvée et pas d'override → on rend du texte brut,
  // ça évite des tooltips vides qui dégradent l'UX.
  if (!definition) {
    return <>{display}</>;
  }

  // Le `title` HTML sur <abbr> assure la lisibilité même sans JS et
  // donne aux lecteurs d'écran l'expansion du sigle.
  const nativeTitle = label ? `${label}—${definition}` : definition;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <abbr
            title={nativeTitle}
            tabIndex={0}
            className={cn(
              "cursor-help font-medium underline decoration-dotted decoration-1 underline-offset-[3px]",
              "decoration-[color:var(--glass-accent-deep)]/60 hover:decoration-[color:var(--glass-accent-deep)]",
              "focus-visible:outline-none focus-visible:decoration-[color:var(--glass-accent-deep)] focus-visible:decoration-2",
              "transition-[text-decoration-color]",
              className,
            )}
          />
        }
      >
        {display}
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={6}
        className="glass-surface-strong !rounded-xl !border-[1.5px] !border-[color:var(--glass-border)] !bg-[color:var(--glass-surface-strong)] !px-3 !py-2.5 !text-[color:var(--glass-ink)] max-w-[20rem] text-left"
      >
        <div className="space-y-1">
          {label ? (
            <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--glass-ink-soft)]">
              {label}
            </div>
          ) : null}
          <div className="text-[12px] leading-snug text-[color:var(--glass-ink)]">
            {definition}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// <AcronymText/> — wrap automatiquement tous les sigles reconnus dans une
// string de texte. Idéal pour décorer du copy existant sans réécrire la
// phrase entière à coups de <Acronym/>.
//
// Usage :
//   <AcronymText>Le ONEM délivre le C4 à chaque fin de contrat.</AcronymText>
//
// Pour du texte riche (avec des <strong/>, des liens…), continuez à
// utiliser <Acronym/> manuellement — ce helper n'opère que sur les strings.

export type AcronymTextProps = {
  children: string;
  /** Classe appliquée aux sigles détectés (passée à chaque <Acronym/>). */
  acronymClassName?: string;
};

export function AcronymText({ children, acronymClassName }: AcronymTextProps) {
  const parts = splitWithAcronyms(children);

  // Aucun sigle reconnu → on rend la string telle quelle, pas de wrapping
  // inutile qui complique l'arbre React.
  if (parts.length === 0 || parts.every((p) => p.kind === "text")) {
    return <>{children}</>;
  }

  return (
    <>
      {parts.map((part, i) =>
        part.kind === "text" ? (
          <React.Fragment key={i}>{part.text}</React.Fragment>
        ) : (
          <Acronym key={i} code={part.entry.code} className={acronymClassName}>
            {part.text}
          </Acronym>
        ),
      )}
    </>
  );
}
