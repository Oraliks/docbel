# Spec — Refonte admin « partie users » (liste serveur + fiche 360° + hub Comptes)

> **Statut : validé par Oraliks le 2026-07-10 (périmètre + dominantes), implémentation NON démarrée.**
> Approche retenue : Option A « hub léger + fiche 360° » (voir Alternatives rejetées).
> Exécution prévue en 7 lots indépendants de 3-5 fichiers, ordre 1→7, chaque lot shippable seul.

## 1. Contexte et état existant

La section `/admin/users` est fonctionnelle mais très en retard sur le modèle de données :

| Zone | Existant | Limites constatées |
|------|----------|--------------------|
| Liste `/admin/users` | Server component (`take: 1000`, `SAFE_USER_SELECT`) + `UsersListClient` : 7 stat-cards, recherche, 3 filtres, pagination — **tout côté client** | Ne scale pas au-delà de 1000 ; filtres non partageables par URL ; pas de tri ; pas d'export ; stat-cards au style pré-cockpit |
| Fiche `/admin/users/[id]` | Un simple formulaire d'édition (nom/email/mdp/rôle/statut) + zone de danger (type-to-confirm) | Pas de vue 360° ; **texte FR codé en dur** (pas next-intl, contrairement à la liste) |
| Création `/admin/users/new` | Formulaire complet i18n | **Rôle `partner` absent du select** ; impossible de définir `segment`, `partnerType`, `vatNumber`, `partnerOrganization` |
| API `/api/users`, `/api/users/[id]` | CRUD admin-gated (`requireAdminAuth`), transactions user+account better-auth | Validation manuelle (pas Zod) ; PUT/POST ignorent segment/partnerType/vatNumber/flags ; GET sans query params |
| Modèle `User` (schema.prisma:54) | Riche : `segment`, `partnerType`, `vatNumber`, `partnerOrganization`, `isOrgManager`, `canViewRdvHistory`, `banned/banReason/banExpires` (better-auth, en DB), `failedLoginAttempts`, `lockedUntil`, `emailVerifiedAt`, `image` | **L'UI n'expose presque rien de tout ça** |
| Données liées | `Session` (IP, userAgent, impersonatedBy), `UserProfile` (citoyen), `EmployerProfile`, `AdminImpersonationLog`, `BundleRun`, `PdfFormDraft`, bookings (`userId` sans FK), `CostSimulation`, `DocumentDraft` | Invisibles depuis l'admin users |
| Pages sœurs | `/admin/partenaires`, `/admin/employeurs` (partagent `PartnerOverviewShell`, centrées organisations/allowlist), `/admin/impersonation` | Aucun lien croisé avec les fiches users ; le sidebar a déjà le groupe « Comptes & accès » (app-sidebar.tsx:128) |

**Constat clé : aucune migration DB n'est nécessaire.** Tous les champs existent déjà ;
le chantier est purement UI + API + agrégation.

## 2. Objectifs

1. **Liste robuste** : recherche/filtres/tri/pagination côté serveur, URL partageable, export CSV.
2. **Fiche user 360°** : identité, sécurité (sessions, verrouillage), profil, activité, édition — en onglets.
3. **Actions admin manquantes** : révoquer sessions, déverrouiller, vérifier email, bannir/débannir.
4. **Édition complète** : exposer segment/partnerType/vatNumber/organisation/flags ; corriger le rôle `partner` manquant.
5. **Cohérence visuelle** : grammaire compacte du cockpit (cartes carrées, valeurs monospace, badges) + i18n du formulaire d'édition.
6. **Hub « Comptes & accès »** : bandeau d'onglets + liens croisés entre users / partenaires / employeurs / impersonation, **sans déplacer les routes**.

## 3. Alternatives rejetées

- **B — Vrai module `/admin/comptes`** (fusion des 4 sections sous de nouvelles routes) :
  refonte globale interdite par CLAUDE.md, casse les URLs, et `PartnerOverviewShell` est
  centré organisations/allowlist — la fusion serait artificielle.
- **C — Cosmétique seule** : ne couvre ni la fiche 360° ni la liste serveur (dominantes retenues).

