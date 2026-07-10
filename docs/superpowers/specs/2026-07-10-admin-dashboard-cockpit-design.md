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
- Style : grammaire compacte « ops » inspirée de la référence Nerqis fournie par
  Oraliks (maquette v2 sombre validée), **déclinée en clair** — l'admin reste
  blanc + violet (maquette v3 = cible). Peu de texte, dense mais lisible.

## Structure de la page (6 étages, maquette v3)

1. **Header** : titre + pastille santé inline (`● API 88 ms`) + sélecteur de
   période segmenté `7 j / 30 j / 90 j` (searchParam `?period=`).
2. **Rangée statut** (4 cartes façon « ops ») : Santé API (réutilise la logique de
   `ApiHealthCheck`, le gros bandeau disparaît), Base de données (ping chronométré),
   À traiter (total + « n files actives »), Trafic aujourd'hui (vs hier).
3. **File de travail** : UNE carte contenant 6 items compacts (icône ambre +
   compteur + libellé, chacun cliquable) + lien « Tout voir ».
4. **KPI usage** : UNE carte, grille 3×2 à séparateurs hairline — valeur, badge
   delta, sparkline SVG pur.
5. **Trafic & dossiers par jour** (area chart 2 séries, gridlines) + **funnel
   dossiers** (barres horizontales + conversions inter-étapes « ↓ x % »).
6. **Listes actionnables** (top pages, top dossiers, recherches sans résultat avec
   bordure accent + badge « à créer ») puis **modules** (4 cartes paires de
   chiffres) puis **activité admin** ultra-compacte.

## Langage visuel (validé sur maquettes v2/v3)

- Thème : **clair**, blanc + violet existant de l'admin. Cartes blanches, bordures
  hairline, radius ~10 px, paddings réduits (11-14 px).
- Carte statut : libellé 11 px + icône teintée en coin (carré arrondi 26 px) +
  valeur 20 px + sous-info technique en monospace muted.
- Zéro phrase explicative : libellés seuls, `tabular-nums` partout, valeurs
  techniques (routes, latences) en monospace.
- Barres de volume fines (3 px) intégrées sous chaque ligne des tops — le visuel
  remplace le texte.
- Sémantique couleur stricte : violet = accent/data, ambre = pending (file de
  travail), vert/rouge = deltas et santé, teal = 2ᵉ série du chart. Pas d'autres
  couleurs.
- Compteurs à zéro affichés en état neutre, jamais masqués.
- Les composants `MetricTile`/`ActionTile` de l'ancien overview ne sont **pas**
  réutilisés (grammaire différente).

## Sources de données (champs vérifiés dans prisma/schema.prisma)

### Rangée statut — `getStatusStrip()`

- Santé API : réutiliser la source de `ApiHealthCheck` (état overall + latence) —
  côté serveur, sans le bandeau client actuel.
- Base de données : `SELECT 1` chronométré (latence ms) — best-effort, état
  « indisponible » propre si échec (Neon cold start).
- À traiter : somme des compteurs de `getOpsQueue()` + nombre de files > 0.
- Trafic 24 h : `PageView` count sur 24 h glissantes vs les 24 h précédentes
  (évite les maths de bord de journée côté serveur).

### Étage « File de travail » — `getOpsQueue()`

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
  (`getStatusStrip`, `getOpsQueue`, `getUsageKpis`, `getDailySeries`,
  `getBundleFunnel`, `getTopLists`, `getModuleStats`), types de retour exportés, période paramétrée
  `'7d' | '30d' | '90d'` (défaut `30d`). Tout en agrégats SQL
  (count/groupBy/`$queryRaw` `date_trunc`) — aucune liste massive.
- **`lib/admin/dashboard-stats-helpers.ts`** (nouveau) : helpers purs (calcul de
  delta, zéro-fill des séries, taux du funnel, bornes de période) — testés vitest.
- **`app/admin/page.tsx`** refondu : RSC async, garde admin inchangée, lit
  `searchParams.period`, rend les 6 étages chacun dans un `<Suspense>` avec les
  skeletons existants (`KpiCardsSkeleton`, `ChartSkeleton`) — streaming progressif.
- **`components/admin/dashboard/`** (nouveau dossier) : `period-selector.tsx`
  (client, `router.replace` du searchParam), `status-strip.tsx`, `ops-queue.tsx`
  (une carte, 6 items), `usage-kpis.tsx` (une carte, grille hairline, sparklines =
  SVG pur, pas recharts), `daily-chart.tsx` (client, recharts en dynamic import
  comme aujourd'hui), `bundle-funnel.tsx`, `top-lists.tsx` (barres de volume
  intégrées), `module-cards.tsx`.
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
3. **Statut + file opérationnelle** : `getStatusStrip` + `getOpsQueue` +
   `status-strip.tsx` + `ops-queue.tsx` (+ vérif des hrefs).
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
