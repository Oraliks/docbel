# Plan Réglementation V3 — « rendre le texte de loi vivant »

> **Statut : proposition à valider par Oraliks** (2026-07-03). Rien n'est codé.
> Méthode : exploration multi-agents du code + des 46 fichiers staging RioLex,
> 39 idées générées sous 4 lentilles (terrain / benchmarks legal-tech / lisibilité / data-IA),
> chaque idée vérifiée contre le code réel → doublons fusionnés, ~19 retenues.

## Demandes explicites d'Oraliks (actées, socle du plan)
- (a) Abrogé **barré en rouge**, mais lisible.
- (b) Références de modification `[…(AR 30.7.2022 - MB 23.8 - EV 1.10)]` **cliquables** (voir ce qu'elles signifient).
- (c) Texte de loi **plus lisible**.
- (d) **Mieux utiliser la largeur**.
- (e) Liens **RioLex cachés** sauf admin.
- (f) Système de **hashtags**.

## Ce que les données permettent (vérifié sur les 443 articles)

| Gisement | Volume | Exploitable pour |
|---|---|---|
| Crochets d'amendement `[…(AR j.m.aaaa - MB - EV)]` | 485 occ. / 258 articles | popover cliquable + timeline (demande b) |
| Réfs modificatrices inline `(AR j.m.aaaa …)` | 1022 occ. / 299 articles (741 avec segment MB) | idem — parseur tolérant requis |
| Renvois « l'article N » | 1405 occ. (~311 visent une AUTRE loi) | auto-linking interne (résolveur contextuel obligatoire) |
| Articles `abroge=true` | 99 | barré rouge + badge (demande a) |
| Marqueurs RioLex `{n}` / `❌` | 251 / 45 occ. | `{n}`=ancre de modification, `❌`=fragment supprimé — à traduire en indicateurs propres (contenu des popups RioLex **perdu** à l'extraction) |
| Slug `riolexId` | 443/443 déterministe `JJ_MM_AAAA-1-art_N` | résolution mécanique des renvois |
| Réforme 2026 (`Loi-programme 18.7.2025`) | 107 articles | badge + filtre |
| Commentaires ONEM (admin) | 242, avec blocs `Schéma N` (7) et `Références 0` (12) non parsés | rendu structuré + renvois croisés |
| `tags[]` KnowledgeSource | 3-4 tags génériques | hashtags (demande f), outillage curation admin existant |
| RAG pgvector | 2532 chunks indexés | Q&A IA (⚠️ bug : `prepareChatContext` hardcode `visibility public` → corpus invisible même pour le chat admin) |

**Pièges transverses découverts** (à garder en tête quel que soit le lot) :
- `import-riolex.ts` **écrase `legalMeta` entier** à chaque ré-import → tout enrichissement
  (flags, résumés, backlinks) doit être intégré à l'import OU rejoué après (à documenter dans le script).
- `dateEntreeVigueur` est **constante par loi** (= date de la loi mère), affichée trompeusement
  comme « EV » sur les cartes → à remplacer par la vraie dernière EV dérivée des crochets.
- `legalMeta.refs` contient des chaînes **tronquées** (« art. 78t » au lieu de 78ter, bug regex
  `lib/chomage-ia/legal-refs.ts`) → ne pas réutiliser, re-résoudre au runtime.
- 87 articles ont des crochets multi-lignes, 34 un déséquilibre `[`/`]` (artefacts d'extraction).

---

## Vague 1 — Le texte vivant (tes demandes, ~5-7 jours)

| # | Fonctionnalité | Effort | Détail |
|---|---|---|---|
| 1.1 | **Liens RioLex admin-only** (e) | 0,25 j | 4 emplacements : fiche en-tête (`page.tsx` l.183-193), bloc print (l.218-220), prop sidebar (l.229), + lien « RioLex » des cartes résultat (nuller `sourceUrl` côté API selon rôle). `isAdmin` déjà disponible partout. |
| 1.2 | **Abrogé barré rouge lisible** (a) | 0,5 j | Blocs `[Abrogé (…)]` déjà typés par le parseur → `line-through text-destructive/70` + date d'abrogation extraite en badge ; items inline « 9° : abrogé (AM …) » pareil ; bandeau d'avertissement en tête des 99 fiches `abroge=true`. |
| 1.3 | **Marqueurs `{n}`/`❌` traduits** (c) | 1 j | `{n} ❌` → pastille « fragment supprimé » (tooltip honnête : historique non capturé) ; `{n}` seul → indicateur discret « modifié » ; corps 100 % placeholders (~4 fiches) condensé en « N alinéas supprimés ». Parseur pur + tests. |
| 1.4 | **Hiérarchie typographique** (c) | 1 j | Les types de blocs existent déjà (§/1°/a)/tirets) : hanging indent, § en semi-bold violet, colonnes de puces alignées, filet vertical pour sous-niveaux, espacement croissant. + inférer le niveau a) sous 1°. 2 fichiers. |
| 1.5 | **Crochets de modification cliquables + timeline** (b) | 3-4 j, 2 lots | Nouveau `lib/reglementation/parse-amendments.ts` (regex tolérante : variantes sans MB/EV, « EV à déterminer », année à inférer) → puce numérotée + Popover « Modifié par l'AR du 30/07/2022 — Moniteur 23/08 — en vigueur 01/10/2022 » ; mini-timeline sidebar triée par EV ; corrige au passage l'« EV » trompeuse. **LA** réponse à (b). |
| 1.6 | **Densité / mesure réglables** (d) | 0,5-1 j | ToggleGroup Compact / Confort (actuel 72ch) / Large (~90ch, 17px) persisté localStorage (init lazy, pas de setState-in-effect). La largeur devient un choix, pas du blanc perdu. |

## Vague 2 — Naviguer comme dans un code annoté (~6-9 jours)

| # | Fonctionnalité | Effort | Détail |
|---|---|---|---|
| 2.1 | **Renvois internes cliquables** | 2-4 j | `lib/reglementation/resolve-ref.ts` (pur + testé) : « l'article 36 » → lien vers la fiche, défaut = loi courante, « de l'arrêté royal » dans un texte AM → AR 25/11/1991, loi hors corpus → texte brut. Vérif d'existence via Set des 443 riolexId. Sidebar « Références citées » : badges morts → liens. |
| 2.2 | **Sommaire par loi + précédent/suivant** | 2-3 j | Page `/partenaire/reglementation/loi/[slug]` (6 lois, dossiers existants), breadcrumb cliquable, boutons ← Art. 43 · Art. 45 → (le tri voisin existe déjà dans la fiche). Bonus : flèches clavier + `/` pour focus recherche (~40 lignes). |
| 2.3 | **Ancres par § + permalien + « Copier la référence »** | 1,5-2 j | `id` stable par § (dérivé du marker), icône copie au survol, `:target` + surlignage à l'arrivée ; bouton « Copier la référence » → « AR 25/11/1991, art. 44, § 2 — consulté le 03/07/2026 » prêt à coller dans un mail. |
| 2.4 | **Backlinks « Cité par »** | 2-4 j | Script offline (pattern import) : inverse le graphe des renvois de 2.1 → `legalMeta.citedBy[]` (JSON, zéro migration), card sidebar « Cité par (N) ». Intègre les blocs « Références 0 » des commentaires (côté admin). **Après 2.1** (même résolveur). |

## Vague 3 — Trouver plus vite (~5-8 jours)

| # | Fonctionnalité | Effort | Détail |
|---|---|---|---|
| 3.1 | **Boost match exact numéro d'article** | 0,5-1 j | Détection « art. 79 » / « 131bis » / « AR/AM » dans `q` (fonction pure testée) → branche exacte épinglée en tête du RRF. Corrige le défaut connu (art. 79). Meilleur ratio effort/impact du plan. |
| 3.2 | **Palette Ctrl+K** | 1,5-2 j | cmdk déjà installé (`components/ui/command.tsx`) ; index léger des 443 {riolexId, loi, articleNumber, title} (~30 Ko) ; « am 75ter » → fiche en 2 s. |
| 3.3 | **Hashtags** (f) | 3-5 j, 2 lots | Vocabulaire contrôlé dérivé du glossaire (#admissibilite #sanction #agr #degressivite #reforme-2026…) à **figer avec Oraliks**, batch Haiku (<5 €) → `tags[]`, curation via l'admin KB existante (bulk-tag-picker), PUIS facette + chips côté front (jamais avant curation). |
| 3.4 | **Badge + filtre « Réforme 2026 »** | 2 j, 2 lots | 107 articles détectables par regex (`Loi-programme 18.7.2025`, pas la seule date `1.3.2026` — 145 occ., trop large). Flag en `legalMeta` + détection intégrée à l'import. Badge orange cartes + bandeau fiche + filtre. |
| 3.5 | **Épinglés + consultés récemment** | 1 j | localStorage (zéro migration, zéro RGPD), chips dénormalisées en tête de liste. Limite assumée : par poste/navigateur. |

## Vague 4 — Le guichet augmenté (~7-12 jours)

| # | Fonctionnalité | Effort | Détail |
|---|---|---|---|
| 4.1 | **Mode guichet** (grand texte, écran tourné vers l'usager) | 1 j | Toggle « Lecture » : masque chrome/sidebar, texte en grand, Échap pour sortir. Wrapper client + data-attribute (le pattern `print:` liste déjà quoi masquer). |
| 4.2 | **Comparer deux articles** (duo AR ↔ AM) | 2-3 j | `/partenaire/reglementation/comparer?a=…&b=…`, 2 × LegalText côte à côte (la pleine largeur absorbe 2×72ch), picker via l'API search, URL partageable. Factoriser le fetch fiche en `lib/reglementation/get-article.ts`. |
| 4.3 | **Impression juridique soignée** (scope réduit) | 2-3 j | `break-inside-avoid` sur §, abrogés imprimés barrés, en-tête simple, case admin « inclure commentaires ONEM » (ouvre les accordéons avant print). **Sans** margin-boxes `@page` ni notes de fin (non supportés navigateur / donnée perdue). |
| 4.4 | **Q&A IA sur le corpus** (réponses sourcées cliquables) | 2-4 j | Corrige le bug `visibilities` de `prepareChatContext` (~5 lignes, à faire de toute façon), clone de quick-chat gardé `requirePartnerOrAdminAuth`, mapping `[SRC:id]` → fiche via riolexId. ⚠️ auditer le bloc memory (curation admin) avant exposition partenaire + rate-limit. |
| 4.5 | **Résumé « en clair » par article** | 2-3 j | Batch Haiku one-shot (<5 €) sur les ~344 articles en vigueur → `legalMeta.plainSummary`, encart badge « non officiel », bouton admin « régénérer » (route dédiée — le PATCH KB n'accepte pas legalMeta). Nettoyer `{n}`/`❌` en entrée de prompt (→ après 1.3). |
| 4.6 | **Liens « Base légale » depuis les outils** | 0,25 j + 1-2 j | (i) lien statique AGR → art. 131bis (quick win isolé) ; (ii) convention `riolex:` dans le champ dormant `sourceIds` du Decision Builder + rendu admin. Volet « règles Markdown » reporté (pas de consommateur UI aujourd'hui). |

## Vague 5 — Qualité du corpus (admin, ~4-6 jours)

| # | Fonctionnalité | Effort | Détail |
|---|---|---|---|
| 5.1 | **Santé du corpus** | 2-4 j, 2 lots | Backfill des métadonnées de qualité strippées à l'import (13 commentaires tronqués, 3 condensés, 4 articles reconstruits) via script legalMeta-only (PAS de ré-import complet : ré-embedde les 685 sources) ; page admin listant tronqués/suspects/incohérences (`version`==numéro ×112, EV constante). Badge « commentaire incomplet » sur la fiche admin. |
| 5.2 | **Blocs « Schéma » et « Références » des commentaires ONEM** | 1,5-2 j | Étendre `splitOnemCommentary` (entêtes inline, `Schéma N`, `Références 0`) ; schémas en `font-mono whitespace-pre` (alignement préservé), « VOIR AUSSI » → liens internes vérifiés. Admin-only, risque partenaire nul. |

## Différé (chantier réel, ne pas sous-estimer)
- **Encre distincte des passages insérés entre `[crochets]`** : sur 283 articles à crochets,
  87 multi-lignes + 34 déséquilibrés + 16 imbriqués → parseur de spans avec pile + fallback,
  ~1 semaine. À re-évaluer après la vague 1 (la timeline 1.5 couvre déjà l'essentiel du besoin).
- **Marginalia en gouttière droite** : layout client fragile (offsetTop, collisions, resize,
  3 colonnes avec la sidebar) — le Popover de 1.5 rend le même service ; itération future si besoin confirmé.

## Ordre recommandé
1. **Vague 1 en premier** (c'est ta demande, quasi tout est quick-win, spectaculaire à l'écran).
2. Puis **3.1** (boost art. exact — 1 j, gros irritant connu) glissé entre deux lots.
3. Vague 2 (navigation) → Vague 3 (recherche) → Vague 4 → Vague 5, en lots de 3-5 fichiers.
4. Chaque lot : `pnpm test` (parseurs purs testés), `pnpm build`, écran fiche art. 29 (riche en
   crochets/{n}/❌), art. 84 (abrogé), art. 131bis (AGR), liste avec `?q=art. 79`.

**Total indicatif : ~27-42 jours** de dev solo si tout est retenu — d'où l'intérêt de piocher
vague par vague. La vague 1 seule transforme déjà la lecture.
