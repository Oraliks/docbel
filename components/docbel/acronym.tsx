// <Acronym/> + <AcronymText/> — composants pour annoter du JSX statique
// avec les sigles du glossaire.
//
// Ces composants émettent les MÊMES marqueurs (<abbr class="acronym-tip"
// data-acronym title>) que `enrichHtmlWithAcronyms` (lib/acronyms-html.ts)
// utilise pour le rich-text. Le résultat : un seul système de tooltip
// — <AcronymHydrator/> monté à la racine — gère toutes les sources.
//
// Usage :
//   <Acronym code="ONEM">ONEM</Acronym>
//   <Acronym>CAPAC</Acronym>
//   <Acronym code="ONEM">l'Office national</Acronym>
//   <Acronym title="…">XYZ</Acronym>              // sigle hors glossaire
//   <AcronymText>Le ONEM délivre le C4.</AcronymText>
//
// Ces composants n'ont pas besoin d'être "use client" : ils ne font que
// du rendu JSX statique. C'est l'hydrateur global qui prend le relais
// au runtime pour afficher le tooltip glass.

import * as React from "react";

import { lookupAcronym, splitWithAcronyms } from "@/lib/acronyms";
import { cn } from "@/lib/utils";

export type AcronymProps = {
  /**
   * Clé à chercher dans le glossaire. Si absent, on prend `children`
   * (à condition que ce soit une string). Insensible à la casse.
   */
  code?: string;
  /**
   * Override manuel de la définition. Utile pour un sigle qui n'est pas
   * (encore) dans le glossaire ou pour préciser le contexte.
   */
  title?: string;
  /** Texte affiché. Par défaut = `code`. */
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

  // Pas de définition trouvée et pas d'override → texte brut, on évite
  // une décoration qui ne mènerait nulle part.
  if (!definition) {
    return <>{display}</>;
  }

  const nativeTitle = label ? `${label} — ${definition}` : definition;

  return (
    <abbr
      className={cn("acronym-tip", className)}
      data-acronym={entry?.code ?? code ?? lookupKey}
      title={nativeTitle}
      tabIndex={0}
    >
      {display}
    </abbr>
  );
}

// <AcronymText/> — wrap automatique des sigles connus dans une string.
// Idéal pour les champs de texte plain (titre, description, intro…)
// stockés en base sans markup.

export type AcronymTextProps = {
  children: string;
  /** Classe additionnelle appliquée à chaque <abbr> détecté. */
  acronymClassName?: string;
};

export function AcronymText({ children, acronymClassName }: AcronymTextProps) {
  const parts = splitWithAcronyms(children);

  // Aucun sigle reconnu → on rend la string brute, pas de fragments inutiles.
  if (parts.length === 0 || parts.every((p) => p.kind === "text")) {
    return <>{children}</>;
  }

  return (
    <>
      {parts.map((part, i) => {
        if (part.kind === "text") {
          return <React.Fragment key={i}>{part.text}</React.Fragment>;
        }
        const { entry, text } = part;
        return (
          <abbr
            key={i}
            className={cn("acronym-tip", acronymClassName)}
            data-acronym={entry.code}
            title={`${entry.label} — ${entry.definition}`}
            tabIndex={0}
          >
            {text}
          </abbr>
        );
      })}
    </>
  );
}
