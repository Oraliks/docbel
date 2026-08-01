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
ordonnée). Il tourne sur **les 8 formulaires**. Deux documents ne sont pas encore
réalignés (C1, Annexe Regis) et gardent leurs écarts en dette dans
`ECARTS_ASSUMES` — les traiter, c'est vider leur entrée, jamais l'agrandir. Le
C1A, le C1C, le C47, le C1-Partenaire et le C46 ont la leur vide ; le C1B n'y
garde qu'une ligne, et **ce n'est pas une dette de mapping** : son champ `NISS`
porte deux widgets (page 1 + rappel d'en-tête page 2), et le parser ne retient
qu'un rectangle par nom de champ — celui de la page 2. Le test croit donc que
le NISS se lit après le nom.

Le C46 est le cas d'école de ce décalage : ses widgets « Moniteur Belge du » et
« Moniteur Belge du_2 » sont en réalité les 2ᵉ et 3ᵉ lignes d'**organisme**, et
le champ nommé `Date39_af_date` — que son libellé disait « date de
signature » — porte les trois guides de date du haut de la page 1. Le schéma
écrivait donc une date sur des lignes de nom, la date du jour dans les trois
guides à la fois, et laissait blanche la vraie case de signature de la page 2.
**Une entrée d'`ECARTS_ASSUMES` n'est pas un détail d'ordre : c'est souvent le
seul symptôme visible d'un mapping faux.**

⚠ Un découpage en colonnes mal réglé ne fait pas qu'inventer de faux écarts :
il en **cache de vrais**. Sur le C1-Partenaire, la date d'en-tête (x=338,
y=743) était déclarée après l'identité (y=532) ; le seuil de 300 pt la classait
« colonne suivante », donc « ordre normal ». Trois faux écarts consignés en
dette, et le seul vrai invisible.

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

⚠ **Un audit de couverture ne voit pas ce piège.** Le C47 avait 0 orphelin, 0
conflit — et son champ « jeune travailleur » portait deux widgets posés dans
les deux cadres OPPOSÉS du formulaire : cocher l'un cochait « je demande la
fixation du montant (art. 114) » dans l'autre cadre. Le nom hiérarchique
n'aide pas : les points d'un libellé (« art. 36/3, § 2, AR 25.11.1991 »)
découpent le champ en pseudo-niveaux, et seul le `/Kids` du nœud TERMINAL dit
combien de cases il porte. Compter les widgets, pas les champs.

### 2 bis. Cocher une case en positionnel : dessiner APRÈS `flatten`

Une case à cocher n'a pas d'équivalent de `drawAt` (la boucle positionnelle
dessine du texte : un booléen y sortirait « true »). La voie est une **clé
sentinelle** dans `POSITIONAL_EXTRA_STAMPS` (`filler.ts`) + une règle serveur
qui émet `"X"`, comme les trois cases du C47.

Et il faut **différer le dessin après `form.flatten()`**. `flatten` recopie sur
la page l'apparence de chaque widget, par-dessus tout ce qui y a déjà été
dessiné ; or l'apparence « décochée » d'une case ONEM commence par
`1 g / 0 0 6.7 6.7 re / f` — un **carré blanc opaque**. Une croix posée avant
disparaît donc sans le moindre signal : le caractère est bien dans le PDF (les
sondes d'encre, dont `verif-couverture-widgets.py`, le comptent « servi »), il
est simplement recouvert. Seule la relecture visuelle l'attrape — et
`c47-cases-demande.test.ts` désormais.

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

## Peignes imprimés : mesurer le calage, ne jamais le déduire

Dès qu'un guide est dessiné en cases (`__ __ / __ __`, ou onze tirets pour un
NISS), y écrire la valeur d'un bloc superpose deux jeux de séparateurs.
`printAsComb` répartit un caractère par case — mais son `baselineY` **se
mesure**. Le déduire du jambage supposé de la police se trompe : sur le
C1-Partenaire, le guide NISS est en glyphes SymbolMT U+F8E7 (invisibles à une
recherche de « _ » ou de « . »), et deux valeurs calculées ont échoué avant la
bonne — l'une laissait les chiffres flotter au-dessus du trait, l'autre le
faisait passer en plein milieu. La mesure qui tranche tient en trois lignes :

