# AGENTS.md

Guide pour Codex / Claude Code travaillant sur ce dépôt.
Voir [README.md](README.md) pour l'installation et les commandes.

## Vue d'ensemble

**DocBel** est une application Next.js 16 (App Router, React 19) qui sert
de portail aux citoyens belges pour les démarches administratives liées
au chômage, au CPAS et à l'emploi.

L'app combine :

- des pages publiques (accueil, actualités, outils, contact),
- un back-office admin (gestion utilisateurs, actualités, outils,
  fichiers, barèmes, pages dynamiques),
- une API REST sur `app/api/**`.

## Stack — ne pas se fier au training data

- **Next.js 16.2.4** : App Router, `params` est un `Promise<...>` dans
  les routes API, server components par défaut. Toujours consulter
  `node_modules/next/dist/docs/` plutôt que la mémoire.
- **React 19.2** : ne pas appeler `setState` synchrone dans un `useEffect`
  (ESLint plante via `react-hooks/set-state-in-effect`).
- **better-auth** : configuration unique dans [`lib/auth.ts`](lib/auth.ts).
  Email/mot de passe (bcrypt) + magic link, OAuth Google partenaire optionnel,
  sessions en base via l'adaptateur Prisma.
- **Prisma 5** + PostgreSQL.
- **Tailwind CSS 4** + **shadcn/ui v4**.
- **TypeScript 5** strict.

## Conventions API

Toutes les routes vivent dans `app/api/**/route.ts` et exportent
des fonctions HTTP (`GET`, `POST`, `PATCH`, `PUT`, `DELETE`).

- **Auth admin** : utiliser [`requireAdminAuth`](lib/auth-check.ts) au
  début de toute route qui modifie des données ou expose du privé.
  Cette helper revérifie en base que l'utilisateur est encore actif et
  admin (le JWT seul ne suffit pas).
- **Réponses JSON** : passer
  `headers: { "Content-Type": "application/json; charset=utf-8" }`
  pour préserver les accents.
- **Pagination** : toujours borner `findMany` avec `take` raisonnable.
- **Validation** : pour l'instant validation manuelle (cf.
  [`lib/users.ts`](lib/users.ts) et `app/api/users/route.ts`). Zod est
  installé mais non encore généralisé.

## Modèle utilisateur

- Rôles : `user`, `partner`, `employer`, `moderator`, `admin` (enum Prisma
  `UserRole`). Le compte porte aussi un `segment` (`citoyen`/`employeur`/
  `partenaire`) + `partnerType` ; l'accès aux outils passe par `canUseTool`
  ([`lib/entitlements.ts`](lib/entitlements.ts)).
- Statuts : `active`, `pending`, `disabled`, `locked` (enum
  `UserStatus`).
- 5 échecs de login ⇒ verrouillage 15 minutes
  (cf. constantes en haut de [`lib/auth.ts`](lib/auth.ts)).
- Mots de passe hashés avec `bcryptjs` (10 rounds).
- Helpers de validation dans [`lib/users.ts`](lib/users.ts) :
  `validatePassword`, `isUserRole`, `isUserStatus`,
  `normalizeEmail`, `serializeUser`, `SAFE_USER_SELECT`.

## Outils dynamiques

Le mapping `tool.type` → vue est dans
[`components/docbel/tool-page.tsx`](components/docbel/tool-page.tsx).
Les types réels (avec underscore) :

- `calc_preavis`, `calc_agr`, `calc_cp` → calculateurs
- `locator` → annuaires
- `tutorial` → guides
- `info` → FAQ
- `link` → liens externes
- `form`, `doc`, `calc` → flux générique `FormFlow`

Données par défaut côté client dans [`lib/docbel-data.ts`](lib/docbel-data.ts),
côté admin via les modèles `ToolSection` / `Tool` en base.

## Fichiers et stockage

Les uploads passent par `app/api/files/upload/route.ts` qui valide
extension + MIME + taille (25 Mo max). Stockage sur disque dans
`public/uploads/` (publics) ou `private/uploads/` (privés). Les fichiers
privés ne se téléchargent qu'authentifié comme admin via
`app/api/files/[id]/download/route.ts`.

