# STACK & COMMANDES — DocBel

Source = `package.json`. **Vérifier les versions installées avant toute modification.**

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
pnpm test             # suite Vitest complète
pnpm test:watch       # vitest
pnpm test:e2e         # playwright (skippé sans E2E_ADMIN_*)
pnpm i18n:check       # tsx scripts/i18n-validate.ts (ICU + couverture)
pnpm lint:i18n        # eslint config i18n
```

### ⚠️ Pièges commandes
- **Il n'y a PAS de `pnpm typecheck`.** Le typecheck passe par `pnpm build`.
- La CI utilise `pnpm lint --suppressions-location .github/eslint-suppressions.json` :
  les erreurs existantes sont recensées par fichier/règle ; toute erreur supplémentaire
  bloque. Ne pas régénérer cette baseline pour accepter une régression. Après réduction
  de la dette, ajouter `--prune-suppressions` à cette commande pour retirer les entrées
  devenues inutiles. Les avertissements restent visibles.
- Le build utilise `tsconfig.build.json`, qui hérite des options strictes et exclut
  uniquement les types temporaires `.next/dev/**`. Les types de production restent
  contrôlés ; aucun `ignoreBuildErrors` n'est activé.
- La CI exécute lint avec baseline, tests, i18n et build. Ses valeurs DB/auth sont
  factices ; aucun secret de production n'est nécessaire à la compilation.
- DB : `db:migrate`, `db:migrate:dev`, `db:generate`, `seed*`. **Jamais `db:push`
  sur la Neon partagée** (le script existe mais il est dangereux ici → SQL additif via
  `prisma db execute`).
- Les variables déjà définies dans le shell peuvent prendre le pas sur `.env.local`,
  y compris lorsqu'elles sont vides. Vérifier la configuration sans afficher de secret.
- Respecter les permissions de l'environnement utilisé ; aucune option de désactivation
  du sandbox propre à un ancien assistant n'est nécessaire au projet.

## Variables d'environnement
Modèle : `.env.example`. Clés requises minimales : `DATABASE_URL`, `DIRECT_URL`,
`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_BETTER_AUTH_URL`.
Secret critique sécurité : `BOOKING_NRN_SECRET` (NRN belge — voir SECURITY_QUEUE).
