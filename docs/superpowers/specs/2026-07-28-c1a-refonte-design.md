# C1A — remise d'aplomb et refonte sur la base du C1

**Date** : 2026-07-28 · **Statut** : design validé, à découper en plan
**Décideur métier** : Oraliks · **Portée** : lots 1 et 2 (le lot 3 fera l'objet d'une spec séparée)

---

## 1. Pourquoi

Le C1 est terminé. Son form runner devient le **gabarit de tous les autres
documents ONEM**. Le C1A est le premier compagnon repris sur ce modèle ; les six
suivants (C1B, C1C, C46, C47, C1-Partenaire, Annexe REGIS) hériteront de ce qui
est construit ici.

L'intention de départ était cosmétique : reprendre la présentation, garder le
mapping AcroForm réputé vérifié. L'instruction de ce document a établi que **ce
mapping est faux**. La refonte commence donc par une réparation.

---

## 2. Le piège de ce PDF

Dans `C1A_FR.pdf`, **chaque widget porte le nom du texte imprimé juste
au-dessus de lui**, pas celui de la donnée qu'il reçoit. La case nommée
`Nom employeur` n'est pas la ligne du nom : c'est la ligne suivante, celle de
l'adresse.

Le schéma actuel a été écrit en associant les noms de widgets aux libellés par
ressemblance sémantique. D'où un **décalage systématique d'une ligne** sur les
blocs adresse.

Le test `seeds-vs-pdf` n'a rien vu parce qu'il vérifie une seule chose : qu'un
`pdfFieldName` existe dans le PDF (« aucun champ ne pointe dans le vide »).
Jamais qu'il désigne la bonne case.

### Preuve — alignement par coordonnées

Origine bas-gauche, points PDF.

**Page 2, Q14 « Données concernant votre employeur »**

| Texte imprimé | y | Widget | y widget |
|---|---|---|---|
| titre « 14. Données concernant votre employeur » | 522 | — | — |
| ligne pointillée 1 | 507 | `14 Données concernant votre employeur` | 500 |
| légende « nom » | 498 | | |
| ligne pointillée 2 | 484 | `Nom employeur` | 477 |
| légende « adresse » | 475 | | |

→ `14 Données…` **est** la ligne du nom · `Nom employeur` **est** la ligne de l'adresse.

**Page 2, Q15 « À quelle adresse exercez-vous cette activité ? »**

| Texte imprimé | y | Widget | y widget |
|---|---|---|---|
| ligne 1 (légende « rue numéro » en dessous) | 428 | `A quelle adresse exercezvous cette activité` | 421 |
| ligne 2 (légende « code postal commune ») | 405 | `rue_3` | 398 |

**Page 1, Q2 « Données relatives à l'indépendant »**

| Texte imprimé | y | Widget | y widget |
|---|---|---|---|
| légende « Nom: » | 381 | | |
| ligne pointillée | 366 | `Nom` | 359 |
| « numéro d'entreprise : ☐☐☐☐☐☐☐☐☐☐ » | 349 | `TVA` | 342 |
| légende « Adresse de l'activité indépendante: » | 330 | | |
| ligne 1 (légende « rue numéro ») | 315 | `Adresse de lactivité indépendante` | 308 |
| ligne 2 (code postal commune) | 291 | `rue_2` | 284 |

---

## 3. Lot 1 — remettre les données dans les bonnes cases

### 3.1 Réalignement