```python
crop = page.crop((x0, haut, x0 + largeur, bas))          # un seul tiret
im = crop.to_image(resolution=800).original.convert("L")  # puis chercher les
                                                          # lignes de pixels sombres
```

Relation constatée sur les trois formulaires repris (C1C, C47, C1-Partenaire) :
**le bas du rectangle du widget tombe sur le trait imprimé**. C'est un point de
départ, pas une loi — le C47 avait +1,2 sur son NISS.

Deux pièges de plus, vus sur le C47 : un guide peut être **faux** (trois cases
pour une année de quatre chiffres — le peigne doit alors être resserré, et la
décision écrite dans le seed), et un champ qui accepte **deux formats** (« NISS
ou date de naissance ») ne doit pas recevoir de peigne du tout.

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

## Texte coupé au plancher de réduction

`fitFontSize` ne descend pas sous 5 pt. Au plancher, un texte trop long RESTE
trop long, et pdf-lib le coupe en plein glyphe à la limite du rectangle : la
valeur est bien dans le PDF (les sondes de champ la lisent), elle n'est
simplement pas LISIBLE. Vu sur le C1B, où la description « autre, à savoir »
d'une annexe s'arrêtait sur « 12 janvier 20 ».

Le filler émet désormais un diagnostic `caracteres-non-rendus` dans ce cas
(cf. `depasse`). **Deux tests figeaient au contraire ce silence** en attendant
`diagnostics === []` sur des valeurs qu'ils décrivaient eux-mêmes comme
débordantes : une promesse tenue par le commentaire, jamais par le code.

## Taille de police : un widget sans `/DA` s'imprime à la mauvaise taille

`pdf-lib` refuse `setFontSize` sur un champ dépourvu de `/DA` propre, alors que
l'AcroForm en porte un GLOBAL dont la spec dit qu'il s'hérite. L'échec était
avalé, et `updateAppearances` retombait sur l'auto-dimensionnement : sur le
C46, « Commission du travail des arts » sortait en **5 pt** entre deux voisins
en 10 pt, dans la même rubrique. Quatre widgets de la famille sont dans ce cas,
un par document (C1, C1C, C46, C1-Partenaire).

`appliquerTaillePolice` (`filler.ts`) pose le `/DA` manquant puis réessaie —
rien à faire dans les seeds. Le repérage, si le cas se représente sur un
nouveau document : chercher les champs `/FT /Tx` **sans `/DA` propre** (pypdf),
pas les champs sans `/DA` hérité.

## Un seul signataire par formulaire

`resolveSignerName` (`signature.ts`) résout **un** nom pour tout le document —
celui du déclarant — et le filler appose le bloc « Signé numériquement par … »
sur **chaque** champ `type: "signature"`. Deux champs de ce type produisent donc
deux blocs identiques, au même nom.

Sur le C1-Partenaire, cela mettait la signature du chômeur dans la case du
PARTENAIRE — un tiers, sans compte, absent de l'écran, que la déclaration engage
pourtant (« Le chômeur précité ET le partenaire déclarent… »). Le champ a été
supprimé : la case reste vide et se signe à la main sur le papier, et l'aide de
la signature du chômeur le dit au citoyen.

**Règle : un formulaire = un champ `signature`.** Une case destinée à un autre
signataire n'est pas un champ ; c'est un orphelin assumé, à consigner dans
`seeds-vs-pdf.test.ts` et à expliquer à l'écran.

## Livraison : la date imprimée est celle du téléchargement

Rien n'est stocké — ni le PDF rempli, ni le payload (décision n°1). Un document
re-téléchargé est donc **régénéré**, et `applyServerAutoFields` y réinjecte la
date du jour. Un dossier validé lundi puis retéléchargé jeudi sort daté de
jeudi.

**C'est voulu** (décision n°5) : le document atteste de la démarche, pas de
l'instant où le citoyen a cliqué. Ne pas « corriger » ce comportement en
figeant la date à la première validation — ce serait stocker une donnée de plus.

L'opposabilité ne repose donc pas sur les octets du fichier, qui diffèrent d'un
téléchargement à l'autre, mais sur deux colonnes non nominatives de
`PdfFormSubmissionLog` (S7) :

- `stablePayloadHash` — SHA256 de `stableDocumentKey` : champs auto et valeurs
  vides écartés, clés triées. **Invariant à la date.** Deux livraisons du même
  contenu métier portent la même empreinte, y compris à des semaines d'écart.
  (`payloadHash`, lui, embarque la date : il ne prouve rien à ce sujet.)
