# DocBel

Portail Next.js fournissant aux citoyens belges un point d'entrée unique pour
les documents administratifs, calculateurs et démarches liés au chômage,
au CPAS et à l'emploi.

## Stack

- **Next.js 16** (App Router, React 19)
- **TypeScript** strict
- **Prisma** + PostgreSQL (Neon en dev/prod)
- **NextAuth v5** (provider Credentials, JWT)
- **Tailwind CSS 4** + **shadcn/ui** (Radix)
- **Tiptap** pour l'éditeur de pages

## Prérequis

- Node.js 20+
- pnpm 11+
- Une base de données PostgreSQL accessible

## Installation

```bash
git clone <url-du-repo>
cd beldoc
pnpm install
```

Crée un fichier `.env.local` à partir du modèle :

```bash
cp .env.example .env.local
```

Renseigne au minimum :

- `DATABASE_URL` : chaîne de connexion PostgreSQL.
- `NEXTAUTH_SECRET` : généré avec `openssl rand -base64 32`.

## Initialisation de la base

```bash
pnpm db:setup
```

Cette commande :

1. applique le schéma Prisma (`prisma db push`),
2. exécute le seed (`prisma/seed.ts`),
3. crée un compte admin et un compte membre via
   `scripts/setup-local-auth.ts` (lit
   `DOCBEL_ADMIN_EMAIL` / `DOCBEL_ADMIN_PASSWORD` /
   `DOCBEL_MEMBER_EMAIL` / `DOCBEL_MEMBER_PASSWORD` dans `.env.local`).

## Développement

```bash
pnpm dev        # Next.js dev server (http://localhost:3000)
pnpm lint       # ESLint
pnpm build      # build de production
pnpm start      # serveur production (après build)
```

## Structure

```
app/                 Routes Next.js (App Router)
  api/               Endpoints REST
  admin/             Back-office (protégé par middleware d'auth)
  actualites/        Articles publics
  outils/[slug]/     Outils dynamiques
components/
  docbel/            Composants spécifiques DocBel (sidebar, hero, tools…)
  admin/             Composants du back-office
  page-builder/      Éditeur de pages WYSIWYG
  ui/                Composants shadcn
lib/                 Utilitaires partagés (auth, prisma, validation…)
prisma/              Schéma + seed
scripts/             Scripts de bootstrap
```

## Auth

L'authentification utilise NextAuth v5 avec un provider Credentials.
Les comptes ont quatre statuts (`active`, `pending`, `disabled`, `locked`)
et un compteur d'échecs de connexion : 5 échecs verrouillent le compte
pour 15 minutes (voir [`auth.ts`](auth.ts)).

Les routes API sensibles utilisent [`requireAdminAuth`](lib/auth-check.ts)
qui vérifie en base que l'utilisateur est encore actif.

## Déploiement

Variables d'environnement requises côté provider (Vercel, Netlify…) :

| Clé | Description |
|-----|-------------|
| `DATABASE_URL` | URL PostgreSQL de production |
| `NEXTAUTH_SECRET` | Secret JWT généré aléatoirement |
| `NEXTAUTH_URL` | URL publique de l'application |

Ne jamais committer `.env` ni `.env.local`.
