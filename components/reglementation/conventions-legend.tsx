/**
 * Légende repliable décodant les conventions du texte légal (§, 1°, a), bis/ter,
 * alinéa) et les symboles de notre affichage (modification, supprimé). Aide de
 * lecture pour les non-juristes. Statique (native <details>, aucun JS).
 */
export function ConventionsLegend() {
  const items: [string, string][] = [
    ["§ 1er, § 2…", "paragraphes numérotés de l’article."],
    ["1°, 2°, 3°…", "énumérations (les points d’une liste)."],
    ["a), b), c)…", "sous-points d’une énumération."],
    ["bis, ter, quater…", "articles ou points insérés après coup (79bis vient après 79)."],
    ["al. N", "alinéa (indicatif) — pour citer un passage précis."],
    ["puce violette « ↻ »", "un passage a été modifié — cliquez pour voir par quel acte et depuis quand."],
    ["« supprimé »", "un passage a été retiré (son contenu n’est pas dans le corpus)."],
    ["texte barré rouge", "passage abrogé — conservé pour information, ne s’applique plus."],
  ];
  return (
    <details className="rounded-lg border bg-muted/20 px-4 py-2.5 text-sm print:hidden">
      <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
        Comment lire cet article ?
      </summary>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        {items.map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <dt className="shrink-0 font-medium text-foreground">{k}</dt>
            <dd className="text-muted-foreground">{v}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
