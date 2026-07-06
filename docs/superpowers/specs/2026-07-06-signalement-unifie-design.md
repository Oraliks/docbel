# Spec — Système de signalement unifié

- **Date :** 2026-07-06
- **Statut :** design validé par Oraliks — à relire avant plan
- **Sujet :** remplacer les 5 mécanismes de signalement épars (bureaux,
  validation formulaire, formations, traductions, RioLex) par un seul modèle
  de données, une seule API, un seul composant public réutilisable et une
  seule page admin — conçu pour qu'un futur signalement (nouvelle
  fonctionnalité) ne demande plus de reconstruire toute la chaîne.
- **Origine :** demande directe d'Oraliks, affinée par échange (cf. §2).

---

## 1. Contexte & problème

Le projet a aujourd'hui **5 mécanismes de signalement indépendants**,
construits un par un au fil des fonctionnalités :

| # | Signalement | Table Prisma | Route publique | Route admin | Page admin | Statuts |
|---|---|---|---|---|---|---|
| 1 | Bureaux (horaires/adresse/tél/fermé) | `BureauReport` | `POST /api/bureaux/[id]/report` | `GET/PATCH /api/admin/bureaux/reports` | `/admin/bureaux` (section reports) | pending/resolved/dismissed |
| 2 | Faux positif validation formulaire | `FormValidationReport` | `POST /api/form-validation/report` | — (compteur seulement) | `/admin/pdf/analytics` (compteur `pendingReports`) | pending/resolved/dismissed |
| 3 | Formations (prix trompeur, lien cassé…) | `TrainingReport` | `POST /api/formations/report` | `PATCH /api/admin/formations/reports/[id]` | `/admin/formations/signalements` | new/in_progress/resolved/rejected |
| 4 | Suggestions de traduction | `TranslationSuggestion` | `POST /api/translation-suggestions` | `GET/PATCH /api/admin/translation-suggestions` | `/admin/i18n/suggestions` | pending/accepted/rejected |
| 5 | RioLex (erreur sur un article de loi) | **aucune** | `mailto:` pur (zéro persistance) | — | — | — |

Conséquences concrètes de cet éparpillement :
- **3 vocabulaires de statut différents** pour le même concept (triage
  pending → traité/rejeté).
- **Rate-limit par IP réimplémenté 4 fois** (mêmes règles, code dupliqué).
- **3 pages admin distinctes + 1 compteur isolé + 1 signalement qui n'est
  même pas persisté** (RioLex, `mailto:` — cf. `REGLEMENTATION_V4_PLAN.md`
  item #17, qui prévoyait déjà cette dette).
- Ajouter un signalement à une nouvelle fonctionnalité aujourd'hui = créer
  une table Prisma + une route publique + une route admin + une page admin
  from scratch. C'est exactement le pattern qu'Oraliks veut casser.

## 2. Décisions validées (issues des échanges avec Oraliks)

- **Fusion complète avec migration des données**, pas une simple agrégation
  en lecture : nouvelle table unique, historique copié dedans, les 5 sources
  écrivent désormais dans cette table. Rejeté : l'option "agrégation en
  lecture seule sans toucher aux 4 tables" (moins de travail, mais perpétue
  la duplication du code d'écriture/rate-limit/enums).
- **Pensé pour l'extensibilité future** : ajouter un signalement à une
  fonctionnalité qui n'existe pas encore doit être une config (quelques
  lignes dans un registre), jamais une nouvelle table/route/page.
- **Soumission** : reste **anonyme** sur l'espace public (citoyen), comme
  aujourd'hui — zéro régression. Devient **auto-identifiée** (reporterId +
  organisation captés depuis la session, aucun champ à remplir) dès que le
  composant est utilisé dans un espace connecté (`/partenaire`, `/employeur`).
  Pas de mode intermédiaire.
- **Accès modérateur : superadmin uniquement**, comme les 4 systèmes
  actuels (`requireAdminAuth`). Pas d'accès délégué par organisation —
  aucun des 5 cas d'usage actuels n'en a besoin (ce sont tous des
  corrections que seule l'équipe DocBel peut apporter au contenu/aux
  données du site).
- **Notifications : pas d'email.** Un badge compteur (`pending`) dans la
  sidebar admin suffit — comportement actuel légèrement amélioré, pas de
  nouvelle infra de notification.
