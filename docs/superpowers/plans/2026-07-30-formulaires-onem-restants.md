# Plan — C1B, C46, C47, C1-Partenaire

> Écrit le 2026-07-30, après le C1, le C1A et le C1C. **Le diagnostic ci-dessous
> a déjà été fait** : ne pas le refaire, l'exécuter.
>
> À lire avant : `docs/context/PDF_FORMS_RULES.md` (les pièges communs).

## Ce qui est acquis et qu'il ne faut pas réinventer

Trois formulaires sont passés. Ce qu'ils ont laissé derrière eux :

| Outil | Ce qu'il fait |
|---|---|
| `scripts/gen-c1c-scenarios.ts` | jeu de PDF remplis couvrant toutes les branches — **à dupliquer par formulaire** |
| `scripts/verif-couverture-widgets.py` | prouve que chaque widget a reçu quelque chose (générique, prend le dossier en argument) |
| `lib/pdf-forms/__tests__/widget-geometry.test.ts` | compare l'ordre déclaré à la position réelle des cases ; dette par formulaire dans `ECARTS_ASSUMES` |
| `lib/pdf-forms/seed/__tests__/seeds-vs-pdf.test.ts` | orphelins et conflits de mapping |
| `alignTextToGuide` | pose le texte sur les pointillés au lieu de le centrer dans la case |
| `form-presentation.ts` (entrée `c1a`) | le gabarit du parcours : une question = une étape |
| `dossier-inheritance.ts` | `inheritedFromDossier` — ne jamais redemander ce que le C1 a donné |

**La règle d'or du chantier :** ce qui reste à faire sur un formulaire, c'est
presque toujours le **runner**, pas le mapping. Vérifier avant de supposer.

## Diagnostic — état réel des quatre formulaires

Mesuré le 2026-07-30 sur les PDF réels et les seeds courants.