| Champ | `pdfFieldName` actuel | Où ça s'imprime aujourd'hui | Correction |
|---|---|---|---|
| `employeurNom` (Q14 nom) | `Nom employeur` | ligne **adresse** de l'employeur | `14 Données concernant votre employeur` |
| `employeurAdresse` (Q14 adresse) | `rue_3` | **code postal de Q15** | `Nom employeur` |
| `adresseActivite` (Q15 rue+n°) | `A quelle adresse exercezvous cette activité` | correct | inchangé |
| `adresseActiviteNumero` (Q15 CP+commune) | `undefined_2` | **description d'activité de Q16** | `rue_3` |
| `adresseActiviteIndependanteLabel` (Q2) | `Adresse de lactivité indépendante` | correct — mais l'`id` laisse croire à un libellé | renommer l'`id`, mapping inchangé |
| `independantAdresseRue` (Q2) | `rue_2` | ligne **code postal + commune** | renommer l'`id` en `…CodePostalCommune` |
| `numeroEntreprise` (Q16) | `TVA` | **case n° d'entreprise de Q2, page 1** | `drawAt` (cf. 3.3) |
| *(absent)* Q2 n° d'entreprise | — | jamais rempli | `TVA` |
| `descriptionActivite1/2` (Q16) | `Je décris mon activité 1/2` | décalées d'une ligne | ajouter `undefined_2` en 1ʳᵉ ligne, décaler |

### 3.2 Le champ `voir 19` n'est pas un artefact

Le champ AcroForm nommé `voir 19` porte **quatre widgets** : trois sont les
cases de revenu de Q19 (« par mois » x=358 y=559 · « par heure » x=485 y=561 ·
« par an » x=348 y=490) et le quatrième une ligne de la grille Q18 (x=335
y=647). Il est nommé `voir 19` parce que c'est le texte imprimé juste au-dessus
de la première case — la règle de nommage du §2.

Quatre widgets pour un seul nom de champ : ils partagent nécessairement la même
valeur. **Aucun montant distinct ne peut y être écrit par le mapping AcroForm.**
Le schéma actuel l'a donc marqué `hidden` comme un artefact et a laissé les
trois champs de revenu virtuels — c'est-à-dire écrivant dans le vide.

Conséquence : le citoyen saisit son revenu, rien ne s'imprime. C'est le chiffre
sur lequel l'ONEM décide si l'activité est cumulable avec les allocations.

### 3.3 Écriture positionnelle

`PdfFormField.drawAt` (`lib/pdf-forms/types.ts:314`) écrit à des coordonnées
précises, indépendamment de `pdfFieldName`. Il est déjà employé sur le C1 pour
la colonne « commune », imprimée sans widget.

À traiter par `drawAt` :

| Question | Raison | Emplacement |
|---|---|---|
| Q19 — revenu par mois / par heure / par an | widget partagé à 4 enfants | p2 (358,559) · (485,561) · (348,490) |
| Q11 — revenu annuel du mandat (2 montants) | **aucun widget** dans la zone | p2 lignes y=714 et y=702, colonne gauche |
| Q10 — quel mandat ou fonction | **aucun widget** dans la zone | p2 entre y=779 et y=743, colonne gauche |
| Q16 — n° d'entreprise | cases-chiffres sans widget | p2 ligne y≈310, à partir de x≈126 |

Vérifié : la zone Q10/Q11 (page 2, colonne gauche, y 690→800) ne contient
**aucun widget AcroForm**.

### 3.4 Le test qui empêche la récidive

Un test qui, pour chaque champ portant un `pdfFieldName`, compare la **position
du widget** au **texte imprimé le plus proche**, et échoue si l'écart dépasse un
seuil. Il remplace la vérification actuelle « le nom existe » par « la case est
au bon endroit ».

Ce test s'applique aux huit formulaires de la table `seeds-vs-pdf`, pas au seul
C1A : les six autres compagnons ont été écrits avec la même méthode et
présentent probablement le même défaut. Les écarts qu'il révélera sur les autres
formulaires seront **consignés, pas corrigés dans ce lot** — chacun aura le sien.

### 3.5 Vérification humaine

Un C1A de test rempli de bout en bout, PDF généré, et lecture case par case avec
Oraliks. Aucune automatisation ne remplace ce contrôle pour une déclaration
officielle.

---

## 4. Lot 2 — l'arbre et l'écran

### 4.1 La table de routage

