# Docbel Formations — Journal des décisions d'architecture

> Log concis des décisions et hypothèses prises pendant la construction du module
> Formations. Conformément à la **Règle d'autonomie** de la spec, ce fichier
> documente les choix « sûrs » faits sans bloquer sur des questions ouvertes.

## Contexte

Le module Formations a été construit progressivement, de la V1 à la V4 (roadmap).
Plutôt que d'attendre des arbitrages sur chaque point ouvert, chaque vague a pris
les hypothèses les plus sûres et les plus réversibles possibles, en réutilisant au
maximum l'existant. Ce document sert de mémoire de ces choix : ce qui a été décidé,
pourquoi, et ce qui reste à trancher.

Repères :

- **V1** — catalogue public, Boussole (orientation), assistant de création
  d'organisation, validation admin, sessions, inscriptions.
- **V2** — fondations : activation du module + feature flags, abstractions de
  providers, attestations, notifications, analytics.
- **V3 / V4** — roadmap (mini-LMS, quiz, QR, parcours, paiement réel, marketplace,
  avis vérifiés, IA réelle, API partenaires, etc.).

## Décisions clés

- **Settings + feature flags = 2 clés JSON dans la table `AppSetting`**
  (`formations_module` et `formations_flags`), plutôt qu'une nouvelle table
  `PlatformModuleSetting`. On réutilise le système de settings déjà éprouvé
  (`lib/app-settings.ts` : `getSetting` / `setSetting` / défauts versionnés). La
  spec autorise explicitement la réutilisation d'un système de settings existant.
  Les helpers d'accès et de mutation vivent dans `lib/formations/module.ts`
  (`getFormationsModule`, `getFormationsFlags`, `setFormationsModule`,
  `setFormationsFlags`, `getTrainingAccess`, `isFlagEnabled`, …). _Rationale :_
  zéro migration pour piloter le module, parsing tolérant (merge sur défauts), et
  l'écriture passe déjà par `logActivity` pour l'audit.

- **Conteneur d'organisation = table dédiée `FormationOrganization`** (décidée en
  V1). Un organisme de formation est une entité distincte d'un employeur/partenaire
  « métier » : il a son propre cycle de vie de validation, ses formations, ses
  sessions. Les routes sont scindées par espace : `/employeur/formations` et
  `/partenaire/formations` (chrome rendu par le ProShell selon le rôle).
  _Rationale :_ un organisme n'est pas un sous-objet d'un dossier ; il lui faut son
  propre conteneur, sa modération et ses membres.

- **Champs de cycle de vie / visibilité = `String` + unions Zod, pas d'enums PG.**
  Statuts (`status`, `visibility`, `certificateType`, `channel`, `eventType`, …)
  sont des `String` validées par des unions Zod côté application — même convention
  que le module employeur. Les références vers `User` / `Organisme` sont des
  références « lâches » (String, **sans FK**). _Rationale :_ ajouter une valeur de
  statut ne nécessite aucune migration destructive sur une base partagée ; l'absence
  de FK évite les contraintes croisées fragiles entre modules.

- **Migrations additives uniquement, appliquées via `prisma db execute`.**
  - **48** — cœur V1 (FormationOrganization, Training, TrainingSession,
    TrainingEnrollment, catégories, tags, badges, règles d'accès, signalements,
    saved…).
  - **49** — fondations V2 : colonnes de permissions sur l'organisation +
    `TrainingCertificate`, `TrainingNotificationLog`, `TrainingAnalyticsEvent`,
    `TrainingReview`, `TrainingContextRecommendation`.

  _Rationale :_ la base Neon est **partagée** ; `prisma db push` est proscrit
  (drift destructif qui détruirait pgvector et les tables PDF). On n'écrit que du
  SQL **additif**, appliqué à la main via `db execute`.