## Préavis (calculateur)

Les barèmes officiels sont stockés dans
`lib/notice-periods-official.json`. La route
`app/api/admin/preavis/route.ts` expose :

- `GET` (public, lecture seule) — utilisé par
  `components/docbel/tool-page.tsx` pour afficher la source et la date
  de mise à jour.
- `PUT` (admin uniquement) — édition via
  `components/admin/preavis-editor.tsx`.

## Ne pas faire

- ❌ Committer `.env`, `.env.local` ou un fichier `.db`.
- ❌ Hardcoder `createdBy: "admin"` ou `logActivity("Admin", …)` :
  utiliser `authCheck.user.id` / `authCheck.user.name`.
- ❌ Réutiliser le helper `requireAdmin` local : un seul helper,
  `requireAdminAuth` de `lib/auth-check.ts`.
- ❌ Copier-coller `(session.user as { role?: string })` : la dette
  de typage de la session est connue, à factoriser via
  `declare module "next-auth"` quand on y touche.
- ❌ Ajouter du `useEffect` qui fait `setState` synchrone — ESLint
  refuse.
- ❌ Rétrécir les pages/cards du **back-office** avec un `max-w-*` étroit
  (`max-w-md/lg/xl/2xl`) sur le conteneur de page. Les pages admin, cards et
  formulaires doivent occuper **toute la largeur de contenu** (modèle :
  `/admin/users` → `flex flex-col gap-6 py-6 px-4 md:px-6`, sans `max-w`). Pour
  un formulaire à peu de champs, remplir la largeur via une grille
  multi-colonnes (`grid sm:grid-cols-2 lg:grid-cols-3`) plutôt qu'une colonne
  étroite. (Exception voulue : les pages publiques `login` / `inscription`,
  volontairement centrées et étroites.)

## Mise en page : modales, sheets & largeurs (⚠️ erreurs récurrentes)

Les overlays de `components/ui/` n'ont pas le même padding interne — le **contenu**
doit s'adapter, sinon il est collé aux bords (effet « formaté sans CSS ») :

- **`DialogContent`** porte déjà `p-4` → ne PAS re-padder le corps ; structurer
  avec `DialogHeader` / `DialogFooter`.
- **`SheetContent` n'a AUCUN padding** (`p-0`) ; seuls `SheetHeader` / `SheetFooter`
  ont `p-4`. Le **corps** d'un Sheet DOIT porter son propre padding (`px-4 pb-6`).
  Modèle correct : `BookingDetail` dans `components/booking/agenda-client.tsx`.
- **Élargir** un `*Content` exige le préfixe `sm:` (`sm:max-w-2xl`), sinon le défaut
  responsive (dialog `sm:max-w-lg`, sheet `sm:max-w-md`) le recoiffe à ≥640px.
- **`Select`** (`components/ui/select.tsx`) est bâti sur **Base UI**, pas Radix :
  `<Select.Value/>` n'affiche le **label** de l'option choisie que si la `Root`
  connaît le mapping valeur→label (prop `items`). Le wrapper `Select` du repo
  **dérive ce mapping automatiquement** depuis les `<SelectItem>` enfants → garder
  ce wrapper (ne PAS le réduire à `SelectPrimitive.Root` nu, sinon le trigger
  réaffiche le code brut, ex. `__none__`). Continuer à écrire
  `<SelectItem value="code">Label</SelectItem>` ; le placeholder reste géré par
  `<SelectValue placeholder=…/>` quand aucune valeur n'est sélectionnée.