## 4. Design par lot

### Lot 1 — Liste côté serveur (fondation)

**Contrat API `GET /api/users`** (query params, tous optionnels) :

```
q         recherche insensible à la casse sur name + email (contains)
role      user | partner | employer | moderator | admin
segment   partenaire | employeur | none (= segment IS NULL)
status    active | pending | locked | disabled
sort      createdAt | -createdAt | name | -name | lastLoginAt | -lastLoginAt (défaut -createdAt)
page      entier ≥ 1 (défaut 1)
pageSize  10 | 20 | 50 | 100 (défaut 20)
```

Réponse : `{ users: SerializedUser[], total: number, page: number, pageSize: number }`.
Le parseur de query (valeurs invalides → défauts, jamais d'erreur 400 pour un filtre inconnu)
et le constructeur de `where` Prisma vivent dans `lib/users.ts`, **partagés** entre la route
API et la page serveur, et testés en vitest.

**Page `/admin/users`** : lit `searchParams` (URL = état des filtres, partageable), requête
Prisma paginée (`skip/take` + `count` en `$transaction`). `UsersListClient` devient contrôlé :
les changements de filtre/page naviguent via `router.replace` (querystring), plus de filtrage
en mémoire. Les stat-cards globales sont calculées par un `groupBy` séparé (indépendant des
filtres actifs).

Fichiers : `app/api/users/route.ts`, `app/admin/users/page.tsx`,
`components/admin/users/users-list-client.tsx`, `lib/users.ts` (+ tests).

### Lot 2 — Grammaire cockpit + colonnes + export CSV

- Stat-cards refaites dans la grammaire du dashboard 2026-07-10 (cf. `components/admin/dashboard/*`) :
  cartes compactes, valeurs monospace, pastilles statut. Cliquer une carte applique le filtre correspondant.
- Nouvelles colonnes : pastille « email vérifié » (`emailVerifiedAt`), colonne organisation
  (`partnerOrganization`, + TVA en sous-texte pour le segment employeur). Tri par clic sur
  les en-têtes triables (name / createdAt / lastLoginAt), reflété dans l'URL (`sort`).
- **Export CSV** : `GET /api/users/export` (admin-gated), respecte les mêmes query params que
  la liste (sans pagination), échappement anti-injection formule (préfixer `= + - @` d'un `'`),
  même convention que les exports barèmes.

Fichiers : `users-list-client.tsx`, `app/api/users/export/route.ts` (+ test échappement), `messages/*` (clés).

### Lot 3 — Fiche 360° : squelette + onglet Aperçu

`/admin/users/[id]` devient une fiche à onglets : **Aperçu · Sécurité · Profil · Activité · Édition**.

- **Header identité** : avatar (initiales, palette existante), nom, email, badges rôle/segment/statut,
  organisation, alertes visibles (`banned`, `lockedUntil` actif, email non vérifié).
  Actions rapides : « Voir en tant que » (réutilise le flux impersonation existant), lien organisation.
- **Onglet Aperçu** : KPIs compacts grammaire cockpit — dernier login, sessions actives,
  compte créé le, mdp changé le, dossiers (BundleRun), brouillons PDF, RDV, impersonations subies.
- **Loader `lib/admin/user-360.ts`** : agrège en une passe (Promise.all de counts/findMany bornés)
  Session actives, BundleRun, PdfFormDraft, bookings (`userId` sans FK → simple `where`),
  AdminImpersonationLog (as target + as admin), UserProfile/EmployerProfile (existence).
  Sérialisation dates → ISO. Testé en vitest (mock prisma, comme dashboard-stats).

Fichiers : `app/admin/users/[id]/page.tsx`, `lib/admin/user-360.ts` (+ tests),
`components/admin/users/user-detail-shell.tsx`.

### Lot 4 — Onglet Sécurité + actions admin

- **Onglet Sécurité** : `passwordChangedAt`, `failedLoginAttempts`, `lockedUntil`,
  `emailVerifiedAt` ; liste des sessions actives (créée le, expire le, IP, userAgent abrégé,
  badge « impersonation » si `impersonatedBy`) ; historique impersonations (subies / menées si admin).
- **`DELETE /api/users/[id]/sessions`** : révoque toutes les sessions du user ;
  `?sessionId=` pour une seule. Interdit de révoquer sa propre session courante.
- **`POST /api/users/[id]/actions`** : body `{ action: "unlock" | "verify-email" }` au Lot 4.
  - `unlock` : `failedLoginAttempts = 0`, `lockedUntil = null`, statut `locked` → `active`.
  - `verify-email` : `emailVerified = true`, `emailVerifiedAt = now()`.
  - L'union est **étendue au Lot 6** avec `ban` / `unban` (`reason` obligatoire, `expiresAt`
    optionnel) ; d'ici là, toute autre action = 400 via le schéma Zod du body.
- **Toutes les routes de mutation** : `requireAdminAuth` + `ensureWriteAllowed` (mode lecture
  seule impersonation, déjà utilisé dans `edit-user-form.tsx`). Côté UI :
  `useImpersonationReadOnly` désactive les boutons avec tooltip (pattern existant).

Fichiers : `components/admin/users/user-security-tab.tsx`,
`app/api/users/[id]/sessions/route.ts`, `app/api/users/[id]/actions/route.ts` (+ tests API).

### Lot 5 — Édition complète + Zod + i18n

- **Formulaire d'édition** (déplacé en onglet Édition de la fiche, zone de danger conservée) :
  - Correction bug : **rôle `partner` ajouté** aux selects (édition + création).
  - Nouveaux champs, visibilité conditionnelle par segment :
    - `segment` (aucun / partenaire / employeur) — validé `isAudienceId()`.
    - segment partenaire → `partnerType` (4 valeurs existantes), `partnerOrganization`,
      `isOrgManager`, `canViewRdvHistory` (switches).
    - segment employeur → `vatNumber` **requis** (validé/normalisé `normalizeBelgianTVA()`,
      unicité gérée → 409 lisible), `partnerOrganization`.
  - Réutiliser les validateurs existants de `lib/access` — **ne pas dupliquer** la logique TVA/segment.
- **API** : `POST /api/users` et `PUT /api/users/[id]` passent en **schéma Zod** (remplace les
  checks manuels), acceptent les nouveaux champs. Cohérences imposées côté serveur :
  `role=partner` ⇒ `segment=partenaire` ; `role=employer` ⇒ `segment=employeur` + TVA ;
  segment nul ⇒ champs liés remis à null.
- **i18n** : `edit-user-form.tsx` migré vers next-intl (namespace `admin.users`), idem pour
  les nouvelles clés de la fiche. `pnpm i18n:check` doit passer (couverture langues).

Fichiers : `components/users/edit-user-form.tsx`, `app/admin/users/new/page.tsx`,
`app/api/users/route.ts`, `app/api/users/[id]/route.ts`, `messages/*`.
*(Lot le plus sensible : toucher PUT sans casser le flux better-auth account/password.)*

### Lot 6 — Onglets Profil & Activité + bannissement

- **Onglet Profil** : si `UserProfile` existe → identité/adresse/contact/préférences en lecture
  seule, **affichage parcimonieux des données sensibles** (NISS masqué sauf 4 derniers, IBAN
  masqué, pas de composition de ménage détaillée — juste le compte de membres). Si segment
  employeur → résumé `EmployerProfile`. Sinon : état vide explicite.
- **Onglet Activité** : dossiers (BundleRun : bundle, statut, dernière activité), brouillons
  PDF (formulaire, âge), RDV pris (tenant, date, statut). Listes bornées (10 dernières entrées
  + compte total), pas de pagination dans la fiche.
- **Bannir / débannir** : action dans le header + onglet Sécurité — raison obligatoire,
  expiration optionnelle (`banned/banReason/banExpires`). Un user banni voit un bandeau rouge
  en header de fiche et un badge en liste. *(Note : better-auth lit ces champs au getSession ;
  vérifier le comportement de session d'un banni — si le plugin ne coupe pas la session,
  combiner ban ⇒ révocation des sessions.)*

Fichiers : `components/admin/users/user-profile-tab.tsx`,
`components/admin/users/user-activity-tab.tsx`, `lib/admin/user-360.ts` (extension),
`app/api/users/[id]/actions/route.ts` (ban/unban).

### Lot 7 — Hub « Comptes & accès »

- **`components/admin/comptes-tabs.tsx`** : bandeau d'onglets partagé, posé en tête des 4 pages
  (Utilisateurs / Partenaires / Employeurs / Audit impersonations), avec compteurs légers
  (users totaux, orgs partenaires, orgs employeurs). Les routes existantes ne bougent pas.
- **Liens croisés** :
  - fiche user → son organisation dans `/admin/partenaires` ou `/admin/employeurs` (ancre/filtre) ;
  - `PartnerOverviewShell` : chaque user listé dans une organisation pointe vers `/admin/users/[id]`
    (retouche minime, pas de refonte du shell) ;
  - « Voir en tant que » accessible depuis la liste (menu ligne) et le header de fiche.

Fichiers : `comptes-tabs.tsx` (nouveau), retouches ciblées des 4 pages + 1 sous-composant du shell.

## 5. Sécurité & RGPD

- Toutes les mutations : `requireAdminAuth` + `ensureWriteAllowed` ; UI gated par
  `useImpersonationReadOnly` (patterns existants, aucun nouveau mécanisme).
- Export CSV : admin only, échappement anti-injection formule.
- Fiche 360° : données `UserProfile` sensibles masquées par défaut (NISS/IBAN), pas de
  déchiffrement NRN, pas d'affichage de `password`/hash (SAFE_USER_SELECT reste la règle).
- **Décision métier ouverte (Oraliks)** : la suppression reste un **hard delete** (cascade
  Session/Account, mais **orphelins** dans les tables sans FK : BundleRun, bookings,
  BookingTenantMember, PdfFormSubmission.userId…). L'anonymisation/purge relève de l'item 12
  de NEXT_ACTIONS (endpoints droits RGPD) — hors périmètre ici. La fiche affichera simplement
  le rappel « suppression définitive, les traces pseudonymes restent » dans la zone de danger.

## 6. Non-objectifs

- Pas de refonte de `PartnerOverviewShell` ni des pages stats/email partenaires-employeurs.
- Pas de nouvelles routes `/admin/comptes` (les URLs existantes restent canoniques).
- Pas de migration DB (aucun champ à ajouter).
- Pas d'anonymisation RGPD ni d'endpoints droits (item 12 NEXT_ACTIONS, plan séparé).
- Pas de gestion d'allowlist domaines/emails dans `/admin/users` (reste dans partenaires/employeurs).

## 7. Validation

Par lot : `pnpm test` + `pnpm build` (+ `pnpm i18n:check` pour les lots 2/3/5/6/7 qui ajoutent
des clés). Écrans à vérifier : `/admin/users` (filtres via URL, tri, export), `/admin/users/[id]`
(les 5 onglets + actions), `/admin/users/new` (création partenaire/employeur complète),
`/admin/partenaires` (liens croisés). Tests unitaires attendus : parseur de query,
constructeur `where`, loader user-360, schémas Zod POST/PUT, actions (unlock/verify/ban),
échappement CSV.

## 8. Risques

| Risque | Lot | Mitigation |
|--------|-----|------------|
| Régression filtres/pagination au passage serveur | 1 | Parseur partagé + testé ; comportement par défaut identique à l'existant |
| PUT users casse le flux better-auth (account credential) | 5 | Transaction existante conservée telle quelle ; tests API sur le chemin password |
| Contrainte unique `vatNumber` → 500 opaque | 5 | Catch P2002 → 409 message clair |
| Ban sans effet immédiat sur la session | 6 | Ban ⇒ révocation sessions dans la même transaction |
| Charge de la fiche 360° (8 sources) | 3/6 | Counts + findMany bornés (take ≤ 10), Promise.all, pas de N+1 |

## 9. Ordre d'exécution et état

1→2→3→4→5→6→7, chaque lot committé et validé séparément (workdir partagé multi-agents :
`git add` explicite uniquement). **Rien n'est codé à la date du spec.**
