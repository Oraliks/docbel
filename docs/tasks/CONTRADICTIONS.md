# CONTRADICTIONS & zones à clarifier

Vérifié le 2026-06-28 contre le code actuel. **Conclusion centrale : `AUDIT.md`
(2026-05-29) est partiellement périmé** — plusieurs items P0/P1 sont déjà résolus.
Toujours recouper l'audit tech avec le code avant d'agir.

## A. AUDIT_TECH déjà résolu (ne PAS re-travailler)
| Item audit | Affirmation | Réalité (2026-06-28) | Source |
|---|---|---|---|
| P0 #1 | `next@16.2.4` vulnérable | **`next@16.2.6`** | `package.json:115` |
| P0 #3 | build couplé à `migrate deploy` | build = `next build` (**découplé**) | `package.json:12` |
| P0 #4 | `.env.example` sans clés IA | clés IA/Blob/quota **présentes** | `.env.example` |
| P1 #8 | README/AGENTS disent « NextAuth v5 » | disent déjà **better-auth** | `README.md:12,85` `AGENTS.md:26` |
| P1 #9 | `@prisma/client` en devDeps / `shadcn` en deps | **inversé correctement** | `package.json:76,164` |
| P3 #17 | `lib/lucide-icons-catalog.ts.bak` | fichier **absent** | (glob) |
| P3 #21 | pas d'`engines`, README « pnpm 11+ » | `engines` présent, README « pnpm 10+ » | `package.json:6` |

**Décision** : marquer ces lignes comme obsolètes dans l'audit (fait en tête de
`docs/audits/AUDIT_TECH_2026-05-29.md`). Ne pas les remettre dans les queues.

## B. AUDIT_TECH vs AUDIT_RGPD (le RGPD, plus récent, gagne)
| Sujet | AUDIT_TECH (05-29) | AUDIT_RGPD (06-06) | Décision |
|---|---|---|---|
| Sanitization HTML | « HTML brut non assaini » (P1 #5) | « sanitization isomorphe sur **tous** les 17 `dangerouslySetInnerHTML` » (Axe 4) | RGPD à jour → **vérifier `lib/sanitize-html.ts` couvre bien article-view + page-blocks** avant toute action |
| Cookie `beldoc-bundle-session` | `httpOnly:false` (P1 #7) | « httpOnly OK contrairement à AUDIT.md **obsolète** » | Probablement corrigé → vérifier la route `bundles/resume` puis clore |

→ Ces deux points passent en **« à vérifier »** dans SECURITY_QUEUE, pas en « à corriger ».

## C. Statuts « terminé » trompeurs
- `.work-plan.md` : « ✅ TERMINÉ » mais section « TODOs non câblés » (pin/archive sessions,
  DELETE message, AbortSignal, retry 429). → archivé ; les vrais restes vont en TECH_DEBT.
- `ONBOARDING_IMPLEMENTATION.md` : se dit « supprimable une fois intégré » et recommande
  `pnpm db:push`. → archivé ; **ne jamais suivre le `db:push`** (Neon partagée).

## D. Footguns documentés
- **README `db:setup` → `prisma db push`** : dangereux si `DATABASE_URL` pointe la Neon
  partagée (détruit pgvector + tables PDF). → note d'avertissement ajoutée au README.
- `.env.example` incomplet pour des clés **réellement utilisées** : `BOOKING_NRN_SECRET`
  (critique), `RESUME_CODE_SECRET`, `STRIPE_SECRET_KEY`, `KBO_OPEN_DATA_*`,
  `DEMO_ACCOUNTS_PASSWORD`, `IBAN_NAME_PROVIDER`, `*_AI_PROVIDER`, `UNSPLASH_ACCESS_KEY`,
  `NEXT_PUBLIC_SITE_URL`/`APP_URL`, `DECISION_TREE_RUNTIME_ENABLED`. → complété (quick win).
  (`NEXTAUTH_SECRET`/`AUTH_SECRET` apparaissent en fallback legacy → à ne pas documenter,
  voire retirer du code — à confirmer.)

## E. À trancher par le propriétaire (décisions produit/design)
- CTA front en clair : encre dark-violet sobre **ou** Violet `#5B46E5` ? (AGENTS « points connus »).
- Forme juridique du responsable de traitement (personne physique vs société) — bloque
  les mentions légales RGPD.
