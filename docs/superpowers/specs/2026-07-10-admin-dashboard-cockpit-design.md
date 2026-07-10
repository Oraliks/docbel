# Spec — Dashboard admin « cockpit » (2026-07-10)

## Contexte

Le dashboard `/admin` actuel ([app/admin/page.tsx](../../../app/admin/page.tsx) +
[components/admin/admin-dashboard-overview.tsx](../../../components/admin/admin-dashboard-overview.tsx))
n'affiche que du contenu et des comptes : 4 compteurs (utilisateurs, actifs, pages
publiées, outils), un bar chart d'inscriptions, 7 tuiles de navigation, le feed
d'activité. Il calcule tout côté client en shippant 500 users + 200 pages en props,
et n'exploite aucune des données d'usage déjà instrumentées en base.

## Objectif

Transformer le dashboard en **cockpit à deux étages** :

1. **Opérationnel (« à traiter »)** — tout ce qui attend une action admin, compteurs
   cliquables vers les sections concernées. Le dashboard devient le point d'entrée
   quotidien.
2. **Produit (« comment c'est utilisé »)** — KPI avec tendance, séries journalières,
   funnel des dossiers, listes actionnables, stats par module.

Décisions actées avec Oraliks (2026-07-10) :
- Orientation : cockpit 2 étages (validé).
- Périmètre v1 : **tous les domaines** (socle citoyen + file opérationnelle complète
  + RDV/formations + IA/employeur).
- Design validé sur maquette (6 étages, voir Structure ci-dessous).

## Structure de la page (6 étages)

1. **Header** : titre + sélecteur de période `7 j / 30 j / 90 j` (searchParam
   `?period=`) + bandeau `ApiHealthCheck` existant conservé.
2. **À traiter** : 6 cartes compactes cliquables (compteur + libellé + lien section).
3. **KPI usage** : 6 tuiles avec valeur, delta vs période précédente, sparkline SVG.
4. **Trafic & dossiers par jour** (area chart 2 séries) + **funnel dossiers**.
5. **Listes actionnables** : top pages vues, top dossiers démarrés, recherches sans
   résultat (mise en avant accent : c'est la roadmap de contenu).
6. **Modules** (4 cartes compactes : RDV, Formations, IA, Employeur) + **activité
   admin** existante conservée en bas.

## Sources de données (champs vérifiés dans prisma/schema.prisma)

### Étage « À traiter » — `getOpsQueue()`

| Carte | Requête | Lien |
|---|---|---|
| Signalements | `Report.status = 'pending'` (count, + répartition par `type` en tooltip/sous-texte) | `/admin/signalements` |
| Gaps IA | `KnowledgeGap.status = 'open'` (count) | page gaps chômage-IA |
| Traductions | `TranslationJob.status = 'pending'` (count) ; pastille rouge si `failed > 0` | `/admin/i18n` |
| Inbox | `InboxEmail.folder = 'INBOX' AND isRead = false` (count) | `/admin/inbox` |
| RDV aujourd'hui | `Booking.date = <today 'YYYY-MM-DD'>` hors annulés (count) ; sous-texte « X à approuver » si `status = 'pending_approval'` | `/partenaire/booking` ou section admin RDV |
| Barèmes en attente | `BaremeFile.status IN ('draft','pending_approval')` (count) | `/admin/chomage/baremes` |

Les hrefs exacts seront vérifiés contre la sidebar admin au moment du lot
(ne pas inventer de routes).

### Étage KPI — `getUsageKpis(period)`

Chaque KPI = valeur sur la période + delta vs période précédente de même durée
(en % ; en points pour le taux) + mini-série pour la sparkline.

| KPI | Requête |
|---|---|
| Visiteurs | `PageView` count (`createdAt` dans période) |
| Dossiers démarrés | `BundleRun` count (`startedAt`) |
| Taux de complétion | runs démarrés dans la période dont `status = 'completed'` / runs démarrés dans la période |
| PDF générés | `PdfFormSubmissionLog` count (`success = true`) |
| RDV pris | `Booking` count (`createdAt`) |
| Nouveaux comptes | `User` count (`createdAt`) |

### Séries journalières — `getDailySeries(period)`

`$queryRaw` avec `date_trunc('day', "createdAt" AT TIME ZONE 'Europe/Brussels')`
sur `PageView` et `BundleRun` (`startedAt`). Zéro-fill des jours vides côté JS
(helper pur testé).

### Funnel dossiers — `getBundleFunnel(period)`

| Étape | Source |
|---|---|
| Recherches | `BundleAnalyticsEvent.eventType = 'search_performed'` |
| Dossiers ouverts | `eventType = 'bundle_opened'` |
| Runs créés | `eventType = 'run_created'` |
| Complétés | `BundleRun.completedAt` dans la période |

⚠️ Les événements sont best-effort et feature-flaggés `analytics` : si la table est
vide, afficher un état vide explicite (« activer le flag analytics ») — informatif,
jamais bloquant.

### Listes actionnables — `getTopLists(period)`

- Top pages : `PageView` groupBy `slug`, take 5 (index `[slug, createdAt]` existant).
- Top dossiers : `BundleRun` groupBy `bundleId`, take 5, jointure titres
  `DocumentBundle`.
- Recherches sans résultat : `BundleAnalyticsEvent.eventType = 'search_no_result'`,
  terme extrait de `metadataJson` (clé exacte à confirmer dans le code émetteur
  `lib/bundles/` au lot 4), agrégation côté JS, take 5.

### Modules — `getModuleStats()`

| Carte | Stats |
|---|---|
| RDV | bookings de la semaine courante + tenants actifs (`BookingTenant`) |
| Formations | `TrainingEnrollment` sur la période + sessions à venir (`TrainingSession.startsAt >= now`, `status IN ('scheduled','open')`) |
| IA | `ChatSession` créées sur la période + gaps ouverts |
| Employeur | `CostSimulation` sur la période + `DocumentDraft.status = 'draft'` |

## Architecture technique

- **`lib/admin/dashboard-stats.ts`** (nouveau) : une fonction exportée par étage
  (`getOpsQueue`, `getUsageKpis`, `getDailySeries`, `getBundleFunnel`,
  `getTopLists`, `getModuleStats`), types de retour exportés, période paramétrée
  `'7d' | '30d' | '90d'` (défaut `30d`). Tout en agrégats SQL
  (count/groupBy/`$queryRaw` `date_trunc`) — aucune liste massive.
- **`lib/admin/dashboard-stats-helpers.ts`** (nouveau) : helpers purs (calcul de
  delta, zéro-fill des séries, taux du funnel, bornes de période) — testés vitest.
- **`app/admin/page.tsx`** refondu : RSC async, garde admin inchangée, lit
  `searchParams.period`, rend les 6 étages chacun dans un `<Suspense>` avec les
  skeletons existants (`KpiCardsSkeleton`, `ChartSkeleton`) — streaming progressif.
- **`components/admin/dashboard/`** (nouveau dossier) : `period-selector.tsx`
  (client, `router.replace` du searchParam), `ops-queue.tsx`, `usage-kpis.tsx`
  (sparklines = SVG pur, pas recharts), `daily-chart.tsx` (client, recharts en
  dynamic import comme aujourd'hui), `bundle-funnel.tsx`, `top-lists.tsx`,
  `module-cards.tsx`.
- **`components/admin/admin-dashboard.tsx`** : conserve uniquement les vues
  alternatives `?view=filemanager|activity|changelog|users`. La vue par défaut est
  rendue directement par `page.tsx`. La vue `?view=users` bascule sur son propre
  fetch server (lot 5) — fin des props massives (500 users / 200 pages).
- Design : langage admin shadcn blanc + violet existant, dark mode fonctionnel,
  grilles responsives (2 colonnes mobile). Compteurs à zéro affichés en état
  neutre, jamais masqués.

## Hors périmètre (v2+)

- Étendre le tracking `PageView` aux routes codées (accueil, /mon-dossier…) —
  chantier séparé avec consentement RGPD. Le dashboard étiquette le trafic
  « pages éditoriales » pour rester honnête.
- Rollups matérialisés / cron de pré-agrégation (inutile au volume actuel).
- Export CSV des stats.
- Notifications / alertes sur seuils.

## Lots d'implémentation (3-5 fichiers max chacun)

1. **Lib stats socle** : `dashboard-stats.ts` (KPI + séries) + helpers + tests.
2. **Refonte page** : `app/admin/page.tsx` + `period-selector` + `usage-kpis` +
   `daily-chart`.
3. **File opérationnelle** : `getOpsQueue` + `ops-queue.tsx` (+ vérif des hrefs).
4. **Funnel + listes** : `getBundleFunnel` + `getTopLists` + `bundle-funnel.tsx` +
   `top-lists.tsx` (+ confirmation clé `metadataJson`).
5. **Modules + nettoyage** : `getModuleStats` + `module-cards.tsx` + bascule
   `?view=users` sur fetch server + suppression des props massives.

Validation par lot : `pnpm test`, `pnpm build`, écran `/admin` (clair + sombre).

## Risques

- Événements `BundleAnalyticsEvent` vides si flag `analytics` off → états vides
  explicites prévus.
- `date_trunc` et fuseaux : bucketer en `Europe/Brussels` sinon les jours glissent.
- Neon cold start (P1001) : le streaming Suspense tolère la latence ; réessayer
  en cas d'échec ponctuel, pas de retry custom en v1.
- ESLint : ~74 erreurs pré-existantes, ne pas en ajouter.
