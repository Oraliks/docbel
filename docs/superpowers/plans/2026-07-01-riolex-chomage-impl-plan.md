# Plan d'implementation — Corpus legal RioLex (chomage), phases 1-4

- **Date :** 2026-07-01
- **Spec source :** docs/superpowers/specs/2026-07-01-riolex-chomage-corpus-design.md
- **Statut :** plan d'implementation ancre dans le code reel (phases 1-4). Phase 0 (capture) est hors-code.
- **Contrainte DB :** Neon partage, pgvector deja actif (migration 19). Jamais `prisma db push` — additif uniquement via `prisma db execute` / script tsx `$executeRawUnsafe`, puis `prisma generate` dev server arrete.

---

## 0. Etat des lieux (code reel verifie)

Modeles Prisma (prisma/schema.prisma) :
- `KnowledgeSource` (L1478-1518) : id, title, kind, content @db.Text, summary?, sourceUrl?, fileId?, tags String[], enabled, domain @default("chomage"), createdAt, updatedAt, createdById?, indexedAt?, indexError?, folderId?, folder KnowledgeFolder?, lastValidatedAt?, validityStatus @default("unknown"), chunks KnowledgeChunk[]. Index : @@index([domain, enabled]), [createdAt], [domain, folderId], [domain, validityStatus].
- `KnowledgeFolder` (L1530-1550) : id, name, color?, icon?, parentId?, parent/children (self-relation "FolderHierarchy"), order, domain, sources[]. Hierarchie <= 3 niveaux (convention).
- `KnowledgeChunk` (L1561-1582) : id, sourceId, chunkIndex, content @db.Text, contentHash, embedding Bytes? @db.ByteA (placeholder — colonne SQL reelle vector(1536)), embedDim, embedModel. Colonne vectorielle reelle declaree dans prisma/migrations/19_add_knowledge_chunks_pgvector/migration.sql.

