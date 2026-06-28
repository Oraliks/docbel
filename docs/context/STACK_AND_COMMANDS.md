# STACK & COMMANDES — DocBel

Source = `package.json` (vérifié 2026-06-28). **Ne pas se fier au training data du modèle.**

## Versions réelles
| Brique | Version | Note |
|--------|---------|------|
| Next.js | **16.2.6** | App Router ; `params` = `Promise` ; server components par défaut |
| React | 19.2.4 | pas de `setState` synchrone en `useEffect` |
| TypeScript | 5 (strict) | `tsconfig` strict ; rien de masqué dans `next.config.ts` |
| Prisma | **5.22** | (pas 7) + PostgreSQL/Neon |
| better-auth | 1.6.9 | **PAS NextAuth** ; config unique `lib/auth.ts` |
| Tailwind | 4 | + shadcn 4 (CLI en devDeps) |
| UI primitives | **base-ui** 1.4 | pas Radix pur |
| next-intl | 4.13 | clés typées |
| Zod | **4** | `.prefault()` pour deep-fill |
| Tiptap | 2.x | éditeur de pages |
| Recharts | 3.8 · lucide-react **1.x** · Phosphor 2.x | |
| pnpm | 10.33 | `engines: node>=20, pnpm>=10` |

## Commandes
```bash
pnpm install
pnpm dev              # next dev --webpack (localhost:3000)
pnpm build            # next build (= build + typecheck de prod)
pnpm start            # serveur prod après build
pnpm lint             # eslint
pnpm test             # vitest run (271 tests)
pnpm test:watch       # vitest
pnpm test:e2e         # playwright (skippé sans E2E_ADMIN_*)
pnpm i18n:check       # tsx scripts/i18n-validate.ts (ICU + couverture)
pnpm lint:i18n        # eslint config i18n
```

### ⚠️ Pièges commandes
- **Il n'y a PAS de `pnpm typecheck`.** Le typecheck passe par `pnpm build`.
- `pnpm lint` sort en **exit 1** : ~74 erreurs ESLint **pré-existantes**. Objectif =
  ne pas en ajouter, pas « faire passer le lint » d'un coup.
- DB : `db:migrate:deploy`, `db:migrate:dev`, `db:generate`, `seed*`. **Jamais `db:push`
  sur la Neon partagée** (le script existe mais il est dangereux ici → SQL additif via
  `prisma db execute`).
- Serveur dev : l'environnement Claude injecte parfois `ANTHROPIC_API_KEY=""` qui casse
  les endpoints IA → lancer `pnpm dev` depuis un PowerShell qui nettoie la variable.
- Bash sandboxé (défaut) peut revert les fichiers **trackés** à HEAD → pour git/build/test
  toucher des fichiers trackés, utiliser le mode `dangerouslyDisableSandbox`.

## Variables d'environnement
Modèle : `.env.example`. Clés requises minimales : `DATABASE_URL`, `DIRECT_URL`,
`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_BETTER_AUTH_URL`.
Secret critique sécurité : `BOOKING_NRN_SECRET` (NRN belge — voir SECURITY_QUEUE).