- **Aligner** des paires label/valeur : grille 2 colonnes
  (`grid grid-cols-[7rem_1fr]` + `dt`/`dd`), pas une suite de `flex` à largeurs
  variables (sinon les valeurs ne s'alignent pas).
- Pages (back-office) : le back-office occupe **toute la largeur** (cf. « Ne pas
  faire » : `flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6`, jamais de `max-w-*`
  étroit sur le conteneur de page) ; remplir via grilles multi-colonnes, pas une
  colonne centrée.
- Pages (front public « glass ») : le front vit **déjà** dans le shell centré
  `max-w-[1840px]` + padding posé par
  [`app-layout-client.tsx`](components/docbel/app-layout-client.tsx). Une nouvelle
  page front NE re-pose **jamais** de `max-w-*` / `container` / `mx-auto` sur son
  **conteneur racine** → sinon effet « collé au centre » incohérent avec le reste
  (modèle correct : `/mon-dossier`, qui remplit tout le shell). Patron racine :
  `<section className="flex w-full flex-col gap-6">` (ou `gap-8`, cf.
  `/mon-dossier`). Les `max-w-*` ne sont tolérés QUE sur un **élément de texte**
  (`<p>`/`<h*>`, pour la mesure de lecture) ou un **empty-state centré** (« bientôt
  disponible », accès restreint, page d'erreur). **Exception assumée** : l'auth
  (`login` / `inscription*` / `mot-de-passe-*`) reste volontairement
  centrée-étroite (écrans split).

**Avant de livrer une modale / sheet / page** : vérifier au navigateur (desktop
large) que rien n'est collé aux bords ni coincé dans une colonne centrée étroite.

## Design — charte visuelle (SITE ENTIER) ⭐

**La direction artistique de référence est la planche moodboard fournie par
le propriétaire** (« Comment recréer ce style visuel »). Toute UI **publique**
(accueil, actualités, outils, calculateurs, contact, profil, démarches) DOIT
s'y conformer pour rester uniforme. Mot-clé : **douceur, clarté, confiance,
accessibilité**.

**Esprit** : pastel premium, UI moderne + illustrations 3D douces, calme,
léger, rassurant ; administratif mais chaleureux.

**Palette officielle** (déclinée en variables `--glass-*` dans
[`app/globals.css`](app/globals.css)) :

| Rôle | Hex |
|------|-----|
| Lavande | `#CDBBFF` |
| Violet CTA | `#5B46E5` |
| Rose pâle | `#FFD6E8` |
| Lilas | `#E9E0FF` |
| Blanc cassé | `#FAF7FF` |
| Gris doux | `#E7E3EF` |

**UI details** : boutons d'action violets ; badges/pastilles pastel ; **coins
très arrondis (12–24px)** ; **fines bordures (1px)** ; **ombres diffuses et
profondes** (jamais dures) ; icônes simples et cohérentes.

**À ÉVITER absolument** :

- ❌ **Blanc pur (`#FFFFFF`) sur une surface du front** → utiliser Blanc cassé
  `#FAF7FF` / Lilas / le verre translucide. Le blanc pur « fait mal aux yeux »
  sur le fond mauve.
- ❌ Couleurs trop saturées / criardes (y compris re-teinter les cartes verre en
  violet vif — elles sont volontairement pâles).
- ❌ Ombres dures, rendu plat sans profondeur, angles droits / cartes lourdes,
  style corporate froid et impersonnel.

**Comment c'est câblé dans le code** (2 langages de design — cf.
mémoire projet) :

- **Front = « glass mauve »**. Tout vit sous `.glass-root` (posé par
  [`components/docbel/app-layout-client.tsx`](components/docbel/app-layout-client.tsx)).
  Primitives dans `app/globals.css` : `.glass-surface` (carte dépolie),
  `.glass-interactive` (lift + ombre diffuse + focus, respecte
  `prefers-reduced-motion`), `.glass-display`, tokens `--glass-*`.
- **Composants shadcn rendus sous `.glass-root`** héritent automatiquement du
  verre : un bloc `.glass-root { --card/--popover/--input/--border/--ring… }`
  remappe les tokens shadcn vers les variables verre, et des règles givrent les
  surfaces (`[data-slot="card"|"popover-content"|…]`) et les **champs**
  (`input/select/textarea`, shadcn **et** natifs → `background: var(--glass-surface)`
  + `backdrop-filter`). ⇒ un nouveau composant shadcn sur le front est déjà
  on-charte sans rien faire.
- **Admin / espaces pro / auth** (hors `.glass-root`) = **shadcn aligné sur la
  MÊME palette** (PAS de verre). Les tokens shadcn `:root`/`.dark` sont déjà
  migrés sur la charte : `--card #FAF7FF`, `--popover #FAF7FF`, `--background
  #F4EEFF`, `--primary`/`--accent`/`--ring #5B46E5`, `--border #E7E3EF`,
  `--radius 0.875rem`. Règles : **jamais** de hex en dur ni `bg-white` → utiliser
  `bg-card` / `border-border` / `text-muted-foreground` / `bg-primary` /
  `bg-sidebar` ; cartes via `<Card>` (`rounded-xl` + `ring-1` + ombre douce) ;
  pages/tables/formulaires **pleine largeur** ; **inputs shadcn standard** (NON
  dépolis — le frost est réservé au glass) ; charts : couleurs via `--chart-*` /
  `var(--primary)`. **Ne JAMAIS** mettre `.glass-*` / `backdrop-filter` sur
  l'admin (tables denses → lisibilité WCAG + perf de scroll). Dark admin/pro =
  simple bascule `.dark` (slate shadcn), **pas** le néon glass du front.

**Quel langage où ?** (source de vérité : `resolveProSegment` +
early-returns dans `app-layout-client.tsx`) :

| Zone | Routes | Langage |
|------|--------|---------|
| Front public | `/`, `/actualites`, `/outils*`, calculateurs, `/contact`, `/profil`, `/p/*` | **Glass mauve** (`.glass-root`) |
| Pro connecté | `/partenaire*`, `/employeur*` (rôle partner/employer) | **shadcn palette** (`ProShell`) |
| Back-office | `/admin/**` | **shadcn palette** (`AppSidebar`) |
| Auth | `/login`, `/inscription*`, `/mot-de-passe-oublie`, `/reinitialiser-mot-de-passe` | shadcn split full-page |

**Dark mode — premium « néon glassmorphism »** (planche DARKMODE fournie ;
toggle thème dans le header). Ce n'est PAS un simple inverse du clair, c'est une
ambiance à part entière :

- Fond **noir-violet profond** (Bg Main `#070617`, Soft `#0D0A22`, Card
  `#14102B`) avec **halos violet/rose ambiants** (`.dark .glass-root::before`).
- Accents **vifs** : Purple `#8B5CF6`, Purple Light `#C084FC`, Pink `#FF5FA2`,
  Coral `#FF7A7A` ; texte `#F7F2FF`.
- **Glassmorphism** : surfaces translucides violettes, **bordure violette
  discrète**, **ombre profonde + glow** (intensifié au hover via
  `.dark .glass-interactive:hover`).
- Titres : mots accentués en **dégradé violet→rose** (`.dark .glass-display em`).
- Dégradé primaire (CTA / cartes « featured ») violet→rose (`--glass-status-*`).
- Transitions douces 200-300ms, glow plus intense au hover/focus, flottement
  d'icônes lent. **À éviter (dark)** : couleurs criardes, cartes plates, ombres
  dures, style enfantin.
- Tout passe par `.dark { --glass-* }` + quelques règles `.dark .glass-*` dans
  `app/globals.css` → tout le front en hérite, rien à faire par composant.
- ✅ Implémenté : CTA `.glass-cta` (dégradé violet + glow en dark), tuiles
  `.glass-icon-tile` (glow néon), bulles d'icônes flottantes Phosphor +
  illustration 3D (`public/3d/`, asset CC0) dans le hero.

**Règles « going forward »** :

1. Sur le front, **ne jamais** poser `bg-white`/`bg-[#fff]`/`#FFFFFF` en dur sur
   une carte, un panneau ou un champ. Utiliser `.glass-surface`, les helpers
   [`lib/glass-classes.ts`](lib/glass-classes.ts) (`GLASS_CARD`/`GLASS_INPUT`),
   ou laisser les composants shadcn hériter via `.glass-root`.
2. Tout champ de formulaire du front doit être **dépoli** (fond verre +
   `backdrop-filter`), jamais blanc plat.
3. Coins 12–24px, bordures 1px, ombres diffuses ; mouvement **doux** et
   `prefers-reduced-motion`-safe (réutiliser `.glass-interactive`, `fadeInUp`,
   `.outils-rise`, `.animate-heart-pop`, `.animate-soft-sheen`).
4. Avant de livrer : vérifier au navigateur qu'**aucune** surface du front ne
   ressort en blanc dur sur le mauve.

## Points connus à améliorer

- Accent : migration vers Violet CTA `#5B46E5` **faite** (commit `1ac88c3` :
  `--primary`/`--accent`/`--ring`/`--glass-accent-deep` en clair, `#7C6BF0` en
  dark). Restent 3 incohérences : (a) défaut codé en dur `#7C3AED` (ancien
  accent) dans les graphiques `components/page-blocks/charts/*-chart-view.tsx`
  → mettre `var(--primary)` / `--chart-*` ; (b) `#C8102E` en dur dans 4 fichiers
  d'icônes (`components/icons/organismes/index.tsx`, `components/docbel/icons.tsx`,
  `components/docbel/bureau-callout.tsx`, `components/docbel/bureau-card.tsx`) ;
  (c) CTA `.glass-cta`/auth en encre dark-violet en **clair** (décision à
  trancher : garder le sobre, ou passer Violet `#5B46E5`).
