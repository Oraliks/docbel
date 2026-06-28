# DESIGN_RULES — Charte visuelle DocBel

Lecture **quand on touche à l'UI**. Deux langages de design coexistants ; ne jamais
les mélanger. Source de vérité du routage : `app-layout-client.tsx`.

## Deux langages
- **Front public = « glass mauve »** : tout vit sous `.glass-root`. Primitives dans
  `app/globals.css` (`.glass-surface`, `.glass-interactive`, `.glass-display`, tokens
  `--glass-*`). Les composants shadcn rendus sous `.glass-root` héritent du verre
  automatiquement (cards, popovers, **champs** dépolis) → rien à faire par composant.
- **Admin / pro / auth = shadcn aligné sur la même palette** (PAS de verre). Tokens
  `:root`/`.dark` déjà migrés (`--card #FAF7FF`, `--primary/#5B46E5`, `--radius .875rem`).
  **Jamais** `.glass-*` / `backdrop-filter` sur l'admin (tables denses → lisibilité + perf).

## Palette officielle (`--glass-*`)
Lavande `#CDBBFF` · Violet CTA `#5B46E5` · Rose pâle `#FFD6E8` · Lilas `#E9E0FF` ·
Blanc cassé `#FAF7FF` · Gris doux `#E7E3EF`.
Esprit : pastel premium, douceur, clarté, confiance ; coins 12–24px, bordures 1px,
ombres diffuses (jamais dures).

## Règles « going forward »
1. Front : **jamais** `bg-white` / `#FFFFFF` en dur sur carte/panneau/champ → `.glass-surface`,
   helpers `lib/glass-classes.ts` (`GLASS_CARD`/`GLASS_INPUT`), ou héritage `.glass-root`.
2. Tout champ de formulaire front = **dépoli** (verre + `backdrop-filter`), jamais blanc plat.
3. Mouvement doux + `prefers-reduced-motion`-safe (`.glass-interactive`, `fadeInUp`,
   `.outils-rise`, `.animate-heart-pop`, `.animate-soft-sheen`).
4. Éviter : couleurs criardes, ombres dures, angles droits, style corporate froid.

## Largeurs / conteneurs (⚠️ erreurs récurrentes)
- **Front** : le shell centre déjà (`max-w-[1840px]` posé par `app-layout-client.tsx`).
  Une page front NE re-pose **jamais** `max-w-*` / `container` / `mx-auto` sur sa **racine**.
  Patron : `<section className="flex w-full flex-col gap-6">` (modèle `/mon-dossier`).
  `max-w-*` toléré seulement sur un élément de **texte** (`<p>`/`<h*>`) ou un empty-state centré.
- **Admin** : pleine largeur, **jamais** `max-w-*` étroit sur le conteneur de page
  (modèle `/admin/users` → `flex flex-col gap-6 py-6 px-4 md:px-6`). Remplir via grilles
  multi-colonnes (`grid sm:grid-cols-2 lg:grid-cols-3`), pas une colonne étroite.
- **Exception assumée** : auth (`login`/`inscription*`/`mot-de-passe-*`) = centrée-étroite.

## Modales / Sheets (composants `components/ui/`)
- `DialogContent` porte déjà `p-4` → ne pas re-padder le corps ; structurer via Header/Footer.
- `SheetContent` n'a **aucun** padding (`p-0`) ; le corps doit porter `px-4 pb-6`
  (modèle `BookingDetail` dans `components/booking/agenda-client.tsx`).
- **Élargir** un `*Content` exige le préfixe `sm:` (`sm:max-w-2xl`), sinon le défaut
  responsive (`sm:max-w-lg`/`sm:max-w-md`) recoiffe à ≥640px.
- `Select` = base-ui : garder le wrapper du repo (dérive le mapping valeur→label depuis
  les `<SelectItem>`) ; sinon le trigger réaffiche le code brut (`__none__`).

## Dark mode — « néon glassmorphism »
Ambiance à part (pas un simple inverse) : fond noir-violet (`#070617`/`#0D0A22`/`#14102B`),
halos ambiants, accents vifs (`#8B5CF6`/`#C084FC`/`#FF5FA2`), titres en dégradé violet→rose,
glow au hover. Tout via `.dark { --glass-* }` → le front en hérite. Admin dark = bascule
`.dark` slate shadcn, **pas** le néon.

## Avant de livrer
Vérifier au navigateur (desktop large **+ mobile**) : rien de collé aux bords, aucune
surface front en blanc dur sur le mauve, pas de colonne centrée étroite involontaire.

## Incohérences couleur connues (backlog, cf. TECH_DEBT_QUEUE)
Défaut `#7C3AED`/`#C8102E` en dur dans certains charts/icônes → migrer vers `var(--primary)`/`--chart-*`.
