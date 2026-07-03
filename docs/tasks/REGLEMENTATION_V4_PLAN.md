# Plan Réglementation V4 — « lecture augmentée & outils du conseiller »

> **Statut : proposition à valider par Oraliks** (2026-07-03). Rien n'est codé.
> Suite de [REGLEMENTATION_V3_PLAN.md](REGLEMENTATION_V3_PLAN.md) (vagues 1-5 livrées).
> 16 fonctionnalités choisies par Oraliks, groupées en 5 vagues (V6-V10).
> Périmètre : **réglementation uniquement**, **sans IA**, dev solo.

## Hypothèses vérifiées contre les données réelles (staging + import)
- **Définitions** : 47 articles définissent des termes ; sources globales = **AR art. 1, AR art. 27, AM art. 1** (format « N° terme : définition », déjà typé par le parseur). ✓ dérivable.
- **Structure Titre/Chapitre/Section** : **absente des données** (import à plat, aucun champ, 1 seule mention « Section » dans un texte). → #7 à recadrer (curation ou re-capture).
- **Fraîcheur** : `validityStatus`/`lastValidatedAt` **non peuplés** (sauf `obsolete` si abrogé). → #19 recadré en « dernière EV réelle » (dérivée des amendements, zéro DB).
- **Réforme 2026** : passages modifiés présents dans les crochets `[… (Loi-programme 18.7.2025 …)]`. ✓ extractibles (fallback sur crochets déséquilibrés).
- **Renvois AM→AR** : de nombreux articles AM citent « l'article N de l'arrêté royal » → mappage AR↔AM dérivable du résolveur existant (`resolve-ref`).

---

## Vague 6 — Lecture augmentée du texte (client / parseur, ~4-6 j)

| # | Fonctionnalité | Effort | Détail & données |
|---|---|---|---|
| 1 | **Glossaire au survol** ⭐ | 2-3 j | Extraire un glossaire des articles de définition (AR art.1/27, AM art.1) via le parseur (items `N° terme : def`) → `lib/reglementation/glossary.ts` (pur, mémoïsé). Détecter les termes dans le texte affiché et les souligner en pointillé → tooltip base-ui avec la définition + lien vers l'article source. Cap sur les termes « forts » (≥ 4 lettres, éviter le bruit). Pur, sans IA. |
| 2 | **Numérotation des alinéas en marge** | 1 j | Le parseur groupe déjà les blocs ; numéroter les alinéas dans la portée de chaque § (al. 1, al. 2…) et les afficher en gouttière discrète, avec ancre + copie (comme les §). Extension de `legal-text.tsx` + `parse-legal-text.ts`. |
| 5 | **Légende des conventions** | 0,5 j | Bloc repliable (Collapsible existant) décodant §, 1°, a), –, bis/ter, « al. » pour les non-juristes. Statique, en pied de fiche. |
| 6 | **Sommaire flottant des §** ⭐ | 1-1,5 j | Pour les articles > 4 §, une mini-TOC collante (dans la sidebar existante) listant les § avec scroll-spy (IntersectionObserver) + saut. Réutilise les ancres `par-N` déjà posées. |

## Vague 7 — Structurer & relier (~4-6 j)

| # | Fonctionnalité | Effort | Détail & données |
|---|---|---|---|
| 7 | **Structure de la loi** ⚠️ | — | **Donnée absente** : ni Titre, ni Chapitre, ni Section dans le corpus. Deux options à trancher : (a) **curer** un sommaire hiérarchique par loi (fichier JSON maintenu à la main, ~quelques heures par loi) ; (b) **re-capturer** la table des matières depuis RioLex (manuel, hors code). Recommandation : **différer**, ou faire (a) pour la seule AR 25/11/1991 (304 art.) si le besoin est fort. Ne PAS prétendre le dériver. |
| 8 | **Paires AR ↔ AM auto-suggérées** | 2-3 j | Dériver du graphe de renvois : les articles AM citant « l'article N de l'arrêté royal » donnent AM→AR (exécution) ; inverser pour AR→AM. `lib/reglementation/ar-am-map.ts` (réutilise `resolve-ref` + pattern `backlinks`, mémoïsé). Carte « Article correspondant » dans la sidebar. |
| 9 | **Parcours thématiques guidés** | 1,5-2 j | Séquences curées (`lib/reglementation/parcours.ts`, ~8-10 parcours : admissibilité, sanctions, AGR, dispenses…) reliant des articles dans l'ordre. Composant « fil de lecture » avec étape courante + suivant. Réutilise les thèmes de la V3. |
| 20 | **Graphe de citations visuel** | 2-3 j | Petite carte interactive (SVG maison, pas de dépendance lourde) des renvois autour de l'article courant (voisins entrants/sortants du graphe `backlinks` déjà calculé). Clic = navigation. Fallback liste si trop de nœuds. |