Le C1A n'est pas un questionnaire plat : c'est un **arbre à renvois**. Chaque
question de routage porte un `voir N` imprimé ; répondre « non » à Q1 envoie
directement en Q9, et les questions 2 à 8 ne doivent pas être remplies.

**Aucun enchaînement implicite** : chaque arête vient d'un `voir N` imprimé.
Seules Q23 et Q24 n'en portent pas — elles sont terminales et affichent leur
propre consigne « COMPLÉTEZ TOUJOURS CETTE RUBRIQUE ».

| Q | Renvoi | Q | Renvoi |
|---|---|---|---|
| Q1 Aidez-vous un indépendant ? | oui→2 · non→9 | Q13 Comme salarié ? | oui→14 · non→15 |
| Q2 Données de l'indépendant | →3 | Q14 Employeur | →15 |
| Q3 Pendant votre chômage ? | oui→4 · non→9 | Q15 Adresse de l'activité | →16 |
| Q4 Quand ? (grille) | →5 | Q16 Personne physique / mandataire | →17 |
| Q5 Décrivez l'aide | →6 | Q17 Pendant votre chômage ? | oui→18 · non→22 |
| Q6 Combien gagnez-vous ? | →7 | Q18 Quand ? (grille) | →19 |
| Q7 Déjà aidé avant ? | oui→8 · non→9 | Q19 Revenu net | →20 |
| Q8 Depuis quelle date ? | →9 | Q20 Déjà exercée avant ? | oui→21 · non→22 |
| Q9 Mandat politique / juge ? | oui→10 · non→12 | Q21 Depuis quand ? | →22 |
| Q10 Quel mandat ? | →11 | Q22 Jours chez l'employeur | →23 |
| Q11 Revenu annuel | →12 | Q23 Indépendant à titre principal | terminal |
| Q12 Autre activité accessoire ? | oui→13 · non→22 | Q24 Affirmation + signature | terminal |

Q16 porte **une seule sortie** pour ses deux options : `voir 17` en fin de bloc,
pas de renvoi par option.

Q9 porte une **exemption imprimée** : conseiller communal, conseiller
provincial, membre d'un CPAS, juge social, juge consulaire ou conseiller social
→ `voir 12`. Même exception que l'aide du champ `mandatPolitique` du C1.

### 4.2 Le compilateur d'arbre

La table ci-dessus est transcrite telle quelle. Un helper parcourt l'arbre depuis
Q1 et calcule, pour chaque question, les conditions sous lesquelles elle est
atteignable — puis les émet en `visibleIf`.

Exemples de sorties attendues :
- Q4 → « Q1 = oui **et** Q3 = oui »
- Q8 → « Q1 = oui **et** Q3 = oui **et** Q7 = oui »
- Q9, Q12, Q22, Q23, Q24 → **toujours visibles** (atteignables par tous les chemins)

**Aucune modification du moteur n'est nécessaire.** `VisibleIf` supporte déjà la
conjonction (`and`, `lib/pdf-forms/types.ts:152`), et l'arbre du C1A ne réclame
jamais de disjonction : toute question atteignable par plusieurs chemins l'est
par *tous* les chemins, donc sans condition.

**Ce que ça répare.** Le schéma actuel accroche Q4 à Q8 sur Q1 en oubliant Q3 :
quelqu'un qui déclare ne pas aider l'indépendant pendant son chômage voit quand
même la grille horaire, la description et le montant, alors que le formulaire
l'envoie en Q9. C'est le mode de défaillance normal des conditions écrites à la
main, et la raison d'être du compilateur.

### 4.3 Les cinq étapes

| Étape | Contenu | Repli |
|---|---|---|
| 1 · Votre identité | NISS, nom, prénom, adresse | pré-remplie depuis le C1 du dossier |
| 2 · Aide à un indépendant | Q1 → Q8 | une seule question si Q1 = non |
| 3 · Mandat politique | Q9 → Q11 | une seule question si Q9 = non |
| 4 · Autre activité accessoire | Q12 → Q21 | une seule question si Q12 = non |
| 5 · Pour finir | Q22 → Q24 | — |

