# I18N_RULES — Internationalisation (next-intl)

Lecture **quand on ajoute/modifie du texte user-facing**. Le détail complet existe déjà :
- Conventions : `docs/i18n-conventions.md`
- Plan de déploiement / modèles traduisibles : `docs/i18n-rollout-plan.md`
- Glossaire : `docs/i18n-glossaire.md` · Système : `docs/i18n-systeme.md`

## Règles critiques (résumé)
- **Tout texte user-facing passe par next-intl.** Pas de chaîne en dur dans le JSX.
- Client : `const t = useTranslations("admin.<section>")` ; serveur (async) :
  `const t = await getTranslations("admin.<section>")`.
- Clés dans `messages/fr.json` (source) ; les autres langues retombent sur FR.
- Clés **typées** (`i18n/global.ts`) → une clé absente casse `tsc`/`build`.
- Dates/nombres : helpers `lib/i18n/format.ts`. **Jamais** de locale codée en dur
  (`toLocaleDateString("fr-BE")` interdit).
- Nouveau modèle DB traduisible → pattern `ContentTranslation` (cf. rollout-plan).
- Registre des langues : `i18n/locales.ts`.

## Validation
```bash
pnpm i18n:check     # syntaxe ICU + couverture par langue
pnpm lint:i18n      # règle eslint i18next (texte en dur)
```

## Pièges
- `app/[slug]` est un **catch-all** → attention aux collisions de routes localisées.
- Gros volume = codes ONEM (non traduits, FR/NL + fallback) ; le vrai contenu traduisible
  est limité. Ne pas lancer une refonte i18n massive sans plan dédié.
