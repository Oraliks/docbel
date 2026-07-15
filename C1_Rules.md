# Règles du formulaire C1

> Document de référence Docbel pour le formulaire ONEM C1.
> Il décrit le comportement attendu du Form Runner et du PDF rempli.
> Il ne remplace pas la décision de l'ONEM ou de l'organisme de paiement.

## 1. Sources de référence

| Priorité | Source | Rôle |
|---|---|---|
| 1 | `private/pdfs/C1_FR.pdf` | Structure officielle, libellés et cases réellement présentes dans le PDF |
| 2 | `docs/knowledge/chomage/formulaires-onem.md` | Règle métier : le C1 est fourni par l'organisme de paiement et complété par le demandeur |
| 3 | `docs/knowledge/chomage/situation-familiale-c1-t147.md` | Situation familiale, ménage, revenus et personnes à charge |
| 4 | `lib/pdf-forms/seed/c1-fields-improvements.ts` | Schéma exploité par le Form Runner, validations, préremplissages et déclencheurs |
| 5 | `docs/superpowers/specs/2026-07-10-c1-companion-documents-gating-design.md` | Parcours des documents compagnons déclenchés par les réponses |

En cas de contradiction, le PDF officiel et la règle métier ONEM priment sur le
design d'interface. Une incertitude juridique doit être affichée comme telle et
ne peut pas être transformée en décision automatique.

## 2. Principe général

- Le citoyen reste responsable de ses déclarations.
- Le Form Runner peut préremplir une réponse pratique, mais toute réponse doit
  rester visible et modifiable.
- Une valeur `Non` par défaut n'est pas une décision juridique : c'est le cas
  d'usage majoritaire pour un C1 utilisé afin de déclarer un autre motif.
- Une réponse `Oui` doit ouvrir les précisions nécessaires et, si besoin,
  ajouter le document compagnon correspondant.
- Les suivis « déjà déclaré / première fois » ne sont jamais devinés.
- Les champs d'identité peuvent être préremplis depuis le profil, mais le
  demandeur doit pouvoir les corriger.
- La date et la signature peuvent être produites techniquement au moment de la
  génération ; elles ne constituent pas une réponse métier déduite.

## 3. Valeurs par défaut autorisées

Les champs suivants commencent à `Non` dans le Form Runner et restent toujours
éditables :

### Activités

- études de plein exercice ;
- apprentissage ou formation en alternance ;
- formation avec convention SYNTRA / IFAPME / EFEPME / IAWM ;
- mandat artistique rémunéré ;
- mandat politique ;
- Chapitre XII ;
- activité Tremplin-indépendants ;
- activité accessoire ou aide à un indépendant ;
- administrateur de société ;
- indépendant à titre accessoire ou principal.

### Revenus

- catégorie professionnelle particulière avec pension complète ;
- pension de retraite ou de survie ;
- indemnité de maladie ou d'invalidité ;
- indemnité d'accident du travail ou de maladie professionnelle ;
- avantage financier lié à une formation, des études, un apprentissage, un
  stage ou une coopérative d'activités.

### Divers

- congé sans solde ;
- incapacité permanente de travail d'au moins 33 %.

Le préremplissage ne doit jamais masquer ces questions, supprimer leur option
`Oui`, ni empêcher leur modification.

## 4. Suivis obligatoires

Lorsqu'une activité ou un revenu concerné est répondu `Oui`, le Form Runner
demande explicitement si la situation a déjà été déclarée à l'organisme de
paiement :

| Situation | Si `Oui` + première déclaration | Si déjà déclaré |
|---|---|---|
| Mandat artistique | C46 | Pas de C46 déclenché |
| Tremplin-indépendants | C1C | Pas de C1C déclenché |
| Activité accessoire / aide | C1A | Pas de C1A déclenché |
| Administrateur de société | C1A | Pas de C1A déclenché |
| Indépendant accessoire/principal | C1A si applicable | Pas de nouveau C1A déclenché |
| Pension de retraite/survie | C1B | Pas de C1B déclenché |
| Incapacité permanente ≥ 33 % | C47 | Pas de C47 déclenché |

Le suivi n'est visible que si la réponse principale vaut `Oui`, mais il est
obligatoire dans ce cas et ne reçoit pas de valeur automatique.

## 5. Autres déclencheurs C1

| Réponse dans le C1 | Document ajouté |
|---|---|
| Colocation | Annexe REGIS, code FN4 |
| Situation de cohabitation ambiguë | Annexe REGIS |
| Personne financièrement à charge à déclarer pour la première fois | C1-Partenaire |

Les documents compagnons ne doivent être exigés que lorsqu'ils sont réellement
déclenchés par le payload du C1 et disponibles dans le parcours.

## 6. Préremplissage autorisé et limites

Autorisé : identité issue du profil, date de naissance déduite d'un NISS valide,
date du jour, mode de paiement standard et valeurs techniques nécessaires à la
génération.

Interdit : déduire une activité, un revenu, une cohabitation, une première
déclaration ou une catégorie familiale à la place du citoyen. La catégorie A/N/B
doit rester confirmée par le C1 et, en cas d'ambiguïté, par l'organisme de
paiement.

## 7. Génération du PDF

- Chaque réponse du Form Runner doit être reportée sur le widget AcroForm
  correspondant du C1 officiel.
- Les champs virtuels servent uniquement à guider le parcours ou à déclencher un
  document compagnon ; ils ne doivent pas être présentés comme des cases
  officielles inexistantes.
- Le PDF généré doit rester ouvrable par les lecteurs PDF courants et conserver
  les valeurs visibles.
- Le C1 ne doit pas être aplati avec une transformation qui casse ses références
  XRef ou ses champs AcroForm.

## 8. Points nécessitant une vérification humaine

- catégorie familiale exacte lorsque la composition du ménage ou les revenus sont
  ambigus ;
- seuils de revenus du cohabitant et du partenaire ;
- conséquences concrètes d'une activité ou d'une pension selon le dossier ;
- toute situation non couverte explicitement par le PDF C1 ou par une source ONEM
  vérifiée.

## 9. Règle de maintenance

Toute modification du comportement C1 doit mettre à jour, dans le même lot :

1. ce fichier ;
2. le schéma `c1-fields-improvements.ts` ;
3. les tests correspondants ;
4. le seed des variantes `c1-fr`, `c1-insertion` et
   `c1-changement-situation` si la structure ou les defaults changent.