- **Les providers sont des abstractions avec des défauts mock / manuel / local**,
  pour qu'**aucune API externe ne bloque** le module. Tout fonctionne « out of the
  box » sans la moindre clé :
  - **Notifications** — journal in-app en base (`TrainingNotificationLog`,
    `channel: inapp`) **toujours** écrit, + email Resend **best-effort** ; sans
    `RESEND_API_KEY`, on logge seulement (provider `database`), sans casser le flux.
    `lib/formations/providers/notifications.ts`.
  - **PDF** — `jsPDF` (import dynamique), **aucune dépendance externe** ni service.
    `lib/formations/certificates/pdf.ts`.
  - **Stockage** — Vercel Blob si `BLOB_READ_WRITE_TOKEN` est présent ; sinon, le
    PDF du certificat est **généré à la demande** (`buildPdfForCertificate`), pas
    stocké. `lib/storage/blob-storage.ts` + `lib/formations/certificates/service.ts`.
  - **Paiement** — défaut `manual` (suivi côté organisme) ou `disabled` ; `mock`
    simule en dev ; `stripe` / `paypal` sont des **placeholders** non câblés qui
    retombent sur le suivi manuel. `lib/formations/providers/payment.ts`.
  - **IA d'orientation** — défaut `local-rules` : explication **déterministe** du
    résultat Boussole, sans appel externe ; `openai` / `anthropic` sont des
    placeholders qui retombent sur `local-rules`. L'IA ne dit **jamais** quel métier
    choisir (disclaimer systématique). `lib/formations/providers/ai.ts`.
  - **QR code** — **différé** : aucune lib QR n'est encore embarquée. Le PDF affiche
    le code de vérification et l'URL en clair, pas (encore) de QR.

- **Feature flags par défaut** (cf. `DEFAULT_FLAGS` dans `lib/formations/module.ts`
  et les défauts de `lib/app-settings.ts`) :

  | État    | Flags |
  | ------- | ----- |
  | **ON**  | `catalog`, `orientation`, `organizationCreation`, `privateTrainings`, `internalTrainings`, `enrollments`, `certificates`, `notifications`, `analytics` |
  | **OFF** | `lms`, `quizzes`, `paths`, `payments`, `marketplace`, `ai`, `partnerApi`, `qualityScore`, `docbelCertified`, `sponsored` |

  _Rationale :_ on n'active par défaut que ce qui est construit et utilisable sans
  configuration. Tout ce qui dépend d'une intégration externe non câblée (paiement,
  IA, marketplace, API partenaires…) reste **OFF** jusqu'à implémentation/config.
  Un flag n'est jamais actif si le module global est désactivé (`isFlagEnabled`
  contrôle `config.enabled` en premier).

- **Sécurité : visibilité `private` / `internal` appliquée côté serveur** via
  `canViewTraining` (`lib/formations/access.ts`) — une formation non publiée n'est
  visible que des membres de l'organisation et de son créateur ; l'admin voit tout.
  L'accès au module est résolu serveur par `getTrainingAccess` (états
  `ok | hidden | maintenance | coming_soon | forbidden`), et **l'admin conserve
  toujours l'accès** à l'espace admin, même module désactivé ou en maintenance, afin
  de pouvoir le réactiver. La nav client lit un état public sanitisé
  (`getPublicModuleState`) sans information sensible.

## État d'avancement

