# Spec — Corpus légal RioLex (chômage) dans Docbel

- **Date :** 2026-07-01
- **Statut :** design validé (périmètre + capture confirmés par Oraliks) — à relire avant plan d'implémentation
- **Auteur :** session Claude Code (brainstorming)
- **Sujet :** importer les **textes légaux chômage de RioLex** (portail ONEM) dans Docbel, **gatés partenaire**, **accessibles aux agents IA** (RAG), avec attribution.

---

## 1. Contexte & objectif

L'ONEM expose, via le portail **RioLex Externe** (`rvaonemtech.powerappsportals.com/fr-FR/RioLex/`),
une bibliothèque juridique où **chaque entrée = un article de loi** (URL stable
`/wetsartikel/?id=<loi>-<seq>-art_<num>`), affiché en **texte HTML** + métadonnées + commentaire ONEM.

Objectif : disposer dans Docbel d'un **corpus légal chômage fiable et daté**, qui :
- alimente les **agents IA** (RAG) avec la source faisant autorité (au lieu de la recherche web) ;
- est **consultable par les partenaires** (pas par les citoyens) ;
- sert de **source officielle** aux règles métier de `docs/knowledge/chomage/` (remplace des `TODO_SOURCE_OFFICIELLE`).

Ce spec s'appuie sur l'infrastructure RAG existante (`lib/chomage-ia/`, modèles
`KnowledgeSource`/`KnowledgeChunk`/`KnowledgeFolder`) et le gating partenaire
(`lib/entitlements.ts` `canUseTool`, `lib/auth-check.ts` `requirePartnerOrAdminAuth`).

## 2. Périmètre V1 (validé)

- **RioLex, matière « Chômage » uniquement.** Concrètement : **AR du 25/11/1991** (réglementation
  chômage), **AM du 26/11/1991**, **Loi-programme du 18/07/2025** (base légale réforme 2026), et les
  **lois liées rattachées à la matière Chômage** dans RioLex.
- **Livrable clé V1 :** une **interface de recherche / consultation front-end** des textes légaux,
  **meilleure que RioLex** — recherche **plein texte + sémantique**, filtres riches, fiches article
  structurées, renvois entre articles, historique de versions. **Gatée partenaire** (chrome ProShell) ;
  le texte étant domaine public, un **basculement vers une version publique citoyens** reste possible
  plus tard (simple changement de `visibility`).
