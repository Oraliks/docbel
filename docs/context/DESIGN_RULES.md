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

## Gamification douce

> **Gamifier la progression, jamais les droits sociaux.**

- La boucle utile est **comprendre → choisir → compléter → récupérer**. La récompense
  est une prochaine action plus claire et le sentiment d'avancer, pas un score.
- Une action accomplie peut recevoir un feedback bref et unique : coche, rail qui avance,
  halo discret ou lift de 3 px maximum. Un dossier entièrement prêt peut avoir une
  célébration sobre de moins de 900 ms, une seule fois.
- Une inéligibilité, un montant, une durée, une condition juridique, une erreur ou un
  blocage administratif ne reçoit **jamais** de confettis, score, streak, classement,
  compte à rebours artificiel ni formulation culpabilisante.
- Le feedback positif valide l'**action de la personne** (réponse enregistrée, document
  complété), jamais son éligibilité ou la gravité de sa situation.
- Une seule animation dominante à la fois ; aucune animation ne masque une source,
  une date de mise à jour, une condition ou la prochaine action.

## Couleurs sémantiques

| État | Tokens globaux | Alias front glass | Usage |
|---|---|---|---|
| Succès | `--success-*` | `--glass-success-*` | action ou document terminé |
| Attention | `--attention-*` | `--glass-warning-*` | information à vérifier, échéance proche |
| Information | `--info-*` | `--glass-info-*` | contexte neutre, aide, progression |
| Erreur | `--destructive*` | aucun alias | erreur réelle, action impossible |

Chaque famille fournit une couleur forte, une surface subtile, une encre et une bordure
adaptées au clair, sombre et contraste élevé. La couleur ne porte **jamais seule** le sens :
ajouter un libellé explicite et une icône ou un statut textuel. Utiliser
`.glass-feedback[data-tone="success|attention|info"]` pour les callouts publics ; conserver
le composant shadcn `Alert` lorsque sa sémantique convient.

## Mouvement et feedback

| Token | Cible | Usage |
|---|---:|---|
| `--motion-duration-press` | 160 ms | pression / feedback immédiat |
| `--motion-duration-hover` | 200 ms | hover, focus, lift |
| `--motion-duration-step` | 380 ms | changement d'étape / rail |
| `--motion-duration-completion` | 480 ms | coche et validation d'une étape |
| `--motion-duration-celebration` | 800 ms | dossier complet, exceptionnel |

- `.glass-interactive` est l'unique primitive de lift/press/focus pour une surface
  cliquable. Elle gère aussi `disabled`, `aria-disabled`, le tactile et le mouvement réduit.
- `GLASS_INTERACTIVE_CARD` (`lib/glass-classes.ts`) compose la surface Card et cette
  interaction lorsque les deux sont nécessaires ; ne pas recopier leurs classes.
- `.docbel-progress-feedback` ne fait bouger que
  `[data-progress-indicator]`/`[data-slot="progress-indicator"]`.
- `.docbel-completion-feedback[data-kind="step|dossier"]` réutilise les keyframes communes
  `fadeInUp` et `docbel-pop` pour un effet one-shot. Ne pas créer une autre variante de
  fade-in-up, lift, pop ou shimmer.
- `prefers-reduced-motion: reduce` **et** `data-docbel-motion="reduced"` neutralisent
  animations, transitions, lift et scroll animé. Le changement d'état et son message
  accessible restent immédiatement visibles.
- Les décorations facultatives portent `data-a11y-secondary="true"` afin que le mode simple
  puisse les masquer. Le mode `forced-colors` retire verre, glow et ombres non essentiels.

## Règles « going forward »
1. Front : **jamais** `bg-white` / `#FFFFFF` en dur sur carte/panneau/champ → `.glass-surface`,
   helpers `lib/glass-classes.ts` (`GLASS_CARD`/`GLASS_INPUT`), ou héritage `.glass-root`.
2. Tout champ de formulaire front = **dépoli** (verre + `backdrop-filter`), jamais blanc plat.
3. Mouvement doux via les tokens `--motion-*`, toujours compatible `prefers-reduced-motion`
   **et** `data-docbel-motion="reduced"`.
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
Tester aussi clair/sombre, contraste normal/élevé, `forced-colors`, mouvement réduit,
clavier et zoom 200 %. Une information d'état doit rester compréhensible sans sa couleur.

## Incohérences couleur connues (backlog, cf. TECH_DEBT_QUEUE)
Défaut `#7C3AED`/`#C8102E` en dur dans certains charts/icônes → migrer vers `var(--primary)`/`--chart-*`.