Une entrée par slug dans `PRESENTATION_BY_SLUG`
(`lib/pdf-forms/form-presentation.ts`), qui généralise déjà ce mécanisme : le C1
en est aujourd'hui la seule entrée, aucun dé-durcissement n'est requis.

Conséquence de l'arbre : Q9 et Q12 sont sur **tous** les chemins. Le C1A n'est
donc pas trois blocs indépendants mais un parcours linéaire qui passe toujours
par « mandat politique ? » puis « autre activité accessoire ? ». Quelqu'un venu
pour un seul mandat traverse cinq écrans dont trois quasi vides — le formulaire
se replie de lui-même, sans filtrage inventé.

### 4.4 Q22 — la question manquante

Q22 porte « À COMPLÉTER UNIQUEMENT SI VOUS ÊTES CHÔMEUR TEMPORAIRE », mais
aucune question ne l'établit et les sept cases s'affichent aujourd'hui à tout le
monde.

Ajout d'une question virtuelle (sans widget) « Es-tu chômeur temporaire ? ».
Si oui → les jours travaillés chez l'employeur, puis Q23. Si non → Q23
directement. La définition affichée est celle **imprimée deux fois sur le
formulaire** (sous Q3 et sous Q17) : « toujours au service de votre employeur
mais temporairement sans travail, par ex. manque de travail ou intempéries ».

### 4.5 Les grilles horaires Q4 et Q18

Disposition ONEM à l'identique : lundi à vendredi avec leurs trois créneaux
(avant 7 h · entre 7 h et 18 h · après 18 h), samedi et dimanche sans créneau,
puis la périodicité (toute l'année · pendant certaines périodes ·
irrégulièrement) avec ses lignes de texte libre.

Cases à cocher **carrées**, choix multiples.

### 4.6 Les aides contextuelles

Le C1A imprime ses propres explications, aujourd'hui absentes de l'écran : la
définition du chômeur temporaire, la liste des fonctions exemptées de Q9, le
« RÉPONDEZ TOUJOURS OUI SI VOUS ÊTES INSCRIT COMME INDÉPENDANT À TITRE
ACCESSOIRE OU SI VOUS ÊTES ADMINISTRATEUR DE SOCIÉTÉ » de Q12, les consignes de
joindre la note de calcul du fisc.

**Règle de rédaction : aucune explication inventée.** Tout texte affiché est
recopié du document officiel. Le C1A passe de 20 à ~40 aides, toutes sourcées.

