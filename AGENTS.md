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

- Rôles : `user`, `moderator`, `admin` (enum Prisma `UserRole`).
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

## Points connus à améliorer

- Centraliser la couleur d'accent : l'accent réel est `#7C3AED`
  (défini comme variables CSS dans `app/globals.css`). Une ancienne
  couleur `#C8102E` traîne encore en dur dans 4 fichiers d'icônes
  (`components/icons/organismes/index.tsx`, `components/docbel/icons.tsx`,
  `components/docbel/bureau-callout.tsx`, `components/docbel/bureau-card.tsx`)
  à harmoniser.
- Extraire un composant `<UserFormFields/>` partagé entre
  `create-user-dialog.tsx` et `edit-user-dialog.tsx`.
- Passer la validation API à Zod plutôt que manuelle.
- Ajouter du rate-limit sur les endpoints publics
  (`contact-messages`, `newsletter`).