- Extraire un composant `<UserFormFields/>` partagé entre
  `app/admin/users/new/page.tsx` et `components/users/edit-user-form.tsx`
  (création / édition d'utilisateur sont désormais des pages, plus des modals).
- Passer la validation API à Zod plutôt que manuelle.
- Ajouter du rate-limit sur les endpoints publics
  (`contact-messages`, `newsletter`).

## Performance & UX App

Règles courtes, **obligatoires** à relire avant toute modif importante du
shell, d'un dashboard ou d'une route lourde. Détail + exemples dans
[docs/performance.md](docs/performance.md).

- Le shell (header public, sidebar admin, layout) reste **stable** pendant les
  navigations : pas de spinner plein écran, pas de layout qui saute. La sidebar
  admin highlight la route active et ouvre le bon groupe (`nav-main.tsx`).
- Toute route lourde a un `loading.tsx` **adapté à sa vraie structure UI**, pas
  un skeleton générique. Réutiliser les briques de
  [`components/ui/skeletons.tsx`](components/ui/skeletons.tsx) — **interdiction
  de dupliquer** des skeletons similaires.
- Le premier rendu critique reste **côté serveur / RSC** quand c'est possible
  (modèles : `app/page.tsx`, `app/actualites/page.tsx`,
  `app/admin/employeurs/stats`). Ne pas migrer des données serveur critiques
  vers un fetch client `useEffect`. **Pas de TanStack Query** ici : critique →
  RSC ; secondaire/à la demande → API + cache (`lib/data-client.ts`).
- **Zustand** (seulement `lib/page-builder/store.ts` + `confirm-dialog`) sert
  l'état UI local (onglets, drawers, sélection, état optimiste, undo/redo
  éditeur). Ne **jamais** y stocker de données serveur lourdes / listes /
  analytics.
- Les composants lourds non visibles au démarrage (dialogs, drawers, éditeurs
  TipTap, graphiques recharts, cartes leaflet/d3, OCR, PDF) doivent être
  `next/dynamic` (ssr:false si DOM-only) avec fallback dimensionné. Pattern de
  référence : `components/admin/changelog-manager.tsx`.
- Ne pas charger toutes les variantes d'une page si une seule vue est visible
  au premier écran (onglets : ne monter/charger que l'onglet actif).
- Listes filtrées/paginées : pousser pagination + filtres **côté DB/API**
  (`where`, `take`/`skip`), jamais charger toute la table puis filtrer en JS.
  `findMany` **toujours borné** par un `take` raisonnable.
- Index DB : additifs uniquement (`CREATE INDEX CONCURRENTLY`, cf.
  [`prisma/perf-indexes.sql`](prisma/perf-indexes.sql)). ⚠️ Base Neon partagée
  → **jamais `db push`**.
- Après une modif du shell / dashboard / journal / settings / route critique :
  vérifier navigation rapide desktop **+ mobile** et l'absence d'erreurs
  console.