Pipeline RAG existant :
- lib/chomage-ia/embeddings.ts : getEmbeddingProvider(), embedTexts(texts) -> { vectors, model, dim } (padding 1536), vectorToSqlLiteral(v). Voyage voyage-3-lite (1024 -> pad 1536) ou OpenAI text-embedding-3-small (1536).
- lib/chomage-ia/chunker.ts : chunkText(text, { maxChars, overlap, minChars }), chunkContentHash(content) (sha256 tronque 32).
- lib/chomage-ia/indexer.ts : indexKnowledgeSource(sourceId) (idempotent par contentHash + chunkIndex, upserts raw SQL par micro-batch de 5, { timeout: 30_000, maxWait: 10_000 }) et runIndexInBackground(sourceId). Reutilisables tels quels par l'import.
- lib/chomage-ia/context.ts : buildKnowledgeContext (fallback, L102) et buildKnowledgeContextRag (RAG pgvector, L284). C'est ici qu'on ajoute le filtre visibility. Le vector search est un $queryRawUnsafe : WHERE s."domain" = $2 AND s."enabled" = true AND c."embedding" IS NOT NULL [AND s."folderId" = ANY($4::text[])] ORDER BY c."embedding" <=> $1::vector ASC LIMIT $3.
- lib/chomage-ia/chat-pipeline.ts : prepareChatContext({ domain, query, scopeFolderIds, enableWebSearch }) -> tente RAG puis fallback. Aucun parametre viewer/visibility aujourd'hui.
- lib/chomage-ia/legal-refs.ts : extractLegalReferences(text) -> string[] (patterns AR/AM/Loi/article/circulaire/Moniteur), findMissingInKb(...). Reutilisable pour pre-calculer les renvois a l'import.
- Appelant unique du chat : app/api/chomage-ia/chat/route.ts — garde requireAdminAuth (admin only aujourd'hui). Aucun chat citoyen/partenaire encore branche. Consequence : le filtre visibility est un ajout de securite en profondeur + une preparation ; le seul consommateur actuel est admin (voit tout).

Auth & entitlements :
- lib/auth-check.ts : requireAdminAuth(), requirePartnerOrAdminAuth() (retourne PartnerAuthorizedUser avec isAdmin, partnerOrganization). Forme { isAuthorized, user | error }.
- lib/entitlements.ts : ViewerAccount { segment, partnerType, role, plan? }, canUseTool(), toViewerAccount(user).

Migrations : dossiers prisma/migrations/NN_nom/migration.sql, appliques manuellement (cf. en-tete migration 19). Script raw SQL pattern : scripts/setup-lookup-trgm.ts (prisma.$executeRawUnsafe CREATE EXTENSION / CREATE INDEX IF NOT EXISTS ... USING gin), lance via pnpm exec dotenv -e .env.local -- tsx scripts/...

Shell partenaire : components/docbel/app-layout-client.tsx resolveProSegment(pathname, role) -> "partenaire" si role === "partner" et pathname sous /partenaire -> AppLayoutClient wrappe dans <ProShell segment="partenaire">. ProShell = sidebar shadcn (SidebarProvider/SidebarInset/ProSidebar), PAS le chrome glass. Navigation dans lib/pro-nav.ts (PARTNER_SPACE.groups[].items[], icones ProIcon). Pages /partenaire/** = Server Components qui verifient l'auth (ex. app/partenaire/formations/page.tsx).

Docs metier : docs/knowledge/chomage/*.md — blocs YAML rule_id / source_url / TODO_SOURCE_OFFICIELLE.

---

## Phase 1 — Schema additif + index plein texte + script d'import

### 1a. Colonnes additives visibility + legalMeta sur KnowledgeSource

SQL additif exact — nouveau fichier prisma/migrations/57_knowledge_visibility_legalmeta/migration.sql :

    -- Migration 57 — RioLex : gating visibilite + metadonnees legales
    -- Additif pur. Ne PAS db push. Appliquer via db execute puis migrate resolve --applied.
    ALTER TABLE "KnowledgeSource"
      ADD COLUMN IF NOT EXISTS "visibility" TEXT NOT NULL DEFAULT 'public';
    ALTER TABLE "KnowledgeSource"
      ADD CONSTRAINT "KnowledgeSource_visibility_check"
      CHECK ("visibility" IN ('public', 'partner', 'admin'));
    ALTER TABLE "KnowledgeSource"
      ADD COLUMN IF NOT EXISTS "legalMeta" JSONB;
    CREATE INDEX IF NOT EXISTS "KnowledgeSource_domain_visibility_enabled_idx"
      ON "KnowledgeSource" ("domain", "visibility", "enabled");

Modif schema.prisma (model KnowledgeSource, apres validityStatus) :
    visibility String @default("public")
    legalMeta  Json?
Et @@index([domain, visibility, enabled]).

Sequence d'application (ordre strict) :
1. Ecrire migration.sql + editer schema.prisma.
2. Arreter le dev server (regenerer pendant qu'il tourne provoque EPERM/lock Windows).
3. pnpm exec dotenv -e .env.local -- prisma db execute --file prisma/migrations/57_knowledge_visibility_legalmeta/migration.sql --schema prisma/schema.prisma
4. pnpm exec dotenv -e .env.local -- prisma migrate resolve --applied 57_knowledge_visibility_legalmeta
5. pnpm exec prisma generate (dev server arrete)
6. Redemarrer le dev server.

Note Neon : ADD COLUMN ... DEFAULT est instantane sur PG recent ; le CHECK est valide sur l'existant (tout 'public' par defaut). Sur sur base peuplee.

### 1b. Index plein texte francais (tsvector genere + GIN) sur KnowledgeSource.content

Colonne generee STORED contentTsv + index GIN. Hors schema.prisma (Prisma ne modelise pas GENERATED ALWAYS ni tsvector, comme embedding vector(1536) gere en raw). SQL dans 57_... (ou script scripts/setup-riolex-fts.ts calque sur setup-lookup-trgm.ts, prefere pour re-execution) :

    ALTER TABLE "KnowledgeSource"
      ADD COLUMN IF NOT EXISTS "contentTsv" tsvector
      GENERATED ALWAYS AS (to_tsvector('french', coalesce("content", ''))) STORED;
    CREATE INDEX IF NOT EXISTS "KnowledgeSource_contentTsv_idx"
      ON "KnowledgeSource" USING gin ("contentTsv");

Recherche : WHERE "contentTsv" @@ websearch_to_tsquery('french', $q) ; score ts_rank_cd ; surlignage ts_headline('french', "content", websearch_to_tsquery('french',$q), 'StartSel=<mark>,StopSel=</mark>,MaxFragments=2,MinWords=8,MaxWords=30'). unaccent = V2. Cout stockage negligeable (~centaines d'articles).

### 1c. Script scripts/import-riolex.ts

Signature (calquee sur les scripts tsx : import { prisma } + main() + .finally(disconnect)) :
Usage: pnpm exec dotenv -e .env.local -- tsx scripts/import-riolex.ts [--dir private/riolex/staging] [--dry-run]
Reutilise : indexKnowledgeSource (indexer.ts), extractLegalReferences (legal-refs.ts), prisma.

Etapes :
1. Lecture staging : lire private/riolex/staging/*.json via node:fs, valider chaque article avec un schema Zod local (cf. ChatRequestSchema). Collecter invalides dans rapport.
2. Dossiers KnowledgeFolder (idempotent par name+domain+parentId) : racine "Reglementation ONEM (RioLex)" (domain chomage, parentId null, icon BookOpen), sous-dossiers AR 25/11/1991, AM 26/11/1991, Loi-programme 2025, Autres lois (chomage). Helper ensureFolder(name, parentId) -> findFirst puis create. Mapper natureJuridique+loi -> sous-dossier.
3. Upsert idempotent KnowledgeSource — cle logique = legalMeta.riolexId + legalMeta.version. Pas de colonne unique -> recherche JSON : prisma.knowledgeSource.findFirst({ where: { domain:"chomage", legalMeta: { path:["riolexId"], equals: art.riolexId } } }). Version identique + content inchange -> skip ; sinon update (V1 conserve la derniere version, historique dans legalMeta ; garder les anterieures = V2) ; sinon create. Champs : title "Art. {n} — {titre}", kind "text", content art.texte, sourceUrl art.url, tags [natureJuridique, loi, "riolex", statut], enabled true, domain "chomage", folderId (mappe), visibility "partner", validityStatus abroge?"obsolete":"unknown". legalMeta { riolexId, loi, natureJuridique, articleNumber, datePublication, dateEntreeVigueur, dateMoniteur, statut, version, isOnemCommentary:false, refs:[] }. NB : visibility/legalMeta pas dans le create() de la route upload — ce script les pose directement.
4. Commentaire ONEM : source distincte visibility "admin", legalMeta.isOnemCommentary true, meme folderId, title "Commentaire ONEM — Art. {n}", liee via riolexId partage. (Pas dans legalMeta de l'article, sinon chunke/indexe avec le texte public.) Cree seulement si commentaireOnem non vide.
5. Pre-calcul renvois : refs = extractLegalReferences(texte). Resoudre vers riolexId via map articleNumber->riolexId (1re passe). legalMeta.refs = [{ raw, riolexId?, articleNumber? }] ; non resolus = { raw }. 2 passes : passe 1 upsert + index articleNumber->riolexId ; passe 2 recalcul refs + update legalMeta.
6. Indexation : await indexKnowledgeSource(ks.id) (synchrone, pour attendre/rapporter). Idempotent par contentHash. Les sources commentaire admin sont aussi indexees (RAG admin) ; Phase 2 les exclut pour non-admins.
7. Rapport final : { foldersEnsured, created, updated, skipped, commentSources, refsResolved, refsUnresolved, indexed, indexErrors }. --dry-run : tout calculer sans ecrire.

Ajout package.json : "riolex:import" et "riolex:setup-fts" (via dotenv -e .env.local -- tsx).

---

## Phase 2 — Filtre visibility au retrieval (context.ts) + test citoyen

Filtre applique aux DEUX fonctions de context.ts, plombe depuis prepareChatContext puis chat route.

1. Helper lib/chomage-ia/visibility.ts (pur) :
    export type KnowledgeVisibility = "public" | "partner" | "admin";
    export function allowedVisibilities(account: ViewerAccount | null): KnowledgeVisibility[] {
      if (account?.role === "admin") return ["public","partner","admin"];
      if (account?.segment === "partenaire") return ["public","partner"];
      return ["public"]; // citoyen / anonyme / employeur
    }
(Decision : employeur -> public only en V1, coherent avec le spec.)

2. buildKnowledgeContext (fallback, L102) : param visibilities?: KnowledgeVisibility[] (defaut ["public"] — appel non migre ne fuite jamais). findMany where (L124) += visibility: { in: visibilities }.

3. buildKnowledgeContextRag (L284) : meme param. Dans les DEUX branches raw SQL (scopee L369, non-scopee L393) += AND s."visibility" = ANY($N::text[]). Attention renumerotation des $N : scopee utilise $1..$4 -> visibilities en $5 ; non-scopee $1..$3 -> visibilities en $4 ; passer l'array en dernier arg de $queryRawUnsafe. Le count de prepareChatContext (L139) += visibility: { in: visibilities }.

4. prepareChatContext (chat-pipeline.ts) : param visibilities (defaut ["public"]) -> transmis a buildKnowledgeContextRag, buildKnowledgeContext, count.

5. Chat route (app/api/chomage-ia/chat/route.ts, L163) : admin -> visibilities ["public","partner","admin"]. Comportement admin inchange.

Defaut sur : sans visibilities -> ["public"] -> aucune fuite partner/admin possible.

Test prioritaire lib/chomage-ia/__tests__/visibility-gating.test.ts (s'aligner sur le runner du repo, vitest/jest) :
- Test pur (sans DB) sur allowedVisibilities() : citoyen/anonyme -> ["public"] ; partenaire -> ["public","partner"] ; admin -> les trois. Prouve qu'un citoyen n'a jamais "partner".
- Test d'integration (si DB de test/mock Prisma) : seeder 1 source public + 1 partner (chunks factices), appeler buildKnowledgeContext({ visibilities:["public"] }), asserter que includedSourceIds n'inclut PAS la source partner. RAG : mocker embedTexts, asserter que le SQL contient s."visibility" = ANY(...) avec ["public"]. Sinon test pur + verification de la clause where/SQL suffit pour l'exigence spec #8.

---

## Phase 3 — App de recherche partenaire /partenaire/reglementation

Livrable central. Chrome = ProShell (sidebar shadcn), PAS glass — automatique sous /partenaire/** pour role partner (resolveProSegment). Composants shadcn/ui uniquement.

### 3.1 Navigation
lib/pro-nav.ts -> PARTNER_SPACE groupe "Outils" :
    { title: "Reglementation (RioLex)", url: "/partenaire/reglementation", icon: "book" }
("book" existe deja dans ProIcon.)

### 3.2 Routes API (protegees requirePartnerOrAdminAuth), sous app/api/partenaire/reglementation/**, runtime nodejs :
    const auth = await requirePartnerOrAdminAuth();
    if (!auth.isAuthorized) return auth.error;
    const visibilities = allowedVisibilities(toViewerAccount(auth.user));

- GET /search — hybride. Params : q, nature (AR|AM|Loi-programme), statut, folderId, dateEvFrom/To, sort (pertinence|numero|date), page, pageSize (<= 50).
  1. Plein texte : $queryRawUnsafe sur KnowledgeSource : WHERE domain='chomage' AND visibility = ANY($v) AND contentTsv @@ websearch_to_tsquery('french',$q) [AND legalMeta->>'natureJuridique' = $n ...] ; ts_rank_cd + ts_headline. Renvoie { id, title, sourceUrl, legalMeta, rank, headline }.
  2. Semantique : si q non vide + provider -> embedTexts([q]), vector search agrege par source (min distance par sourceId), filtre visibility + domain. Reutilise vectorToSqlLiteral.
  3. Fusion : Reciprocal Rank Fusion entre rang FTS et rang semantique ; dedup par sourceId ; tri selon sort ; filtres nature/statut/date/folderId cote SQL ; pagination cote DB (FTS) + borne top-K semantique (~50) paginee en memoire. Ne jamais renvoyer content complet ni commentaire ONEM ici.
- GET /article/[riolexId] — fiche complete : content structure, legalMeta (dates/statut/version), refs (resolus -> liens internes vers riolexId ; non resolus -> texte), attribution (sourceUrl = lien profond RioLex). Commentaire ONEM charge SEULEMENT si visibilities inclut "admin" (defaut prudent V1 : admin only, cf. cadre juridique #3 ; re-evaluer apres CGU). "Voir aussi" = refs + sources meme folder.

### 3.3 Pages & composants (ProShell)
- app/partenaire/reglementation/page.tsx — Server Component, requirePartnerOrAdminAuth en tete, rend <ReglementationSearchClient/>, export const dynamic = "force-dynamic".
- app/partenaire/reglementation/[riolexId]/page.tsx — fiche article.
- components/reglementation/ (nouveau) : search-client.tsx ("use client" : Input + filtres Select/Badge + liste, fetch /search, debounce, etat URL via useSearchParams) ; result-card.tsx (titre + extrait surligne + badges nature/statut/date EV + lien fiche) ; article-view.tsx (texte, metadonnees, renvois cliquables /partenaire/reglementation/{riolexId}, "Voir aussi", bloc attribution "Source : ONEM RioLex — Art. {n} — consulte le {date}" + lien profond, bloc commentaire ONEM etiquete si autorise). Uniquement components/ui/* (shadcn) + lucide. Pas de glass.

### 3.4 Surlignage sur : ts_headline renvoie du HTML <mark>. Cote client : reconstruire les <mark> en JSX (parser, pas de dangerouslySetInnerHTML brut) -> pas de XSS.

---

## Phase 4 — Liaison doc metier

Mettre a jour docs/knowledge/chomage/*.md : completer source_url / TODO_SOURCE_OFFICIELLE par URLs d'articles RioLex (format https://rvaonemtech.powerappsportals.com/fr-FR/wetsartikel/?id=<riolexId>), mapping spec #7 :

| Fichier | Theme | Renvoi RioLex |
|---|---|---|
| reforme-2026.md | base legale reforme 2026 | Loi-programme 18/07/2025 art. 209-216 |
| agr-temps-partiel.md | AGR | AR 25/11/1991 art. 131bis |
| allocations-insertion.md | admission | AR 25/11/1991 art. 30 |
| situation-familiale-c1-t147.md | situation familiale | AR 25/11/1991 art. 110 |
| (jours assimiles) | jours assimiles | AR 25/11/1991 art. 38 |
| reforme-2026.md | degressivite/periodes | AR 25/11/1991 art. 114 |
| (sanctions) | sanctions | AR 25/11/1991 art. 153-159 |

Regles : ajouter source_legal_url en complement (ne pas ecraser une page ONEM pedagogique existante) OU convertir les TODO restants en URL RioLex si un article couvre exactement le point. Conserver a_verifier sur les details chiffres (baremes hors RioLex). Aucune ligne inventee. Verifier coherence avec README.md ; ajouter la convention source_legal_url. Fichiers = doc (pas code applicatif) — edition autorisee en implementation.

---

## Risques & garde-fous

- DB partagee Neon : Phase 1 additive + idempotente (ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS, DEFAULT 'public'). Instantane + sur sur base peuplee. Jamais db push — db execute + migrate resolve --applied.
- prisma generate dev server arrete (lock .prisma Windows -> EPERM).
- Catch-all app/[slug] : /partenaire/reglementation doit etre une vraie route fichier sous app/partenaire/ (segment nomme prioritaire sur catch-all — verifier qu'aucun app/partenaire/[slug] n'intercepte). [riolexId] : verifier acceptation des caracteres (underscores, art_, -).
- pgvector raw SQL : renumerotation des $N dans buildKnowledgeContextRag = point le plus fragile — tester les deux branches (scopee/non-scopee), garder $1::vector en 1re position, ne pas casser le fallback.
- ivfflat (lists=100) : recherche semantique Phase 3 reutilise le meme index ; WHERE visibility post-ORDER peut reduire le rappel -> sur-echantillonner (top-K*3, deja fait).
- ts_headline = HTML -> XSS : rendre <mark> en JSX reconstruit.
- Lint pre-existant (~74 erreurs) : ne pas en ajouter. Nouveaux fichiers stricts (eslint-disable cible pour les any, comme l'existant). pnpm lint avant/apres -> delta 0.
- Commentaire ONEM : defaut visibility "admin" (jamais public verbatim) tant que CGU non validees (spec #3/#9). Reversible via visibility.
- Idempotence import : re-run ne duplique pas (cle riolexId) ; nouvelle version met a jour ; indexer skip chunks inchanges (contentHash). Toujours tester --dry-run avant.

---

## Ordre de commits recommande

1. feat(kb): visibility + legalMeta additive migration (57) — migration.sql, edits schema.prisma, scripts/setup-riolex-fts.ts, entrees package.json.
2. feat(rag): visibility gating in retrieval — lib/chomage-ia/visibility.ts, edits context.ts (2 fonctions + count) + chat-pipeline.ts + chat/route.ts, test de gating. pnpm build + pnpm lint (delta 0). Livrable independant meme sans import.
3. feat(scripts): import-riolex staging -> KnowledgeSource + index — scripts/import-riolex.ts (testable --dry-run).
4. feat(partenaire): API recherche reglementation (hybride FTS+semantique) — app/api/partenaire/reglementation/**.
5. feat(partenaire): app /partenaire/reglementation (ProShell) — pages + components/reglementation/** + entree lib/pro-nav.ts.
6. docs(knowledge): renvois RioLex dans docs/knowledge/chomage — Phase 4.

Phases 1-2 d'abord (socle) ; Phase 3 depend de 1b (FTS) + 2 (visibility) ; Phase 4 depend des riolexId reels (Phase 0) mais preparable en parallele.

## Fichiers critiques pour l'implementation
- lib/chomage-ia/context.ts (filtre visibility dans les 2 retrievals — coeur Phase 2)
- prisma/schema.prisma + prisma/migrations/57_knowledge_visibility_legalmeta/migration.sql (colonnes + FTS additifs — Phase 1)
- scripts/import-riolex.ts (import idempotent + renvois + indexation — Phase 1c)
- lib/chomage-ia/indexer.ts & lib/chomage-ia/legal-refs.ts (reutilises par l'import, non modifies)
- app/partenaire/reglementation/page.tsx + app/api/partenaire/reglementation/search/route.ts (livrable central Phase 3)