- **Pas de suppression des 4 anciennes tables dans ce projet** : migration
  additive uniquement (règle absolue du projet sur la Neon partagée). La
  suppression est un suivi volontairement séparé, sous supervision, une
  fois le nouveau système validé en prod.

## 3. Modèle de données

Nouvelle table, migration additive (SQL via `db execute`, jamais `db push`
sur Neon partagée) :

```prisma
model Report {
  id            String       @id @default(cuid())
  type          String       // "bureau" | "form_validation" | "training" | "translation" | "riolex_article" | futurs types
  status        ReportStatus @default(pending)

  message       String?      // texte libre du signalant
  targetId      String?      // id brut de l'entité visée (bureauId, trainingId, riolexId...)
  targetLabel   String?      // libellé lisible, résolu serveur (ex: "Bureau FGTB Charleroi")
  targetUrl     String?      // lien vers la page concernée, résolu serveur

  payload       Json         // champs spécifiques au type (category, fieldId, rejectedValue,
                              // sourceText/suggestedText, reason...), validés par le registre

  reporterEmail String?      // renseigné si soumission anonyme (espace public)
  reporterId    String?      // FK logique vers User, auto-rempli si connecté
  reporterOrg   String?      // snapshot du nom d'organisation au moment du signalement
  ipHash        String?
  userAgent     String?

  adminNote     String?
  actionTaken   String?
  resolvedById  String?
  resolvedAt    DateTime?

  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  @@index([type, status])
  @@index([targetId])
}

enum ReportStatus {
  pending
  in_progress
  resolved
  dismissed
}
```

**Pourquoi `type` est un `String` et pas un enum Prisma :** un enum
Postgres/Prisma demande une migration à chaque nouvelle valeur, ce qui
contredirait l'objectif d'extensibilité (§2). Les types valides et leur
schéma de `payload` vivent dans un registre applicatif (§4), sur le
principe déjà utilisé par le page-builder du projet (`registry.ts` = seule
source de vérité). `status` reste un enum Prisma car fermé et stable (4
valeurs, branché partout dans la logique).

**Mapping de statuts** (utilisé par le backfill, §8) :