- **Hors périmètre V1 :** RioDoc (instructions/manuels/feuilles info — fichiers PDF/Word/Excel), les
  autres matières (ALE, crédit-temps, fermeture d'entreprises…), le néerlandais. → V2, après lecture
  des **Conditions d'utilisation**.

## 3. Cadre juridique & attribution

- **Texte de l'article** = législation belge = **domaine public** → stockable, republiable
  (partenaire), avec **attribution** (n° article, loi/AR, date EV, date Moniteur, « Source : ONEM
  RioLex, consulté le JJ/MM/AAAA »).
- **Commentaire / Schéma ONEM** = production propre de l'ONEM → **réf. interne partenaire/agents
  uniquement**, jamais en page publique verbatim, **marqué** comme tel (`isOnemCommentary: true`).
- **Accès authentifié** : RioLex est derrière un **SSO OpenID Connect (Keycloak realm rvatech)**.
  La capture passe donc par la **session authentifiée d'Oraliks**, jamais par des identifiants
  stockés dans Docbel. Les conditions d'accès du portail sont respectées (pas de re-publication du
  commentaire ONEM tant qu'elles ne sont pas validées).

## 4. Architecture (réutilisation maximale)

### 4.1 Données — ajouts **additifs** (⚠️ jamais `prisma db push` sur Neon ; SQL via `prisma db execute`)
- `KnowledgeSource.visibility` : `"public" | "partner" | "admin"`, **défaut `"public"`** (l'existant
  n'est pas affecté). Les sources RioLex = `"partner"`.
- `KnowledgeSource.legalMeta` : `Json?` — `{ riolexId, loi, natureJuridique (AR|AM|Loi-programme),
  articleNumber, datePublication, dateEntreeVigueur, dateMoniteur, statut, version, isOnemCommentary }`.
- **Dossiers** (`KnowledgeFolder`, hiérarchie ≤ 3 niveaux) : racine **« Réglementation ONEM (RioLex) »**
  → sous-dossiers `AR 25/11/1991`, `AM 26/11/1991`, `Loi-programme 2025`, `Autres lois (chômage)`.
- `domain = "chomage"` (l'agent chômage existant en bénéficie ; l'isolation se fait par `visibility`).

### 4.2 Gating au retrieval (seul vrai ajout de logique applicative)
- Étendre `buildKnowledgeContextRag()` et `buildKnowledgeContext()` (`lib/chomage-ia/context.ts`)
  pour **filtrer les sources par `visibility` selon le visiteur** :
  - chat **citoyen / public** → `visibility = "public"` seulement ;
  - chat **partenaire** → `"public"` + `"partner"` ;
  - chat **admin** → tout.
- Le filtre s'applique aussi à la sélection des chunks (vector search) : un citoyen ne peut jamais
  récupérer un chunk `partner`/`admin`. **Test prioritaire** (cf. §8).

### 4.3 Outil de recherche / consultation partenaire (livrable central V1 — « mieux que RioLex »)
Espace **`/partenaire/reglementation`** (chrome `ProShell`), gardé par `requirePartnerOrAdminAuth`
(+ `canUseTool` si on en fait un outil entitlement). Objectif UX : une **vraie app de recherche
juridique**, plus agréable et plus puissante que RioLex.

- **Recherche hybride** :
  - **plein texte** (Postgres `tsvector`/GIN sur le texte des articles, avec surlignage) ;
  - **sémantique** (« par le sens ») en réutilisant les **embeddings déjà produits pour le RAG**
    (pgvector) — ce que RioLex ne fait pas.
- **Filtres** : loi / nature juridique (AR / AM / Loi-programme), n° d'article, thème/tag,
  **statut** (en vigueur / abrogé), date d'entrée en vigueur, date Moniteur.
- **Liste de résultats** : titre d'article + extrait pertinent surligné + badges (nature, statut,
  date EV) ; tri par pertinence / n° / date.
- **Fiche article** : texte structuré et lisible, **métadonnées** (n°, dates EV/MB/publication,
  statut), **historique des versions**, **renvois entre articles** (réutiliser
  `lib/chomage-ia/legal-refs.ts` pour détecter « art. X », « AR du … » et créer des liens internes),
  section **« Voir aussi »**, **attribution** (« Source : ONEM RioLex — <n°> — consulté le … ») +
  **lien profond** vers RioLex.
- **Commentaire ONEM** : affiché dans cette zone **partenaire interne**, clairement séparé et
  étiqueté, **jamais** en page publique verbatim.
- Réutilise les requêtes `KnowledgeSource` (bornées par `take`, filtre `domain=chomage` +
  `visibility` + `folderId` RioLex). Pagination/tri/filtre **côté DB**.

### 4.4 Backend de recherche
- **Index plein texte** : colonne générée `tsvector` (français) sur `KnowledgeSource.content` +
  index **GIN** (SQL additif via `db execute`). Requête `websearch_to_tsquery` + `ts_headline`
  pour le surlignage.
- **Recherche sémantique** : réutilise `KnowledgeChunk.embedding` (pgvector) et le provider
  d'embeddings existant (`lib/chomage-ia/embeddings.ts`) pour embedder la requête et faire un
  top-K, filtré par `visibility`/dossier.
- **API** : route(s) sous `app/api/partenaire/reglementation/**` (ou réutilisation d'une route de
  recherche KB existante), protégée par `requirePartnerOrAdminAuth`, retour paginé.
- Les **renvois entre articles** sont pré-calculés à l'import (extraction via `legal-refs.ts`) et
  stockés dans `legalMeta.refs` pour un rendu instantané.

## 5. Pipeline de capture (Phase 0 — l'étape immédiate)

Accès **authentifié** ⇒ extraction **séquentielle via l'extension Claude in Chrome** sur la session
d'Oraliks. Pas de scraper live dans l'app, pas d'identifiants stockés. Sortie = **JSON de staging**
revu avant import.

**Étapes :**
1. **Énumération exhaustive.** Sur `/RioLex/`, filtrer **Matière = Chômage**, puis **parcourir
   TOUTES les pages** de la liste et collecter chaque `{ titre, url /wetsartikel/?id=…, date, loi,
   nature }`. Noter le **nombre total annoncé** (« X résultats ») = cible de complétude.
2. **Extraction par article.** Pour chaque URL : `texte de l'article`, `commentaire ONEM` (séparé),
   `propriétés` (n° article, dates EV/MB/publication, statut, nature), `versions`.
3. **Écriture du staging** : `private/riolex/chomage-staging.json` (hors git ; cf. schéma §5.1).
4. **Multi-agents (traitement, pas fetch)** : une fois le texte brut récupéré via le navigateur,
   des sous-agents **normalisent/structurent en parallèle** des lots d'articles, et **vérifient la
   complétude** par sous-liste.
5. **Vérification finale par l'agent principal (moi)** — le point clé demandé :
   - `count(capturés) == X résultats` annoncé après filtre Chômage ;
   - **recoupement contre l'arborescence connue** (AR 25/11/1991 art. 1→196 + bis/ter/quater… ;
     AM 26/11/1991 ; Loi-programme art. 209-216) → liste des **manquants / abrogés / vides** ;
   - **contrôle qualité** par échantillon (texte non tronqué, commentaire bien séparé, métadonnées
     présentes, version correcte) ;
   - rapport de complétude : `capturés / attendus / manquants / à re-capturer`.