## Vague 8 — Chercher plus finement (~3-4 j)

| # | Fonctionnalité | Effort | Détail & données |
|---|---|---|---|
| 10 | **Recherche dans l'article** | 1 j | Ctrl+F local (client) : champ de recherche scoped au texte de la fiche, surligne + compte + saute entre occurrences (n/N). Composant `in-article-find.tsx`. |
| 11 | **Opérateurs de recherche avancée** | 1-1,5 j | `websearch_to_tsquery` gère **déjà** phrase exacte (`"..."`) et exclusion (`-mot`) : exposer via une aide + une bascule « titre seulement » (WHERE sur `title`) et « n° d'article seul ». Surtout de l'UI + doc. |
| 13 | **Filtre « modifiés depuis… »** ⭐ | 1,5 j | Extraire la dernière EV par article (runtime, cache module comme `backlinks`) → filtre/tri « modifiés depuis [date] » dans la recherche + tri « plus récemment modifiés ». Réutilise `parse-amendments`. |

## Vague 9 — Outils du conseiller (~4-6 j)

| # | Fonctionnalité | Effort | Détail & données |
|---|---|---|---|
| 14 | **Notes & surlignages personnels** | 2-3 j | V1 : **note libre par article** en localStorage (comme les épingles), affichée sur la fiche + indicateur « note » sur les cartes. V2 (stretch) : surlignage de passages (ancrage par offset de texte, fragile → à cadrer). Choix à faire : localStorage (simple, par poste) vs table DB (cross-device → **migration additive à valider**). |
| 15 | **Dossiers de travail** | 2 j | Regrouper des articles dans un dossier nommé par cas (au-delà des épingles). localStorage (`regl:dossiers`), vue dédiée + **impression/export groupés** de tous les articles d'un dossier. |
| 17 | **Signaler une erreur** ⚠️DB | 2 j | Bouton « signaler un problème » sur la fiche → **nouvelle table `ArticleReport`** (riolexId, type, message, statut) alimentant le tableau *Santé du corpus*. Nécessite une **migration additive** (SQL via `db execute`, à faire sous ta supervision — base Neon partagée). |

## Vague 10 — Confiance & réforme (~2-4 j)

| # | Fonctionnalité | Effort | Détail & données |
|---|---|---|---|
| 18 | **Explorateur « Réforme 2026 »** ⭐ | 2 j | Page dédiée `/partenaire/reglementation/reforme-2026` listant les ~107 articles touchés, groupés par loi, avec les **passages insérés surlignés** (crochets tagués `Loi-programme 18.7.2025`, extraits par regex ; fallback « voir l'article » si crochet déséquilibré). Va au-delà du badge/filtre déjà livré. |
| 19 | **Badge de fraîcheur** ⭐ | 0,5-1 j | Recadré : « À jour au [dernière EV] » dérivé des amendements (pas des champs DB non peuplés) ; « texte de base » si aucune modif. Petit badge sur la fiche + option de tri. Quasi gratuit (réutilise `latestEV`). |

---

## Faisabilité — synthèse
- **Client pur / dérivé runtime, zéro écriture DB** : 1, 2, 5, 6, 8, 9, 10, 11, 13, 15, 18, 19, 20.
- **localStorage (par poste)** : 14 (V1), 15.
- **Nécessite une migration additive (supervision)** : 17 ; option cross-device de 14.
- **Donnée manquante (à trancher)** : 7 (curation ou différé).

## Ordre recommandé
1. **Vague 6** d'abord (lecture — c'est le cœur, très visible, quasi tout client/parseur).
2. Glisser **#19** (fraîcheur, ~0,5 j) et **#13** (modifiés depuis) tôt : petit effort, gros signal.
3. **#18** (explorateur réforme) : LE sujet 2026, autonome.
4. Puis Vague 7 (relier) → Vague 8 (chercher) → Vague 9 (outils, avec la décision localStorage vs DB pour #14/#17).
5. **#7** : décider avec toi (curer AR 25/11/1991 ou différer) — ne pas l'improviser.

**Total indicatif : ~17-26 j** de dev solo si tout est retenu. Lots de 3-5 fichiers, `pnpm test` (parseurs purs) + build + écran par lot, comme la V3.

## Décisions qui te reviennent
- **#7** : curer un sommaire (au moins l'AR 25/11/1991) ou différer ?
- **#14** : notes en localStorage (par poste, simple) ou en base (cross-device, migration) ?
- **#17** : OK pour une migration additive `ArticleReport` (sous ta supervision) ?
- **#18** : surligner les passages insérés dans le texte, ou juste lister « ce qui a changé » avec lien ?