| Ancien statut (table d'origine) | → `ReportStatus` |
|---|---|
| `pending` (Bureau, FormValidation, Translation) | `pending` |
| `new` (Training) | `pending` |
| `in_progress` (Training) | `in_progress` |
| `resolved` (Bureau, FormValidation) / `accepted` (Translation) | `resolved` |
| `dismissed` (Bureau, FormValidation) / `rejected` (Training, Translation) | `dismissed` |

## 4. Registre des types (`lib/reports/registry.ts`)

Source de vérité unique par type de signalement. Pour chacun des 5 types
initiaux (`bureau`, `form_validation`, `training`, `translation`,
`riolex_article`) :
- **Schéma Zod** du `payload` attendu (validation à l'écriture).
- **Résolveur de cible** : fonction `(targetId) => Promise<{ targetLabel,
  targetUrl }>` — best-effort par type. Pour RioLex, réutilise le mécanisme
  déjà présent dans `components/reglementation/report-button.tsx` (qui
  connaît déjà l'URL de la page pour construire le `mailto:` actuel). Pour
  `form_validation`, cible `app/d/[slug]/page.tsx` via le `formSlug`. Pour
  `bureau`/`training`, cible `/outils/bureaux` / `/formations/[slug]` —
  résolution exacte (deep-link ou non) confirmée lors du plan.
- **Catégories/raisons** si le type en a (ex. bureau : hours/address/phone/
  closed/other ; training : prix_trompeur/info_fausse/non_serieuse/…).
- **Config d'affichage admin** : quels champs du `payload` montrer, dans
  quel ordre, et lequel déclenche un rendu spécial (ex. traduction →
  affichage "avant/après" `currentText` → `suggestedText` plutôt qu'un
  clé/valeur brut).

Ajouter un 6ᵉ type (future fonctionnalité) = une entrée dans ce fichier.
Zéro migration, zéro nouvelle route, zéro nouvelle page.

## 5. API

**Publique :**
- `POST /api/reports` — point d'entrée unique. Body :
  `{ type, targetId?, message?, payload }`, `payload` validé par le schéma
  Zod du type (§4).
  - `targetLabel`/`targetUrl` résolus **serveur**, jamais fournis par le
    client (évite un affichage admin trafiqué par le client).
  - Session présente (partenaire/employeur) → `reporterId` + `reporterOrg`
    auto-remplis serveur, pas de champ email demandé.
  - Pas de session (public) → email optionnel dans `payload`, `ipHash`
    calculé serveur, rate-limit partagé (`lib/reports/rate-limit.ts` —
    même règle 5/h/IP que l'existant, mais écrite une seule fois).
- Les anciennes routes (`/api/bureaux/[id]/report`,
  `/api/form-validation/report`, `/api/formations/report`,
  `/api/translation-suggestions`) sont **supprimées**, pas gardées en
  façade : les composants front existants sont rebranchés sur
  `POST /api/reports` (changement mécanique par composant : URL + forme du
  body — cf. lots §9).

**Admin :**
- `GET /api/admin/reports?type=&status=&page=` — liste filtrée, remplace
  les 3 GET existants.
- `PATCH /api/admin/reports/[id]` — statut/note/action, remplace les 3
  PATCH existants (logique identique dans les 3 : update status + note +
  `resolvedById`/`resolvedAt`).
- `GET /api/admin/reports/count?status=pending` — alimente le badge
  sidebar (§7).

## 6. Composant public réutilisable

`components/reports/report-button.tsx` (+ hook `useReportSubmit`) :

```tsx
<ReportButton type="riolex_article" targetId={article.riolexId} />
```

- Lit le registre (§4) pour savoir quoi afficher (catégories, libellés,
  i18n).
- Détecte automatiquement session vs anonyme : montre un champ email
  optionnel si anonyme, rien si connecté (identité auto-remplie serveur).
  Généralise ce que `TrainingReport` fait déjà partiellement (`reporterId`
  optionnel si connecté) à tout le système au lieu de le refaire par type.
  Utilisable indifféremment sur le site public, `/partenaire` ou
  `/employeur`.
- Gère l'état de soumission (désactivation après envoi, confirmation).

## 7. Page admin unifiée

**Route** `/admin/signalements`, remplace à terme `/admin/formations/signalements`,
`/admin/i18n/suggestions`, la section reports de `/admin/bureaux`, et le
compteur de `/admin/pdf/analytics`. Nouvelle entrée dans `AppSidebar` avec
badge `pending` (§2). Les anciennes pages restent fonctionnelles en
parallèle jusqu'à ce que le backfill (§8) ait migré l'historique — pas de
trou de visibilité pendant la transition.

Layout repris du pattern déjà utilisé 3 fois dans le projet (table shadcn +
filtres + badges de statut) — consolidé, pas réinventé :
- **Filtres** : par type (liste dérivée du registre — un futur type y
  apparaît automatiquement) et par statut.
- **Liste** : type (icône + libellé), `targetLabel` (cliquable →
  `targetUrl`), extrait du message, émetteur (email / "Organisation X" /
  "Anonyme"), date, badge de statut.
- **Détail** : panneau latéral (`Sheet`) au clic sur une ligne — garde les
  filtres/scroll de la liste intacts. Rendu du `payload` selon la config du
  registre : clé/valeur générique par défaut, rendu "avant/après" pour les
  traductions. Lien vers la page concernée, note admin, action prise,
  boutons de changement de statut (auto-timestampés).

## 8. Migration des données existantes

Additive, non destructive, séquencée pour qu'aucune ligne ne soit perdue
entre la copie et la bascule :

1. Migration Prisma : nouvelle table `Report` + enum `ReportStatus`.
2. Rebranchement des 4 sources existantes (lots 6-8, §9) : chaque source
   écrit désormais dans `Report` et plus dans son ancienne table — à partir
   de ce moment, plus aucune nouvelle ligne n'atterrit dans les 4 anciennes
   tables.
3. Une fois les 4 sources rebranchées : script one-off
   `scripts/backfill-reports.ts` (exécuté via `tsx`, comme les autres
   scripts ponctuels du projet) — lit les 4 anciennes tables (désormais
   figées, plus d'écriture concurrente possible), applique le mapping de
   statuts (§3), reconstruit `payload` par type, `INSERT` dans `Report`.
   **Les 4 anciennes tables ne sont ni vidées ni supprimées** à cette étape.
4. Vérification manuelle : la page admin unifiée affiche l'historique migré
   avec les bons statuts, en plus des signalements déjà arrivés depuis
   l'étape 2.
5. Une fois vérifié : suppression des 3 anciennes pages admin
   (`/admin/formations/signalements`, `/admin/i18n/suggestions`, section
   reports de `/admin/bureaux`), du compteur `/admin/pdf/analytics`, et des
   routes admin GET/PATCH devenues mortes. Ce sont des suppressions de
   fichiers Next.js, réversibles par git, sans risque DB.

La suppression des 4 anciennes **tables** Prisma (contrairement aux pages,
étape 5) n'est **pas dans ce projet** : c'est la seule étape réellement
irréversible. Suivi séparé, ajouté à `CLEANUP_QUEUE.md`, à faire sous
supervision explicite une fois le nouveau système éprouvé en prod (lot 10,
§9).

## 9. Plan de phasage (lots de 3-5 fichiers)

1. Schema : migration `Report` + `ReportStatus`.
2. `lib/reports/` : registre (types, Zod, résolveurs de cible), moteur
   `createReport()`, rate-limit partagé.
3. API : `POST /api/reports`, `GET`/`PATCH /api/admin/reports`,
   `GET /api/admin/reports/count`.
4. `<ReportButton>` réutilisable + i18n des labels.
5. Page admin `/admin/signalements` (liste, détail, entrée sidebar, badge)
   — tourne en parallèle des anciennes pages, se peuple au fur et à mesure
   des rebranchements (lots 6-8), vide au départ.
6. Rebranchement bureaux + validation formulaire : les 2 routes publiques
   d'ingestion basculent vers `POST /api/reports` et sont supprimées ; leurs
   anciennes tables arrêtent de recevoir de nouvelles lignes.
7. Rebranchement formations + traductions : idem (2 routes publiques
   supprimées).
8. RioLex : `mailto:` → vrai `<ReportButton type="riolex_article">`.
9. Backfill de l'historique des 4 anciennes tables (script one-off) +
   vérification manuelle + suppression des 3 anciennes pages admin, du
   compteur `/admin/pdf/analytics`, et des routes admin devenues mortes.
10. *(Plus tard, séparément, sur feu vert d'Oraliks)* : suppression des 4
    anciennes **tables** Prisma — seule étape réellement irréversible.

Projet multi-sessions réaliste vu le périmètre (5 sources consolidées +
composant réutilisable + page admin). Le détail précis (fichiers exacts,
ordre interne, tests par lot) est produit par le plan d'implémentation qui
suit cette spec — l'exécution des lots indépendants (ex. lots 6/7/8 une
fois 1-5 posés) sera parallélisée sur plusieurs agents, Oraliks assurant le
test final manuel.

## 10. Tests / validation

- `pnpm test` : validation des schémas Zod du registre par type, mapping
  de statuts (fonction pure testable isolément), moteur `createReport()`
  (résolution cible, identité session vs anonyme, rate-limit).
- `pnpm build` après chaque lot.
- `pnpm i18n:check` (labels du composant `<ReportButton>` et de la page
  admin).
- Vérification manuelle par lot (preview), notamment :
  - un signalement anonyme (public) arrive bien sans `reporterId`, avec
    `ipHash` et rate-limit actif après 5 essais.
  - un signalement depuis `/partenaire` ou `/employeur` arrive avec
    `reporterId`/`reporterOrg` remplis, sans champ email affiché.
  - le badge sidebar reflète le nombre réel de `pending`.
  - après backfill : les anciens signalements (4 tables) apparaissent dans
    `/admin/signalements` avec le bon statut mappé.
- Test final de bout en bout (tous les points d'entrée réels, RioLex
  inclus) : fait manuellement par Oraliks, pas par Claude.

## Hors périmètre (explicitement)

- Pas de notification email (badge compteur uniquement).
- Pas d'accès délégué par organisation (superadmin uniquement).
- Pas de vue "mes signalements" côté citoyen/partenaire/employeur.
- Pas d'actions groupées (bulk) dans l'admin.
- Pas de suppression des 4 anciennes **tables** Prisma dans cette passe
  (suivi séparé, §8) — les anciennes pages/routes admin, elles, sont
  supprimées dans ce projet (lot 9) une fois le backfill vérifié.
- Pas de nouvelle dépendance.
