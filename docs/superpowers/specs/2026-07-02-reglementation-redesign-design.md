# Spec — Refonte design/structure « Réglementation chômage » (RioLex)

- **Date :** 2026-07-02
- **Statut :** design validé (mockup approuvé par Oraliks + décisions ci-dessous) — à relire avant plan
- **Sujet :** refondre les deux écrans partenaire du corpus légal RioLex — la **liste de
  recherche** (`/partenaire/reglementation`) et la **fiche article**
  (`/partenaire/reglementation/[riolexId]`) — actuellement « trop de texte brut ».
- **Base :** mockup fourni par Oraliks (2 écrans côte à côte) + architecture A validée
  (fiche en 2 colonnes avec panneau latéral collant).

---

## 1. Contexte & problème

Le corpus (443 articles, cf. [`project-riolex-corpus`]) est fonctionnel mais peu lisible :
- **Liste** : cartes visuellement identiques, aucun repère rapide (nature juridique, statut).
- **Fiche** : texte de loi + commentaire ONEM balancés en `whitespace-pre-wrap` (un seul bloc),
  métadonnées reléguées tout en bas → on scrolle un mur avant de voir la date d'entrée en vigueur.

On **ne touche pas** au backend de recherche (API hybride FTS+sémantique, gating `visibility`) ni à
l'ingestion. Refonte **présentation + structure** uniquement, + un **parseur de texte légal** (pur).

## 2. Décisions (validées)

- **Deux pages séparées** conservées (pas de split master-détail) ; chacune en **pleine largeur**
  (retrait des `max-w-5xl/4xl` → conforme DESIGN_RULES pro : « admin/pro = pleine largeur »).
- **Actions fiche V1 = Imprimer uniquement.** Favori et Exporter (PDF) = **backlog** (nouvelles
  fonctionnalités backend, hors refonte). On n'affiche PAS de boutons morts pour elles.
- **Réconciliations données réelles** (le mockup est illustratif) :
  - Natures réelles = **AR / AM / Loi-programme / Loi / Arrêté-loi** (pas de « Circulaire »).
    Légende + icônes + couleurs mappées sur ces 5 natures.
  - Pas de champ « thème » riche → le badge « thème » du mockup est remplacé par le **texte de loi**
    (badge `loi`) ; pas de thème inventé.
  - Stats d'en-tête : **443 articles** (partner, tags RioLex) · **6 lois** · « recherche hybride ».

## 3. Système visuel

- **Espace partenaire = shadcn/ProShell** (PAS de glass) : violet `#5B46E5`, carte `#FAF7FF`,
  radius `.875rem`, ombres douces. Dark = shadcn slate (pas le néon public).
- **Pleine largeur** : conteneur `px-4 py-6 lg:px-6` sans `max-w-*` étroit sur la racine.
  Exception lisibilité : la **colonne de texte de loi** plafonne la longueur de ligne (~72ch)
  même en grand écran (un texte légal sur 1400px est illisible) ; la colonne latérale occupe le
  reste à droite.