Sur mobile, `labelShort` sur les questions longues (le C1A n'en a aucun
aujourd'hui, le C1 en a 14).

### 4.7 Q24 — annexes et signature

Le nombre d'annexes reste **facultatif**, mais la case doit exister et être
visible. L'affirmation sur l'honneur et la signature sont obligatoires.

### 4.8 Le gabarit partagé — périmètre réel

Le partage effectif est **plus mince** que l'intuition ne le suggère, et
l'imposer tel quel serait dangereux :

- `dejaDeclare` et `dateAPartirDu` n'ont **aucun équivalent** chez les sept
  compagnons — rien à mutualiser.
- `ouiNon` fige trois réglages : `defaultValue: "non"`, `stepPriority: "optional"`,
  `required: true`. **Aucun compagnon ne fonctionne ainsi** — huit de leurs
  questions oui/non sont volontairement facultatives. L'adopter tel quel
  pré-cocherait « non » et déplacerait des questions dans l'accordéon « Autres
  informations », **sans qu'aucun test ne le détecte**.

Ce qui se partage donc :

1. **Les constantes de section** — source unique. Ajoute les sept sections
   compagnons manquantes et répare deux libellés absents de `section-labels.ts`
   qui s'affichent aujourd'hui « Aide-independant » et « Grille-differences ».
2. **`YN`** — trilingue côté C1, uniquement français dans les six copies
   compagnons. L'unification apporte le néerlandais et l'allemand.
3. **`ouiNon` paramétré** — `required`, `defaultValue` et `stepPriority`
   deviennent des options, les valeurs actuelles du C1 restant les valeurs par
   défaut. C'est la seule façon de le partager à comportement constant.

**Le vrai bien commun des six compagnons suivants n'est pas les moules : c'est
le compilateur d'arbre du §4.2.** Chaque formulaire ONEM porte le même genre de
renvois imprimés.

Le déplacement se fait **en premier lot isolé**, à comportement strictement
identique, validé seul avant que le C1A ne bouge. Les tests existants
(`c1-fields-improvements.test.ts`) verrouillent le C1 sur ses valeurs : les 15
questions activité/revenu y sont épinglées `required: true` + `defaultValue:
"non"`, et les sections `mes-activites | mes-revenus | cotisation-syndicale |
non-eee | divers | annexes` épinglées `stepPriority: "optional"`.

### 4.9 Curation — quasiment rien à faire

Contrairement au C1 (55 champs masqués sur 149), le C1A n'a **qu'un seul** champ
à masquer : `toute lannée_2`, case orpheline en bas de page 2 (x=156, y=43),
troisième exemplaire d'un « toute l'année » alors que les deux grilles horaires
sont déjà câblées sur `toute lannée` et `toute lannée_3`. 124 champs visibles
deviennent 123.

Le commentaire du schéma actuel (`c1a-fields.ts:658-662`) arbitre le widget
`14 Données concernant votre employeur` comme un **intitulé de zone**, donc
masquable. **Cet arbitrage est faux** : les coordonnées du §2 montrent que ce
widget est posé sur la ligne pointillée de saisie (y=500 pour une ligne
imprimée à y=507, légende « nom » à y=498). C'est la case du **nom de
l'employeur**, et le §3.1 la lui réattribue. Elle doit rester visible — la
masquer laisserait la ligne du nom vide sur le PDF envoyé à l'ONEM.

La raison : le C1 masquait beaucoup parce que son schéma recouvrait des dizaines
de cases déjà écrites ailleurs (radios pipe, grille cohabitants, règles serveur).
Le C1A est en correspondance quasi 1↔1 — 130 widgets revendiqués sur 132.

**Ne pas transposer les règles du C1 telles quelles.** Appliquées au C1A elles
masqueraient :
- `nomEtPrenom` (règle hide-list, qui contourne la garde de section) → **le C1A
  partirait à l'ONEM sans nom** ;
- les 15 lignes de texte libre des grilles horaires (règle « cellule
  positionnelle ») → l'usager coche « pendant les périodes suivantes » et n'a
  plus où écrire ;
- `dateDebutAide` et `dateDebutActivite` (règle `Date\d+_af_date`) → deux dates
  officielles perdues.

L'invariant du C1 reste la règle : **ne jamais masquer un widget unique porteur
de donnée**. Au C1A, chaque `pdfFieldName` n'a qu'un seul porteur — d'où
l'absence de candidats.

---

## 5. Hors périmètre — lot 3, spec séparée

Le PDF impose **un C1A par indépendant aidé** (encadré Q1) et **un par activité
exercée** (encadré Q12). Un dossier ne sait aujourd'hui stocker qu'un seul jeu de
réponses par document : le second C1A écraserait le premier, silencieusement.

Treize points de rupture recensés — écriture des réponses, brouillons, compteur
de complétion, URL du formulaire (sans numéro d'exemplaire), route de
téléchargement indexée par document, nom de fichier identique, collisions dans
le zip et les pièces jointes du mail. Trente-huit fichiers touchent ce stockage.

Deux voies : clé composée dans le stockage JSON actuel (pas de migration, mais
rétro-compatibilité à assurer partout) ou table dédiée `BundleRunDocument`
(migration, plus propre, supprime une dette existante). **Arbitrage reporté à la
spec du lot 3.**

Le blocage anti-doublon décidé par Oraliks — refuser un C1A qui reprend les
mêmes données qu'un précédent, pour éviter qu'un dossier n'enfle indéfiniment —
s'appuiera sur le **numéro d'entreprise / TVA** comme clé. Ce champ est créé par
le lot 1 (§3.1), qui en est donc le prérequis.

**En attendant** : un encart visible sur le C1A rappelant qu'un formulaire
distinct est requis par indépendant et par activité, et invitant à se rapprocher
de l'organisme de paiement.

---

## 6. Risques

| Risque | Traitement |
|---|---|
| Le déplacement des moules touche le C1, en production | Lot isolé, comportement constant, tests existants comme filet, validé avant le C1A |
| Le réalignement introduit un nouveau décalage | Test de position (§3.4) + relecture humaine d'un PDF rempli (§3.5) |
| Le compilateur produit une condition trop stricte, une question disparaît | Test qui, pour chaque chemin de l'arbre, vérifie l'ensemble exact des questions visibles |
| Les six autres compagnons ont le même défaut de mapping | Le test de position les dépiste ; écarts consignés, corrigés hors de ce lot |
| `drawAt` mal calé, texte hors de sa case | Vérification visuelle sur PDF généré, avec `maxWidth` pour éviter les débordements |

---

## 7. Validation

- `pnpm test` — aucune régression sur les 1949 tests existants
- `pnpm build` — typecheck
- `pnpm lint` — aucune erreur nouvelle
- Nouveaux tests : position des widgets (8 formulaires), compilation de l'arbre
  (un cas par chemin), non-régression du C1 après extraction des moules
- Écran à vérifier : `/document/c1a`, les cinq étapes, sur mobile et sur desktop
- **Contrôle humain obligatoire** : un C1A rempli de bout en bout, PDF généré,
  relu case par case avec Oraliks

---

## 8. Décisions actées

| Sujet | Décision | Par |
|---|---|---|
| Périmètre initial | Présentation seule, mapping conservé | Oraliks |
| *révisé* | Réparer le mapping dans ce lot — le mapping s'est avéré faux | Oraliks, après constat |
| Structure du formulaire | Suivre l'arbre des `voir N`, aucun enchaînement implicite | Oraliks |
| Q16 | Une seule sortie pour les deux options | Oraliks |
| Grilles horaires | Disposition ONEM à l'identique, cases à cocher multiples | Oraliks |
| Q22 | Question « chômeur temporaire ? » puis jours travaillés, puis Q23 | Oraliks |
| Q24 | Annexes facultatives mais la case doit exister | Oraliks |
| Répétabilité | Requise, avec blocage anti-doublon sur le n° de TVA | Oraliks |
| Séquencement | Lots 1 et 2 d'abord, répétabilité en lot 3 séparé | Oraliks |
| Approche technique | Table de routage + gabarit partagé | Oraliks |
| Moules partagés | Périmètre réduit après analyse ; `ouiNon` paramétré | technique |

---

## 9. Reste à établir à l'implémentation

- Coordonnées `drawAt` exactes de Q10 (trois lignes) et Q11 (deux montants) —
  la zone est vérifiée sans widget, les positions restent à mesurer ligne à ligne.
- Répartition des deux montants de Q11 (« EUR … EUR » sur deux lignes) : deux
  champs distincts ou un seul, à confirmer sur le formulaire imprimé.
- Q6 imprime deux cases (« par mois » / « par an ») pour un seul champ
  `montantAide` — à scinder, sur le modèle de Q19.
- Le widget `1_3` est disputé entre Q10 et la première ligne « périodes » de
  Q18 ; il est actuellement attribué à Q18. À trancher une fois Q10 passée en
  `drawAt`.
- `q4periodesTexte5` porte `pdfFieldName: "undefined"` — n'échappe au filtre
  junk que parce que celui-ci exige `undefined_\d+`. À réattribuer.
- Les widgets `Montant` (3 enfants) et `TVA` (2 enfants) partagent leur valeur
  entre plusieurs emplacements — vérifier que c'est voulu à l'impression.