### 5.1 Schéma du JSON de staging
```jsonc
{
  "capturedAt": "2026-07-01",
  "source": "RioLex Externe (ONEM) — matière Chômage",
  "totalAnnounced": 0,            // « X résultats » après filtre Chômage
  "articles": [
    {
      "riolexId": "25_11_1991-1-art_100",
      "url": "https://rvaonemtech.powerappsportals.com/fr-FR/wetsartikel/?id=25_11_1991-1-art_100",
      "loi": "AR du 25 novembre 1991 portant réglementation du chômage",
      "natureJuridique": "AR",
      "articleNumber": "100",
      "titre": "Régime d'indemnisation / chômage complet",
      "texte": "…",               // texte de l'article (domaine public)
      "commentaireOnem": "…",     // production ONEM — partenaire/admin only
      "datePublication": "…",
      "dateEntreeVigueur": "…",
      "dateMoniteur": "…",
      "statut": "Publié | Abrogé | …",
      "version": "…",
      "abroge": false
    }
  ],
  "completeness": { "captured": 0, "expected": 0, "missing": [], "empty": [] }
}
```

## 6. Import (Phase 1)

- **Script admin** (tsx, `scripts/import-riolex.ts`) : lit le staging JSON → **upsert
  `KnowledgeSource`** (idempotent par `legalMeta.riolexId` + `version` ; `kind: "text"`,
  `visibility: "partner"`, `domain: "chomage"`, dossier selon nature, `sourceUrl`, `tags`,
  `summary`, `legalMeta`) → déclenche l'**indexation** (`indexKnowledgeSource()` : chunk + embed,
  idempotent par `contentHash`).
- Le **commentaire ONEM** est stocké dans une source/segment marqué `isOnemCommentary: true`
  (ou champ dédié), exclu de toute vue publique.
- Migration schéma : fichier SQL **additif** appliqué via `prisma db execute` (colonnes `visibility`,
  `legalMeta`), jamais `db push`. `prisma generate` avec le dev server **arrêté**.

## 7. Liaison avec la doc métier existante

Mettre à jour les `source_url` / `TODO_SOURCE_OFFICIELLE` de `docs/knowledge/chomage/` vers les
articles RioLex précis, ex. : réforme → Loi-programme 18/07/2025 art. 209-216 ; AGR → AR art. 131bis ;
admission → AR art. 30 ; situation familiale → AR art. 110 ; jours assimilés → AR art. 38 ;
dégressivité/périodes → AR art. 114 ; sanctions → AR art. 153-159.

## 8. Tests & garde-fous

- **Test de gating (prioritaire)** : un viewer citoyen ne récupère **aucun** chunk `partner`/`admin`
  (unit test sur le retrieval filtré).
- Test **parseur d'extraction** (texte vs commentaire vs métadonnées) sur un échantillon figé.
- Test **import idempotent** (re-run ne duplique pas ; nouvelle version met à jour).
- `pnpm build` vert ; `pnpm lint` sans nouvelle erreur ; aucune page existante modifiée hors le
  filtre `visibility`.
- **Complétude** : le rapport de §5 doit afficher 0 manquant non justifié avant de considérer la
  capture « faite ».

## 9. Risques & points ouverts

- **Conditions d'utilisation** du portail (à lire avant V2 RioDoc et avant toute republication du
  commentaire ONEM). Pour V1, on s'en tient au texte légal (domaine public) + attribution.
- **Session authentifiée** : extraction dépendante de la session d'Oraliks ; si elle expire, on
  reprend (idempotent). Pas d'identifiants stockés.
- **Refonte du site ONEM / Power Apps** : les URLs `/wetsartikel/?id=` peuvent changer → `legalMeta`
  conserve `riolexId` pour re-cibler.
- **Volume** : matière Chômage = quelques centaines d'articles → OK pour embeddings (batchs).

## 10. Découpage en phases

- **Phase 0 — Capture (immédiate)** : énumération + extraction → staging JSON + **rapport de
  complétude vérifié par l'agent principal**. *Ne touche pas au code applicatif.*
- **Phase 1 — Schéma + import** : colonnes additives `visibility`/`legalMeta` + index plein texte
  (`tsvector`/GIN) via `db execute` ; `scripts/import-riolex.ts` (upsert idempotent, pré-calcul des
  renvois via `legal-refs.ts`) + indexation embeddings.
- **Phase 2 — Gating retrieval** : filtre `visibility` dans `context.ts` + **test citoyen** (ne voit
  pas `partner`).
- **Phase 3 — App de recherche partenaire (centrale)** : `/partenaire/reglementation` — recherche
  hybride (plein texte + sémantique), filtres, liste surlignée, fiche article (versions, renvois,
  attribution). C'est le plus gros lot.
- **Phase 4 — Liaison doc** : mise à jour des `source_url` dans `docs/knowledge/chomage/`.

Chaque phase est livrable indépendamment ; Phase 0 d'abord (c'est la demande).
