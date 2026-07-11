# Paramètres globaux du site (`/admin/parametres`) — Design

**Date :** 2026-07-11
**Statut :** approuvé (exécution autonome)
**Objectif d'une session :** doter DocBel d'un module d'administration centralisé
« type SaaS/CMS » pour piloter l'identité du site, le SEO, la maintenance et les
réglages globaux — sans redéploiement, sans migration destructive.

## Problème

L'identité du site (nom, slogan, URL, branding) est **codée en dur** dans
`app/layout.tsx` et dispersée dans des env vars. Les réglages existants
(templates d'emails, toggles IA, RGPD, module Formations) sont **éparpillés**
dans une dizaine de pages admin. Il n'existe aucune page centrale de paramètres.

## Contraintes (rappel projet)

- **Pas de `prisma db push`** sur la Neon partagée → on réutilise le modèle
  `AppSetting` (key/value) existant. **Zéro migration.**
- **Jamais de secret en DB** : les clés API restent en env ; l'admin n'affiche
  que leur *statut* (configurée / absente).
- Admin = design shadcn blanc + accent violet. Lots de 3–5 fichiers, commits
  fréquents, `git add` de chemins explicites (workdir partagé multi-agents).
- Lint déjà rouge (~75 erreurs préexistantes) — ne pas en ajouter.

## Architecture

### Store : `lib/site-settings.ts` (nouveau)

Une clé `AppSetting` unique `site_settings` contenant **un objet JSON validé
Zod**, sur le modèle éprouvé de `formations_module`. Avantages : zéro migration,
défauts sûrs en code, une seule lecture DB pour tout le bloc identité.

```
SiteSettings = {
  identity:    { name, tagline, url, contactEmail, contactPhone, socials{...} }
  seo:         { titleTemplate, defaultDescription, ogImageUrl, noindex, verification{google,bing} }
  maintenance: { enabled, message, allowAdminBypass }
  announcement:{ enabled, level, message, startsAt?, endsAt?, segments[] }
  legal:       { retentionDays, consentVersion }   // se branche sur le chantier RGPD
}
```

Fonctions pures + I/O :
- `getSiteSettings()` : lit `AppSetting`, `safeParse` Zod, merge sur `DEFAULTS`
  (tout champ absent/invalide retombe sur le défaut → jamais de crash).
- `setSiteSettings(patch, updatedBy)` : merge + validate + upsert + invalide le cache.
- `SITE_SETTINGS_DEFAULTS` exportés (source de vérité des valeurs actuelles).
- **Cache** : `unstable_cache` tag `site-settings`, invalidé via `revalidateTag`
  à chaque écriture (header/footer/metadata lisent à chaque vue → cache obligatoire).

### API : `app/api/admin/site-settings/route.ts` (nouveau)

`GET` (renvoie settings courants + défauts + updatedAt/By) et `PATCH` (merge
partiel validé Zod). Protégé par `requireAdminAuth`. On garde l'API générique
`/api/admin/settings/[key]` pour les clés simples existantes.

### UI : `app/admin/parametres/` (nouveau)

Page serveur + client à **onglets** (composant Tabs shadcn du repo), design admin
standard. Un composant de section réutilisable (form contrôlé, bouton Enregistrer,
mention « modifié par X le Y », toast succès/erreur) cloné par onglet pour la
cohérence.

**Onglets livrés cette session (MUST) :**
1. **Général** — nom, slogan, URL, contact, réseaux sociaux. *Consommé en live.*
2. **SEO & partage** — template de titre, meta description, image OG, toggle
   `noindex` global, balises de vérification.
3. **Maintenance & annonces** — mode maintenance (message + bypass admin) +
   bannière d'annonce globale (niveau, message, planning, ciblage segment).

**Onglets de regroupement (NICE, si le temps le permet) :**
4. **Emails** — re-surface les templates existants (document/invitations) + bouton test.
5. **Intégrations** — les 4 toggles IA + `billing_enabled` + statut des clés env.
6. **Conformité** — texte RGPD existant + rétention + version de consentement.

### Consommation (rewiring)

- `app/layout.tsx` → `generateMetadata()` lit `getSiteSettings()` (title,
  description, `metadataBase`, `robots.noindex`, OG). Fallback env/défaut conservé.
- **Footer public** → nom, slogan, socials, contact depuis settings.
- **Header public** → nom du site depuis settings.
- **Maintenance gate** + **bannière d'annonce** → montés dans le layout public
  (jamais sur `/admin`, jamais sur `/api/auth`), bypass admin via session.
- `app/robots.ts` / `app/sitemap.ts` si présents → base URL depuis settings.

## Sécurité & garde-fous

- Écriture réservée admin (`requireAdminAuth`).
- Validation Zod stricte à l'écriture (longueurs, URL, enum niveau/segment).
- Maintenance : le gate ne s'applique **jamais** à `/admin`, `/api/auth`,
  `/api/admin` ; bypass explicite pour session admin active.
- `noindex` : purement additif dans `robots` metadata, réversible en un clic.

## Tests

- `lib/site-settings.test.ts` (vitest, pures) : parse d'un JSON valide, merge des
  défauts sur JSON partiel, rejet/retombée sur défaut d'un JSON corrompu,
  round-trip set→get, bornes de validation (URL invalide, message trop long).
- Build vert (`pnpm build` = build + typecheck), pas de nouvelle erreur lint.

## Phasage (lots ≤ 5 fichiers, commit entre chaque)

- **Lot 1 — Fondation :** `lib/site-settings.ts` + `lib/site-settings.test.ts` +
  API route + défauts. Aucune UI. → tests verts.
- **Lot 2 — Shell + onglet Général :** page `/admin/parametres` à onglets +
  entrée sidebar + onglet Général branché sur metadata + footer + header.
- **Lot 3 — SEO :** onglet SEO + consommation dans `generateMetadata` + robots.
- **Lot 4 — Maintenance & annonces :** onglet + gate + bannière (layout public).
- **Lot 5 (option) :** onglets de regroupement Emails/Intégrations/Conformité.

Chaque lot est indépendamment shippable. Les lots 1–4 constituent le cœur
« SaaS/CMS » demandé ; le lot 5 est de la consolidation d'existant.

## Hors périmètre (YAGNI cette session)

- Processeur de paiement (le flag `billing_enabled` existe déjà, on l'expose sans
  brancher Mollie/Stripe).
- Slogan multilingue par langue (on stocke un slogan par défaut ; l'i18n fin des
  textes publics reste géré par le chantier i18n dédié).
- Historique/versioning complet des réglages (au-delà de `updatedAt`/`updatedBy`).
- Export/import JSON des réglages (candidat lot 6 ultérieur).