| | C1B | C46 | C47 | C1-Partenaire |
|---|---|---|---|---|
| widgets / champs | 51 / 39 | 13 / 14 | 11 / 13 | 23 / 17 |
| orphelins · conflits | 0 · 0 | 0 · 0 | 0 · 0 | 0 · 0 |
| radios pipe **inversées** | **0** / 11 | — | — | **0** / 6 |
| champs multi-widgets à risque | **1 (4 cases)** | **1 (3 cases)** | 0 (1 bénin) | **1 (2 cases)** |
| écarts de géométrie assumés | 1 | 2 | 1 | 3 |
| champs groupés (parcours) | **0 / 39** | **0 / 14** | **0 / 13** | **0 / 17** |
| champs hérités du dossier | **0** (7 d'identité) | **0** (2) | **0** (4) | **0** (5) |
| bas de case vs pointillés (médiane) | +0,85 pt | +1,02 pt | +0,04 pt | +1,20 pt |

### Deux bonnes nouvelles

1. **Aucune radio inversée.** Le défaut le plus grave du C1C (la case cochée
   était l'inverse de la réponse) est absent ici : les 17 radios pipe des deux
   formulaires concernés ont été relues une par une, chaque nom de case
   correspond bien à l'option de même rang.
2. **Aucun orphelin, aucun conflit.** La couverture du mapping est bonne
   partout. ⚠ Attention : la couverture ne dit **rien** de la justesse — le C1C
   avait 0 orphelin ET trois radios fausses. C'est la géométrie qui tranche.

### Le défaut commun, confirmé : un champ, plusieurs cases, une seule valeur

Même piège que `TVA` / `Montant` / `1_3` du C1A et `Nom de lentreprise` du C1C.
Vérifié case par case sur le papier :

**C1B — `Date46_af_date`, QUATRE cases pour quatre dates différentes :**

| page/y | ligne imprimée |
|---|---|
| p0 y=696 | bloc d'en-tête (déclaration de revenu) |
| p0 y=448 | « rue numéro **A partir du** » |
| p0 y=210 | « **oui, du** » (début de période de pension) |
| p0 y=194 | « **au** » (fin de la même période) |

Aujourd'hui, remplir l'une remplit les quatre : le « du » et le « au » d'une
même période sortent identiques. C'est le défaut le plus visible des quatre
formulaires.

**C46 — `Date39_af_date`, TROIS cases « Moniteur Belge du __ »** (une par
nomination). Les trois nominations reçoivent la même date.

**C1-Partenaire — `Montant mensuel brut`, DEUX cases :** le montant de
l'« activité professionnelle » et celui du « revenu de remplacement ». Le doute
était déjà consigné en commentaire dans le seed — il est confirmé.

**C47 :** son seul champ multi-widgets est une **case à cocher** (`/Btn`) à deux
widgets. Deux cases partageant un état est souvent voulu (même affirmation
imprimée deux fois). À confirmer d'un coup d'œil, sans a priori de défaut.

### Le vrai gros morceau : le parcours

**Les quatre formulaires sont à 0 champ groupé et 0 champ hérité.** Ils
affichent donc une étape par section, et redemandent l'identité que le C1 a déjà
donnée. C'est le plus gros gain pour le citoyen, et le moins risqué à livrer.

## Le lot type, par formulaire

Cinq étapes, dans cet ordre. Ne pas en sauter, ne pas les fusionner.

1. **Réparer les multi-widgets** (sauf C47). Écriture positionnelle : le champ
   passe à `pdfFieldName: ""` + `drawAt` mesuré à pdfplumber, un champ distinct
   par emplacement. Ne JAMAIS retaper un nom de widget — le copier depuis
   `pnpm tsx scripts/dump-pdf-widgets.ts <DOC>`.
2. **Vider l'entrée du formulaire dans `ECARTS_ASSUMES`** et faire passer le
   test de géométrie. Une entrée est une dette : la vider, jamais l'agrandir.
   Attention au découpage en colonnes — pour un formulaire mono-colonne le
   séparateur à x=300 coupe la colonne de contenu en deux et produit de faux
   écarts (c'est ce qui s'est passé sur le C1C).
3. **Le parcours** : `stepGroup` par question + liste ordonnée exportée,
   `inheritedFromDossier` sur l'identité, entrée dans `form-presentation.ts`
   avec `hideStepList: true` et aucune clé i18n. Copier l'entrée `c1c`.
4. **`alignTextToGuide`** sur les champs posés sur une ligne pointillée — mais
   **seulement après avoir relu un PDF généré** : la médiane mesurée n'est ~0
   que sur le C47 (+0,04). Sur le C1B, le C46 et le C1-Partenaire elle vaut
   +0,85 à +1,20 pt, donc la relation « bas de case = ligne imprimée » n'est
   PAS exactement celle du C1C et le calage devra être vérifié, pas recopié.
5. **La recette** : dupliquer `gen-c1c-scenarios.ts`, écrire les scénarios qui
   couvrent toutes les branches, viser **100 % des widgets** avec
   `verif-couverture-widgets.py`, et **relire un PDF généré case par case**.
   Aucun test ne certifie qu'une déclaration officielle est correcte.

Puis : re-semis par Oraliks (`pnpm tsx scripts/apply-c1-improvements.ts --yes`),
sans lequel l'écran ne bouge pas.

## Ordre proposé

1. **C47** (11 widgets) — le plus petit, aucun multi-widget à réparer, et sa
   géométrie est déjà calée sur les pointillés. Sert de galop d'essai pour les
   étapes 3 à 5 seules.
2. **C1-Partenaire** (23) — un seul multi-widget, doute déjà documenté.
3. **C46** (13) — trois dates « Moniteur Belge » à séparer ; peu de champs.
4. **C1B** (51) — le plus gros, et le multi-widget à quatre cases. À faire en
   dernier, quand le geste est rodé.

Un formulaire par session. Ne pas en enchaîner deux : la relecture case par case
du PDF est ce qui prend le temps, et c'est elle qui attrape ce que les tests ne
voient pas.

## Décisions qui reviennent à Oraliks

- **C1B, date d'en-tête (p0 y=696)** : à quoi correspond-elle exactement ? Les
  trois autres cases de `Date46_af_date` sont claires, celle-là non.
- **C47, la case à deux widgets** : partage voulu ou défaut ?
- **C1-Partenaire** : les deux montants mensuels bruts sont-ils bien deux
  montants distincts (activité / revenu de remplacement) ?
- **Annexe Regis** n'est pas dans ce plan (hors demande). Elle reste la plus
  lourde en dette de géométrie : **14 écarts assumés**, contre 1 à 3 ici.

## Validation, à chaque lot

```bash
pnpm test          # vitest
pnpm build         # build + typecheck (il n'existe pas de "pnpm typecheck")
pnpm lint          # ne pas ajouter d'erreur aux préexistantes
```

Plus, propre à ce chantier : le jeu de scénarios du formulaire et
`python scripts/verif-couverture-widgets.py <dossier>` à 100 %.
