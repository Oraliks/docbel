# Règles des formulaires PDF — ce qui est commun à tous les documents

> À lire avant de reprendre, corriger ou ajouter un formulaire ONEM (C1, C1A,
> C1B, C1C, C46, C47, Annexe Regis, C1-Partenaire).
>
> Ce mémo consigne ce qui s'est révélé **identique d'un document à l'autre**
> pendant la refonte du C1 puis du C1A. Chaque document se traite un par un,
> mais les pièges, eux, se répètent. Rien ici n'est propre au C1A.

## Le chemin d'une réponse, de l'écran au papier

```
seed (lib/pdf-forms/seed/<doc>-fields.ts)   ← le schéma, source de vérité en CODE
        │  pnpm tsx scripts/apply-c1-improvements.ts --yes
        ▼
base de données (PdfFormRevision.fields, JSON)  ← ce que le runtime lit VRAIMENT
        ▼
public-serializer.ts  →  runner React  →  POST  →  validation Zod  →  filler.ts  →  PDF
```

**Le runner lit la base, pas le code.** Modifier un seed ne change rien à
l'écran tant que le script de re-semis n'a pas tourné. C'est la cause n°1 de
« j'ai corrigé mais je vois toujours l'ancien écran ».

`order` est sérialisé en JSON, pas dans une colonne `Int` : les ordres
fractionnaires (`54.5`) survivent et servent à insérer un champ entre deux
voisins.

## Les AcroForms de l'ONEM : trois pièges structurels

### 1. Un widget porte le nom du texte imprimé AU-DESSUS de lui

Pas celui de la donnée qu'il reçoit. La case nommée `Nom employeur` du C1A est
la ligne de l'**adresse**. Associer les champs aux widgets par ressemblance de
libellé décale donc tout d'une ligne, **en silence** : les tests qui vérifient
qu'un `pdfFieldName` existe ne voient rien.

Le garde-fou est `lib/pdf-forms/__tests__/widget-geometry.test.ts` : il compare
l'ordre déclaré des champs à la position réelle de leur case (page, colonne,
ordonnée). Il tourne sur **les 8 formulaires**. Les cinq documents non encore
réalignés (C1, Annexe Regis, C1-Partenaire, C1B, C46, C47) ont leurs écarts
consignés en dette dans `ECARTS_ASSUMES` — les traiter, c'est vider leur
entrée, jamais l'agrandir. Le C1A et le C1C ont la leur vide.

Avant de croire un écart, vérifier le **découpage en colonnes** : le seuil par
défaut (300 pt) suppose une mise en page à deux colonnes. Appliqué à un
document qui n'en a qu'une — le C1C, dont les 36 widgets vivent tous entre
x=211 et x=430 — il coupe l'unique colonne en son milieu et invente des écarts
là où l'ordre déclaré est juste. D'où `colonneX: null` sur la cible.

Corollaire : `order` doit suivre l'ordre de lecture du document. Une fabrique
qui numérote par sauts (`base + i * 10`) finit par **avaler ses voisines** —
c'est arrivé aux grilles horaires du C1A, dont la plage recouvrait neuf autres
questions. Une rubrique = un bloc d'`order` contigu.

### 2. Un champ AcroForm peut porter PLUSIEURS widgets

Ils partagent alors **une seule valeur** : écrire dans l'un remplit tous les
autres. Inutilisable dès que deux emplacements attendent des valeurs
différentes. Quatre cas sur le seul C1A (`TVA`, `Montant`, `voir 19`, `1_3`).