- **Couleurs par nature** (pastille d'icône + liseré gauche de carte) :
  AR = indigo, AM = ambre, Loi-programme = violet, Loi = bleu, Arrêté-loi = ardoise (valeurs à
  aligner sur les tokens `--chart-*`/`--primary`, pas de hex criard en dur).
- **Statut** : « en vigueur » = vert (point + label), « abrogé » = rouge/gris (badge `destructive`).

## 4. Écran 1 — Liste de recherche (pleine largeur)

1. **Bandeau stats** (3 cartes) : `443 articles` · `6 lois` · `Recherche full-text + sémantique`
   (sous-texte « synonymes, concepts, contextes »). Compteurs = totaux corpus (voir §6 API).
2. **Barre de recherche** (input + icône loupe + clear) — débounce (existant).
3. **Filtres** : `nature` (5 + Tous), `loi` (facettes renvoyées par l'API + Tous), `statut`
   (en vigueur / abrogé / Tous), **tri** (pertinence / n° d'article), **Réinitialiser**.
   *(« + Plus de filtres » du mockup : hors V1 — on s'en tient à ces filtres.)*
4. **Résultats** : liste plate (pas de regroupement). Carte redessinée :
   - liseré gauche + **pastille d'icône** colorés par nature ;
   - titre (lien fiche) ; badges `loi` + `Art. N` ;
   - **badge statut** (vert en vigueur / rouge abrogé) + date (EV) en haut à droite ;
   - **extrait surligné** (`headline` `ts_headline`, `<mark>` reconstruits en JSX — jamais
     `dangerouslySetInnerHTML`) ;
   - lien externe **RioLex**.
   *(Vue grille du mockup : hors V1 — faible valeur pour du texte légal ; liste seulement.)*
5. **Pagination** + sélecteur « N / page » (existant).
6. **Légende** en bas : 5 natures (icône+libellé) + 2 statuts (points).

## 5. Écran 2 — Fiche article (pleine largeur, 2 colonnes)

- **Fil d'Ariane** (Réglementation › `<loi>` › `Art. N`) + bouton **« Retour aux résultats »**.
- **Titre** + badges (nature, statut). **Barre d'actions** : **Imprimer** (+ lien RioLex).
- **Grille `lg:grid-cols-[minmax(0,1fr)_320px]`** (2 colonnes ≥ lg ; empilé < lg) :
  - **Colonne principale** (largeur de lecture plafonnée ~72ch) :
    1. **Texte de loi structuré** via le parseur (§6) : paragraphes `§`, alinéas `1°/2°`, listes
       à tirets, mentions `[Abrogé]` stylées. Typographie soignée (interligne, espacements).
    2. **Références légales** (inline) : liste des `legalMeta.refs` détectées.
    3. **Commentaire ONEM** (admin only) : section repliée par défaut. Le commentaire est
       **découpé en blocs « Commentaire N »** (date/institution en badge) rendus en **accordéon** ;
       en-tête « N commentaires ONEM · réservé admin » (cadenas). Si non-admin : rien (ou mention
       « réservé »).
  - **Colonne latérale collante** (`sticky top-…`, masquée en flux normal sous le texte < lg) :
    - **Informations** : statut, entrée en vigueur, date de publication, date Moniteur, nature.
    - **Références** : versions cliquables + « Voir toutes (N) » (renvois internes → autres fiches).
    - **Voir aussi** : article précédent / suivant (tri naturel du même texte de loi) + voisins.
    - **Lien externe** : RioLex + attribution (source + date de consultation) + phrase de prudence.
- Le mockup montre des **onglets** (Texte/Références/Commentaire) : implémentés comme une **barre
  d'ancres** (scroll-to section) et non des vrais tabs — évite de cacher du contenu et la
  redondance avec la sidebar. *(Simple polish ; peut être retiré si superflu.)*

## 6. Parseur de texte légal (seul ajout de logique) + API

- **`lib/reglementation/parse-legal-text.ts`** (pur, testé) : `parseLegalText(raw): Block[]`
  où `Block` = `{ type: "paragraph"|"section"|"list-item"|"abroge"|"note", marker?, text }`.
  Détecte `§ 1er.`, `1°/2°`, tirets `- … ;`, `[Abrogé …]`, renvois `(Loi … - MB … - EV …)`.
  Idempotent, tolérant (jamais d'exception → au pire un seul bloc « paragraph »).
  Réutilisé aussi pour découper le commentaire ONEM en « Commentaire N » (fonction sœur
  `splitOnemCommentary(raw): CommentBlock[]`).
- **API** (`/api/partenaire/reglementation/search`) : ajout léger d'un **compteur corpus** pour
  le bandeau stats (`totalCorpus`, `loiCount`) — soit dans la réponse `mode:"liste"`, soit une
  petite route `.../stats`. Le reste (résultats, facettes `lois`, `headline`) est inchangé.
  Gating `visibility` inchangé.

## 7. Composants (nouveaux, sous `components/reglementation/`)

- `search-client.tsx` (réécrit) — bandeau stats, filtres, cartes, légende.
- `result-card.tsx` — carte de résultat (pastille nature, badges, extrait surligné).
- `nature-badge.tsx` / `nature.ts` — mapping nature → icône + couleur + libellé (source unique,
  réutilisée liste + fiche + légende).
- `legal-text.tsx` — rend les `Block[]` du parseur.
- `onem-commentary.tsx` — accordéon des blocs de commentaire (admin only).
- `article-sidebar.tsx` — panneau latéral collant (Informations / Références / Voir aussi / lien).
- La page fiche (`[riolexId]/page.tsx`, serveur) charge les données (inchangé) + compose ces
  composants ; le parsing se fait côté serveur (RSC) pour un HTML déjà structuré.

## 8. Tests & garde-fous

- **Tests unitaires** du parseur (`parse-legal-text`, `splitOnemCommentary`) sur des échantillons
  figés (art. court, art. avec §/alinéas, art. abrogé, commentaire multi-blocs).
- **QA preview** (session admin) : liste (cartes, filtres, légende, surlignage), fiche (2 colonnes,
  sidebar sticky, texte structuré, accordéon commentaire), impression, **mobile** (empilement),
  **gating** rejoué (anonyme → 401/404).
- `pnpm build` vert, `tsc` 0 erreur, `eslint` clean sur les nouveaux fichiers, `i18n:check` OK.
- Aucune régression du backend de recherche/gating.

## 9. i18n

Nouvelles clés `public.pro.regl*` (fr/nl/en ; autres locales = fallback FR) pour : libellés stats,
filtres, tri, légende (natures + statuts), sections fiche (Informations, Références, Voir aussi,
Commentaire ONEM, Imprimer), attribution, prudence.

## 10. Hors périmètre (backlog)

- **Favori** (enregistrer un article) : table DB + API par utilisateur.
- **Exporter** (PDF de l'article).
- **Vue grille** de la liste ; **« + Plus de filtres »** (thème/tags, plage de dates).
- Amélioration du **ranking** (art. 79 ALE trop haut) — suivi séparé.

## 11. Découpage / ordre

1. `nature.ts` + parseur (`parse-legal-text` + `splitOnemCommentary`) + tests.
2. API : compteurs corpus (stats).
3. Liste : `result-card` + `search-client` réécrit + légende + pleine largeur.
4. Fiche : `legal-text`, `onem-commentary`, `article-sidebar` + page réécrite (2 col, sticky,
   Imprimer + print CSS).
5. i18n + QA preview (desktop/mobile) + build.

Chaque étape livrable/committable ; QA visuelle finale avec Oraliks.