| Vague  | État          | Détail |
| ------ | ------------- | ------ |
| **V1** | **Done**      | Catalogue public + détail, Boussole (orientation), assistant de création d'organisation, validation/modération admin, permissions, catégories, signalements, sessions, inscriptions, « Mes formations », formations sauvegardées, emails transactionnels, rapports. |
| **V2** | **Done / Partiel** | **Done :** activation du module + feature flags (`module.ts`), gating d'accès par espace, providers (notifications, PDF, storage, paiement, IA), attestations/certificats (émission idempotente + vérification par code + PDF à la demande), notifications (log in-app + email best-effort), analytics (`TrainingAnalyticsEvent`), paiement **manuel**, recommandations contextuelles (`TrainingContextRecommendation`). **Partiel / best-effort :** email réel (uniquement si Resend configuré), stockage Blob (sinon génération à la demande), export CSV (analytics/inscriptions). |
| **V3** | **Roadmap**   | Mini-LMS (flag `lms`), quiz (`quizzes`), **certificats avec QR** (lib QR + rendu dans le PDF), parcours (`paths`), accompagnement / coaching, messagerie. Modèles à ajouter (ex. `TrainingModule`, `TrainingLesson`, `TrainingQuiz`, `TrainingPath`, `TrainingMessage`) via une nouvelle migration additive (**50**). |
| **V4** | **Roadmap**   | Paiement réel Stripe/PayPal (`payments` + webhook), marketplace (`marketplace`), avis vérifiés publics (`TrainingReview.isPublic` / `isVerified` activés, modération), IA d'orientation réelle (`ai` — branche openai/anthropic), assistant carrière, API partenaires (`partnerApi`), score qualité (`qualityScore`), label « Docbel Certified » (`docbelCertified`), formations sponsorisées (`sponsored`), commission Docbel (`DOCBEL_COMMISSION_RATE`). |

## Hypothèses faites

- **Nav admin NL non traduite** : comme le reste de l'admin, la navigation et les
  libellés admin du module restent en FR (l'i18n public est un chantier séparé).
- **Certificats générés à la demande sans Blob** : tant que `BLOB_READ_WRITE_TOKEN`
  n'est pas défini, le PDF est régénéré à chaque téléchargement (déterministe, pas
  de stockage). `pdfUrl` reste nul. C'est acceptable au volume actuel.
- **Pas d'envoi d'email sans Resend** : sans `RESEND_API_KEY`, les notifications
  sont uniquement journalisées en base (historique « in-app »). Le flux d'inscription
  n'échoue jamais à cause de l'email (best-effort, erreurs loggées).
- **Pas de paiement réel par défaut** : provider `manual` — le paiement est géré par
  l'organisme ; Docbel ne traite pas l'argent en V2. Aucun risque de débit
  accidentel.
- **IA déterministe par défaut** : l'explication d'orientation est locale et
  reproductible ; aucune clé requise, aucun coût, aucun appel réseau, et l'IA ne
  prescrit jamais de métier (disclaimer systématique).
- **Références lâches sans FK** : on suppose qu'une intégrité applicative (au niveau
  des requêtes) suffit, plutôt que des contraintes FK croisées entre modules sur la
  base partagée.
- **QR différé** : on assume qu'afficher le code de vérification + l'URL de
  vérification en clair suffit en V2 ; le QR est un ajout cosmétique de V3.
- **Statuts en `String` extensibles** : on suppose qu'ajouter une valeur de statut
  ne doit jamais nécessiter de migration destructive (d'où l'absence d'enums PG).
- **Module activé par défaut en `PUBLIC`** : on suppose que l'état initial souhaité
  est « visible et utilisable » ; l'admin peut basculer en `HIDDEN`, `COMING_SOON`,
  `PRIVATE_BETA` ou activer la maintenance à tout moment.

## Fichiers de référence

- `lib/formations/module.ts` — activation, flags, résolution d'accès.
- `lib/app-settings.ts` — clés `FORMATIONS_MODULE` / `FORMATIONS_FLAGS` + défauts.
- `lib/formations/providers/{notifications,payment,ai}.ts` — abstractions providers.
- `lib/formations/emails.ts` — emails transactionnels (Resend, best-effort).
- `lib/formations/certificates/{service,pdf}.ts` — attestations + PDF.
- `lib/formations/access.ts` — `canViewTraining` (visibilité serveur).
- `lib/storage/blob-storage.ts` — stockage Vercel Blob (fallback à la demande).
- `prisma/schema.prisma` — modèles `Training*` / `FormationOrganization` (mig. 48/49).
- `docs/formations-api-setup.md` — guide de configuration humaine (env, providers).