Vérifier avec `pypdf` (clé `/Kids`) avant de croire un audit de mapping. La
sortie est l'**écriture positionnelle** : `pdfFieldName: ""` + `drawAt: { page,
x, y, size, maxWidth }`, appliqué par `filler.ts`.

### 3. Une paire de cases oui/non est appariée PAR POSITION

`stampPipeRadio` (`filler.ts`) associe `options[i]` au i-ème segment de
`pdfFieldName` — **jamais par le sens**. Des options rangées `[oui, non]` sur un
widget `"non|oui"` cochent donc systématiquement l'inverse de la réponse. Le C1C
avait trois questions dans cet état, dont « une partie de mon activité est
exercée par des tiers », que le formulaire imprimé assortit d'un « votre demande
ne peut pas être acceptée si… ».

Rien ne le voyait : `publish-checks` compte les segments sans regarder leur
ordre, la géométrie s'ancre sur le premier segment, et les tests figeaient la
chaîne `pdfFieldName` sans jamais la confronter aux options.

**Règle : ranger les options dans l'ordre des cases IMPRIMÉES**, qui est souvent
« non » puis « oui » sur les formulaires ONEM. Un test d'alignement se pose en
quelques lignes quand les widgets se nomment d'après la réponse qu'ils portent
(`non_2`, `oui_3`, `oui www`) — cf. `c1c-fields.test.ts`.

## Visibilité : le tableau à connaître par cœur

| Mécanisme | À l'écran | Dans le PDF |
|---|---|---|
| `hidden: true` | jamais envoyé au client | **jamais tamponné** → case blanche |
| `visibleIf` non satisfait | absent des étapes | **jamais tamponné** |
| `autoAnswered: true` | jamais rendu, ni compté, ni exigé | **tamponné normalement** |
| `readOnly: true` | visible, verrouillé | tamponné normalement |
| `inheritedFromDossier` | masqué **seulement si** le dossier a fourni la valeur | tamponné normalement |

**Ne jamais masquer avec `hidden` un widget unique porteur de donnée.** Deux
champs du C1 (`adresse_email_facultatif`, `num_ro_de_t_l_phone_facultatif`) sont
encore dans cet état : leur case part blanche.

Pour « ce champ vient d'ailleurs, ne le demande pas » → `autoAnswered`, jamais
`hidden`.

Pour « ce champ vient du C1, mais le document peut aussi être rempli seul » →
`inheritedFromDossier` (`lib/pdf-forms/dossier-inheritance.ts`). **Les 7
compagnons sont `published`/`active` avec un `publicPath` : ils sont tous
atteignables hors dossier**, où rien n'est hérité. Un simple `autoAnswered` y
produirait une déclaration officielle sans nom.

## Héritage entre documents

Deux voies, fusionnées dans `app/document/[...path]/page.tsx` :

- **vocabulaire canonique** — `canonicalKey` sur le champ, liste fermée dans
  `lib/pdf-forms/canonical/vocabulary.ts`. C'est la voie à utiliser.
- `prefillFrom` — voie historique (profil utilisateur), conservée.

Le canonique prime. Un champ `type: "fullname"` hérite automatiquement de
`identity.prenom` + `identity.nom` sans porter de clé lui-même.

## Arbre de renvois → conditions d'affichage

Les formulaires ONEM impriment des renvois (« oui → voir 2 · non → voir 9 »).
Écrire les `visibleIf` à la main revient à se souvenir de toutes les
dépendances transitives, et c'est là que la main se trompe (le C1A accrochait
Q4 à Q1 en oubliant Q3).

Le patron du C1A, réutilisable tel quel :

1. recopier l'arbre **arête par arête** du PDF dans une `TableRoutage`
   (`seed/c1a-routing.ts`) — aucun enchaînement implicite ;
2. `compilerRoutage` (`lib/pdf-forms/routing.ts`, fonction pure, testée) en
   dérive les conditions, détecte cycles et renvois vers l'inconnu ;
3. une table `RATTACHEMENTS` dit quels champs suivent quelle question.

Règle d'application, apprise à la dure : un champ qui **est** une question voit
sa condition **remplacée** (l'arbre fait foi) ; un champ **rattaché** voit la
sienne **fusionnée** dans `and`. Sans cette distinction, on écrase les
conditions intra-question — les deux montants « par mois / par an » d'une même
question s'afficheraient ensemble.

## Découpage en étapes

`buildMacroSteps` (`lib/pdf-forms/build-steps.ts`) groupe par `stepGroup`, dans
l'ordre donné par `stepGroupOrder` de `form-presentation.ts`, et ne garde que
les groupes ayant **au moins un champ visible**. Une question sautée par l'arbre
ne produit donc aucune étape : le repli est automatique, il n'y a rien à coder.

Trois granularités possibles, du plus grossier au plus fin :

- une étape par **section** (`buildSteps`, repli par défaut) ;
- une étape par **macro-groupe** (5 étapes nommées — ce que fait le C1) ;
- une étape par **question** — poser `stepGroup` = l'identifiant de la question
  et `stepGroupOrder` = la liste ordonnée des questions (`C1A_QUESTIONS`). Sans
  clé i18n, le titre de l'étape devient la question elle-même ; `PdfField`
  accepte `hideLabel` pour ne pas l'afficher deux fois.

Choisir selon la longueur : un macro-groupe qui dépasse la dizaine de champs
donne une page interminable.

## Obligation de réponse

`buildValidator` **saute déjà les champs invisibles** : dès que les `visibleIf`
sont corrects, poser `required: true` suffit à rendre l'exigence propre à la
branche empruntée. Le blocage du bouton « Continuer » existe déjà côté runner
(`attemptAdvance`). Rien à recoder.

**Piège : ne jamais utiliser `requiredGroup` en dehors du C1.** Le runner
détecte ce marqueur *par la donnée* et bascule la section entière sur un
composant de rendu propre au C1 (`MotifSituationPicker`) — une grille horaire
deviendrait une liste de chips.

Cases à cocher : aucune raison qu'un lundi soit plus obligatoire qu'un mercredi.
Rendre obligatoire le **choix** qui commande la rubrique, pas les cases.

## Listes répétables

`type: "array"` (`itemFields`, `addRowLabel`, `minRows`, `maxRows`), rendu par
`components/pdf-forms/array-field.tsx`. Tamponnage par `pdfFieldNameTemplate`
(`{index}` en base 1) ou `firstMatchMapping` pour un widget unique.

À préférer dès qu'un document offre N lignes numérotées identiques
(`truc1`…`truc5`) : afficher cinq champs vides est un défaut d'écran, pas une
fidélité au papier. Plafonner `maxRows` au nombre de lignes réellement
imprimées — une 6ᵉ ligne saisie ne s'imprimerait nulle part.

`required` sur une liste signifie « au moins une ligne réellement remplie » :
une ligne vierge fraîchement ajoutée ne compte pas.

## Validation des types belges

`lib/pdf-forms/validators.ts`. Le patron à suivre est le **diagnostic par
cause**, pas le booléen : `diagnoseNISS`, `diagnoseBCE` distinguent longueur,
valeur impossible et somme de contrôle, et chaque cause a son message. Un
message qui parle de longueur alors que la longueur est bonne fait tourner
l'utilisateur en rond.

BCE/TVA partagent le même validateur : 10 chiffres, **premier chiffre 0 ou 1**,
somme de contrôle modulo 97.

Le NISS distingue erreur bloquante et **avertissement** non bloquant (somme de
contrôle seule) — « informatif jamais bloquant ».

## Textes affichés

**Aucun texte réglementaire inventé.** Tout libellé, toute aide est recopié du
PDF officiel (`private/pdfs/<DOC>_FR.pdf`). Extraction :

```bash
python -m markitdown private/pdfs/C1A_FR.pdf -o /tmp/c1a.md
```

L'extraction entrelace les deux colonnes : désentrelacer à la main avant de
recopier. En cas de doute sur une formulation métier, demander — ne pas rédiger.

## Checklist pour un document repris

1. Lancer le test de géométrie et vider l'entrée du document dans `ECARTS_ASSUMES`.
2. Chercher les champs AcroForm multi-widgets (`/Kids`) → écriture positionnelle.
3. Vérifier qu'aucune rubrique n'avale la plage d'`order` de sa voisine.
4. Recopier l'arbre des renvois imprimés → conditions dérivées.
5. Marquer `inheritedFromDossier` ce qui vient du C1.
6. Choisir la granularité d'étapes selon la longueur des groupes.
7. Poser `required` sur les questions ; jamais `requiredGroup`.
8. Convertir les séries de N lignes identiques en listes.
9. Re-semer, puis **relire un PDF généré case par case** — aucun test ne
   certifie qu'une déclaration officielle est correcte.

## Validation

```bash
pnpm test          # vitest
pnpm build         # build + typecheck (il n'existe pas de "pnpm typecheck")
pnpm lint          # ~124 erreurs préexistantes : ne pas en ajouter
pnpm i18n:check    # ICU + couverture des langues
```
