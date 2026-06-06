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
- **Aligner** des paires label/valeur : grille 2 colonnes
  (`grid grid-cols-[7rem_1fr]` + `dt`/`dd`), pas une suite de `flex` à largeurs
  variables (sinon les valeurs ne s'alignent pas).
- Pages : le back-office occupe **toute la largeur** (cf. « Ne pas faire » :
  `flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6`, jamais de `max-w-*` étroit sur le
  conteneur de page) ; remplir via grilles multi-colonnes, pas une colonne centrée.

**Avant de livrer une modale / sheet / page** : vérifier au navigateur (desktop
large) que rien n'est collé aux bords ni coincé dans une colonne centrée étroite.

## Points connus à améliorer

- Centraliser la couleur d'accent : l'accent réel est `#7C3AED`
  (défini comme variables CSS dans `app/globals.css`). Une ancienne
  couleur `#C8102E` traîne encore en dur dans 4 fichiers d'icônes
  (`components/icons/organismes/index.tsx`, `components/docbel/icons.tsx`,
  `components/docbel/bureau-callout.tsx`, `components/docbel/bureau-card.tsx`)
  à harmoniser.
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