- `diagnosticsSummary` — `{ count, kinds }`, **jamais** `detail` (qui porte les
  caractères saisis par le citoyen). `{ count: 0 }` affirme qu'aucune case n'est
  restée blanche ; `null` = ligne antérieure à S7, complétude inconnue.

Toute nouvelle voie de livraison doit écrire sa ligne de log avec ces deux
colonnes, sans quoi le document qu'elle produit n'est plus opposable. Les
régénérations (zip, e-mail, téléchargement unitaire) sont couvertes en un seul
point, dans `regenerateItems` — ne pas dupliquer ce log dans les routes.

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

## La page ne doit JAMAIS remonter quand on répond

Symptôme signalé quatre fois (C1, C1A, C1C, puis le 2026-07-31) : cliquer dans
le runner renvoie la vue en haut, « comme si c'était un # ». Ce n'est ni une
ancre ni un bouton non typé. **Répondre RACCOURCIT le document** — un
`visibleIf` masque un champ, un résumé d'erreurs disparaît — et dès qu'il
devient plus court que `scrollTop + hauteur d'écran`, le navigateur écrête la
position de défilement.

Trois garde-fous, dans l'ordre où ils ont été posés :

1. `Select modal={false}` — en mode modal, Base UI verrouille le défilement et
   le restaure par `html.scrollTop = valeurMémorisée`, écrêté au nouveau maximum ;
2. `navigationTick` — n'adosser un effet de défilement qu'à un compteur de
   navigation DÉLIBÉRÉE, jamais à un index dérivé de la liste d'étapes ;
3. **une CALE en fin de `document.body`** (`plancherPage`, pdf-form-runner.tsx),
   dont la hauteur compense exactement ce que le document vient de perdre,
   jusqu'au changement d'étape.

Le `min-h-[60svh]` du formulaire ne suffisait pas : il empêche l'étape d'être
minuscule, pas de RÉTRÉCIR, et il ne couvre pas ce qui vit hors du formulaire.
Mesuré sur le C1A : à l'effacement du résumé d'erreurs, la page passait de 1188
à 1067 px et la vue sautait de **121 px** ; avec la cale, 0.

## Obligation de réponse

`buildValidator` **saute déjà les champs invisibles** : dès que les `visibleIf`
sont corrects, poser `required: true` suffit à rendre l'exigence propre à la
branche empruntée. Le blocage du bouton « Continuer » existe déjà côté runner
(`attemptAdvance`). Rien à recoder.

Cases à cocher : aucune raison qu'un lundi soit plus obligatoire qu'un mercredi.
Rendre obligatoire le **choix** qui commande la rubrique, pas les cases.

## « Au moins une réponse parmi N » — `requiredGroup`

Poser la même clé `requiredGroup` sur plusieurs champs les rend obligatoires
**ensemble** : au moins un rempli/coché, aucun individuellement. `buildValidator`
et `countRequirements` le traitent déjà — rien à coder, et le compteur du
stepper reste d'accord avec le bouton « Continuer ».

C'est la réponse aux rubriques que le papier annonce comme incontournables
(« COMPLETEZ TOUJOURS CETTE RUBRIQUE », Q15 du C1B) sans dire *laquelle* des
cases cocher.

L'erreur s'attache au **premier champ visible** du groupe : c'est son `errorMsg`
qui s'affiche. Le message par défaut dit « ci-dessus » — faux dès que l'ancre
est la première case de la liste ; en écrire un.

Ce mémo a longtemps porté l'interdiction inverse (« jamais `requiredGroup` hors
du C1 ») : le runner basculait toute section en contenant un sur
`MotifSituationPicker`, le tableau de situations propre au C1. Depuis le
2026-07-31 le déclencheur est la **paire** `requiredGroup` + `renderAs: "chip"`.
`requiredGroup` ne dit donc plus que la validation, et le rendu se lit dans
`renderAs`, dont c'est le rôle. Deux tests tiennent les deux bouts : les cinq
champs du C1 portent bien les deux marqueurs
(`c1-fields-improvements.test.ts`), les cinq annexes du C1B n'ont pas de
`renderAs` (`c1b-fields.test.ts`).

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
