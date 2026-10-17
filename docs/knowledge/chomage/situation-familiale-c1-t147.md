# Situation familiale (catégories) & formulaire C1

> **Thème :** `situation_familiale`. La situation familiale **influence la catégorie et le
> montant** des allocations. Elle est déclarée via le **C1**.
>
> **Source pratique actuelle.** L'ONEM publie la feuille info **T147 — « Quelle est votre
> situation familiale ? »**, mise à jour le **01/09/2026**. Elle couvre les catégories, les
> personnes cohabitantes, la pension alimentaire, les revenus et les ressources. Cette phase
> actualise la source ; elle ne transforme pas son contenu en qualification automatique.

> **Référence.** <https://www.onem.be/citoyens/chomage-complet/a-combien-seleve-votre-allocation-/quelle-est-votre-situation-familiale->
> (T147, passages pertinents revérifiés le 17/10/2026). T201 reste la source liée aux montants
> après occupation. Ce lot documentaire ne livre aucune modification de moteur, de collecte
> ou de formulaire. `active / official` décrit une règle sourcée, pas sa couverture en code.

---

## Rôle de la situation familiale
À partir de la 2e période d'indemnisation (chômage complet), le montant devient **forfaitaire**
et dépend de la **catégorie familiale** (et non plus du dernier salaire). La catégorie influence
donc directement ce que la personne perçoit.

## Catégories et état du calcul
Les seules catégories familiales finales du contrat produit sont **A / B / N** :

- **Charge de famille (A)** : situations de l'article 110, §1 ; la simple présence d'une
  personne sans revenus ne suffit pas à établir toutes les conditions.
- **Isolé (N)** : personne habitant seule, sous réserve des exceptions de l'article 110, §2.
- **Cohabitant (B)** : personne ne relevant ni du §1 ni du §2 (article 110, §3).

Les informations manquantes et les limites de couverture sont des **états du calcul**, pas
une quatrième catégorie. Tant qu'un fait décisif manque, se contredit ou dépend d'une règle
non couverte, la catégorie finale reste absente ; aucun aperçu conditionnel A/B/N n'est
présenté. Une qualification théorique étayée reste une orientation sur faits déclarés.
Elle ne crée ni ne confirme un code ou une décision ONEM (`officialOnemState`).

### Trois niveaux à conserver séparément

| Niveau | Sens | Ne permet pas de déduire |
|---|---|---|
| Relation déclarée | Lien indiqué au C1 (C1-Info, rubriques 12–13) : partenaire, conjoint, enfant, autre lien… | Une assimilation au conjoint ou des faits non répondus |
| Qualification théorique | Faits pertinents datés, conditions et revenus examinés selon les règles ci-dessous | Une déclaration conjointe déposée, une reconnaissance ou un paiement officiel |
| État officiel | Information ou décision administrative avec sa provenance et sa date | Les faits manquants d'un nouveau calcul |

Les anciens `partnerEstablished` et `partenaireConditionsEtablies`, positifs ou négatifs,
restent des déclarations globales historiques. Ils ne fournissent pas les réponses détaillées.
Absent, non et oui restent distincts ; un échec d'assimilation n'établit ni le rôle de tiers,
ni l'absence de cohabitation, ni une catégorie B ou N.

### Questions décisives avant les priorités du ménage

Fondements : [AR, article 110, §1, alinéas 2–4 et §5](https://www.ejustice.just.fgov.be/eli/arrete/1991/11/25/1991013192/justel),
[AM, article 59](https://www.ejustice.just.fgov.be/cgi_loi/change_lg.pl?language=fr&la=F&cn=1991112630&table_name=loi),
[C1-Partenaire, page 1](https://www.onem.be/file/cc73d96153bbd5448a56f19d925d05b1379c7f21/e539bf0da5b3112f2ca6a56c55cdd06d8b601cda/formulaire.pdf).
Passages relus le 17/10/2026 ; les formulations ci-dessous sont des paraphrases ciblées.

| Fait à établir pour la personne candidate à l'assimilation | Portée exacte / suite |
|---|---|
| Cohabitation et ménage de fait avec le demandeur | Même toit et questions ménagères principalement communes ; adresse seule insuffisante. Distinguer les absences assimilées, sans inventer une sortie du ménage. |
| Parenté ou alliance jusqu'au troisième degré inclus | Exclut cette assimilation ; préciser le lien pour examiner enfant ou parent/allié. Les parents d'accueil sont assimilés aux parents dans le cadre prévu par l'AR. |
| Enfant pour lequel le demandeur ou un autre membre de la famille peut prétendre aux allocations familiales | Allocations **pour cette personne**, distinctes de celles qu'elle reçoit pour ses propres enfants. Ne pas inventer une filiation à partir du seul droit aux allocations. |
| Enfant encore à charge d'un parent tenu à une obligation d'entretien | Condition autonome de l'AM art. 59 ; ne dépend pas du seul paiement actuel d'allocations familiales. |
| RIS ou aide financière remplaçant le RIS | Identifier précisément la prestation ; ne pas étendre à toute intervention du CPAS. Voir la réserve CPAS ci-dessous. |
| Déjà financièrement à charge d'un autre chômeur avec lequel elle cohabite | Vise un **autre chômeur cohabitant**, pas toute personne qui contribue aux frais. |
| Mariée et cohabitant avec son conjoint | Exclusion cumulative : le mariage seul, notamment avec séparation, ne suffit pas. Recenser ce conjoint dans la composition réelle. |
| Déclaration conjointe | Formalité prévue par l'AM art. 59 : déclaration du travailleur et de la personne à charge au moment requis. Son état reste distinct des faits matériels. |

Recenser le ménage complet, qualifier les personnes, puis appliquer les priorités et les
revenus. Poser seulement les questions encore décisives : une exclusion certaine ferme la
voie d'assimilation sans exiger toutes les autres réponses, mais impose de poursuivre sur
la composition réelle. L'indépendance d'une réponse omise devra être démontrée et testée
dans le lot moteur ; il n'existe pas de questionnaire universel suffisant à sept réponses.

Le [C1-Info, rubriques 13–14](https://www.onem.be/index.php/file/cc73d96153bbd5448a56f19d925d05b1379c7f21/448471413941904267f10257baa3afef967570c8/01-01-2024_c1-info_fr.pdf)
distingue la pièce à joindre (sauf déclaration antérieure inchangée) et la case concernant
l'allocataire du paiement. Cette case ne répond pas à toutes les questions sur le droit
aux allocations pour la personne candidate. Une pièce à préparer n'est pas automatiquement
un fait familial inconnu ; le calcul théorique doit néanmoins signaler la formalité restante
et ne jamais prétendre que la condition déclarative administrative est accomplie.
Le C1-Partenaire prévoit les signatures des deux personnes et trois exemplaires.

### Dates et portée de vérification

| Date | Ce qu'elle date réellement |
|---|---|
| 01/09/1996 | Assimilation au conjoint et délégation au ministre : AR modificatif du 04/08/1996, art. 4 ; exclusion mariage avec conjoint cohabitant : AM du 05/08/1996, art. 1 |
| 01/07/1997 | Conditions cumulatives de charge financière : AM du 20/06/1997, art. 2 (déclaration, aide sociale, entretien parental, autre chômeur) |
| 01/03/2026 | Réforme et dispositions de montant concernées ; ne constitue pas la naissance de toutes les définitions familiales |
| 01/09/2026 | Mise à jour T147 et validité des montants indexés qu'elle affiche ; pas date générale d'entrée en vigueur des définitions |
| 01/01/2024 ; 15/09/2022 | Versions respectives C1/C1-Info et C1-Partenaire ; ne datent pas l'effet des règles |
| 14/10/2026 ; 20/03/2026 | Mises à jour globales des consolidations Justel AR et AM consultées, pas modification de chaque article |
| 17/10/2026 | Consultation des passages officiels de ce lot (`last_verified`) |

La date de situation et celle d'effet d'un changement doivent rester séparées des dates de
saisie, de document et de décision ONEM. `effective_from: unknown` signifie que le début
d'effet de la règle entière n'est pas établi ici ; cela n'autorise pas une application
historique aveugle. Les seuils restent dans les barèmes datés, sans recopie chiffrée ici.

### Réserve CPAS et revenus

La [T147, rubrique « Allocations du CPAS »](https://www.onem.be/citoyens/chomage-complet/a-combien-seleve-votre-allocation-/quelle-est-votre-situation-familiale-)
écarte en principe le RIS et l'aide équivalente des revenus de remplacement, avec une
exception pour le partenaire qui exclut la charge de famille. Ne pas contourner cette
exception en reclassant mécaniquement un partenaire en tiers neutre après un échec
d'assimilation. Conserver le contexte relationnel et la nature de la prestation ; une
combinaison non couverte appelle un examen, sans lettre finale. Ce lot ne qualifie pas un
droit CPAS et ne généralise pas à toutes ses aides.

## Informations nécessaires
- **Composition du ménage** (qui vit sous le même toit).
- **Revenus** des cohabitants / du partenaire.
- **Personnes à charge** éventuelles, **pension alimentaire** versée.

---

## Règles

```yaml
rule_id: situation_familiale_c1
theme: situation_familiale
effective_from: unknown
source_name: ONEM — C1 (Déclaration de la situation personnelle et familiale)
source_url: https://www.onem.be/formulaires-attestations/c1
last_verified: 2026-06-30
confidence: official
status: active
summary: >
  Le C1 « Déclaration de la situation personnelle et familiale » est fourni par l'organisme de
  paiement et complété par le demandeur. Ce qui y est déclaré a des conséquences importantes sur
  le droit aux allocations et leur montant ; des déclarations inexactes peuvent entraîner
  exclusion et récupération.
agent_instruction: >
  Expliquer l'importance d'un C1 exact. Ne pas remplir le C1 à la place de la personne ; orienter
  vers l'organisme de paiement. Toute incertitude sur la catégorie => a_verifier.
red_flags:
  - rf_situation_familiale_ambigue
related_forms:
  - C1
related_topics:
  - chomage_complet
  - formulaires_onem
```

```yaml
rule_id: situation_familiale_categories
theme: situation_familiale
effective_from: 2026-03-01
source_name: ONEM — À combien s'élève votre allocation après une occupation (T201)
source_url: https://www.onem.be/page/a-combien-s-eleve-votre-allocation-de-chomage-apres-une-occupation---situation-a-partir-du-01.03.2026-
base_legale: >
  AR du 25/11/1991, art. 110 (définitions : travailleur ayant charge de famille, isolé,
  cohabitant) ; AM du 26/11/1991, art. 59-63 (cohabitation, prise en compte des revenus). Texte
  consolidé public : ejustice.just.fgov.be (Justel, numac 1991013192 pour l'AR). Aussi dans RioLex.
base_legale_url: https://www.ejustice.just.fgov.be/eli/arrete/1991/11/25/1991013192/justel
last_verified: 2026-06-30
confidence: high
status: active
summary: >
  Trois catégories familiales : charge de famille / chef de ménage (A), isolé (N), cohabitant (B),
  avec une hiérarchie de montant A > N > B. À partir de la 2e période, le forfait dépend de cette
  catégorie.
agent_instruction: >
  Expliquer l'existence des 3 catégories et leur effet sur le montant, sans chiffrer. Confirmer la
  catégorie via le C1 / l'organisme de paiement.
red_flags:
  - rf_situation_familiale_ambigue
related_forms:
  - C1
related_topics:
  - chomage_complet
```

```yaml
rule_id: situation_familiale_definitions
theme: situation_familiale
effective_from: unknown
source_name: ONEM — T147 « Quelle est votre situation familiale ? »
source_url: https://www.onem.be/citoyens/chomage-complet/a-combien-seleve-votre-allocation-/quelle-est-votre-situation-familiale-
base_legale: >
  AR du 25/11/1991, art. 110 (définitions : charge de famille, isolé, cohabitant) ; AM du
  26/11/1991, art. 59-63 (cohabitation, prise en compte des revenus du cohabitant / du partenaire).
  Texte consolidé public : ejustice.just.fgov.be (Justel, numac 1991013192 pour l'AR). Aussi dans
  RioLex. T147 est la source pédagogique actuelle ; les montants indexés qu'elle cite ne sont pas
  repris ni calculés dans cette source métier.
base_legale_url: https://www.ejustice.just.fgov.be/eli/arrete/1991/11/25/1991013192/justel
last_verified: 2026-10-08
confidence: official
status: deprecated
replaced_by:
  - situation_familiale_cohabitation_am59
  - situation_familiale_partenaire_assimilation_art110
  - situation_familiale_charge_financiere_am59
summary: >
  Ancien cadrage global to_verify, conservé pour l'historique. Les définitions ciblées de
  cohabitation, assimilation et charge financière sont désormais documentées séparément.
agent_instruction: >
  Ne plus appliquer ce cadrage comme règle de qualification. Consulter les règles de
  remplacement et les limites de couverture ; leur documentation ne prouve pas leur câblage.
red_flags:
  - rf_situation_familiale_ambigue
related_forms:
  - C1
related_topics:
  - chomage_complet
# Source actualisée sans changement de moteur : les montants indexés et les décisions individuelles
# restent hors de portée de cette règle documentaire.
```

```yaml
rule_id: situation_familiale_cohabitation_am59
theme: situation_familiale
effective_from: unknown
source_name: SPF Justice — AM du 26/11/1991, art. 59, alinéas 1 et 2 ; ONEM T147
source_url: https://www.ejustice.just.fgov.be/cgi_loi/change_lg.pl?language=fr&la=F&cn=1991112630&table_name=loi
base_legale: >
  AM art. 59 : même toit et questions ménagères principalement communes ; résidence principale
  présumée jusqu'à preuve contraire (ajout en vigueur le 01/04/2003). L'alinéa 2, 2° vise les
  membres du ménage emprisonnés, internés ou placés dans un établissement pour malades mentaux,
  pendant les douze premiers mois. T147 traite aussi les absences professionnelles.
last_verified: 2026-10-17
confidence: official
status: active
summary: >
  La cohabitation s'apprécie sur les faits, pas sur la seule adresse ou le mot partenaire.
  L'absence physique ne prouve pas à elle seule la sortie du ménage.
agent_instruction: >
  Demander les faits de vie commune et les dates/motifs d'absence lorsqu'ils sont décisifs.
  Ne pas étendre l'assimilation de l'alinéa 2, 2° à une hospitalisation ordinaire ou à un séjour
  en maison de repos ; les autres absences restent à examiner selon les faits.
  Une autonomie contestée ou une absence non couverte reste a_verifier, sans N automatique.
  Ce lot ne livre pas de qualification individuelle dans le moteur.
red_flags:
  - rf_situation_familiale_ambigue
related_forms:
  - C1
  - C1-Annexe REGIS
related_topics:
  - chomage_complet
```

```yaml
rule_id: situation_familiale_partenaire_assimilation_art110
theme: situation_familiale
effective_from: 1996-09-01
source_name: SPF Justice — AR du 25/11/1991, art. 110, §1, alinéa 2 et §5
source_url: https://www.ejustice.just.fgov.be/eli/arrete/1991/11/25/1991013192/justel
base_legale: >
  AR du 04/08/1996, art. 4, effet au 01/09/1996. Pour les 1° et 2° du §1, alinéa 1,
  assimilation au conjoint sous conditions ; le §5 renvoie notamment à la charge financière.
last_verified: 2026-10-17
confidence: official
status: active
summary: >
  La personne doit former un ménage de fait avec le travailleur et être financièrement à sa
  charge. Elle ne peut être un parent ou allié jusqu'au troisième degré inclus, ni un enfant
  pour lequel le travailleur ou un autre membre de la famille peut prétendre aux allocations
  familiales. Le rôle déclaré ne prouve aucune de ces conditions.
agent_instruction: >
  Articuler avec situation_familiale_charge_financiere_am59 avant d'appliquer les priorités.
  Distinguer allocations pour cette personne et allocations qu'elle reçoit pour ses enfants.
  Après exclusion, préciser le lien réel et reprendre le ménage complet sans rôle de repli
  inventé. Un ancien booléen ne remplace pas les faits détaillés.
red_flags:
  - rf_situation_familiale_ambigue
related_forms:
  - C1
  - C1-Partenaire
related_topics:
  - chomage_complet
```

```yaml
rule_id: situation_familiale_charge_financiere_am59
theme: situation_familiale
effective_from: 1997-07-01
source_name: SPF Justice — AM du 26/11/1991, art. 59, alinéas 3 et 4
source_url: https://www.ejustice.just.fgov.be/cgi_loi/change_lg.pl?language=fr&la=F&cn=1991112630&table_name=loi
base_legale: >
  Conditions cumulatives dans la rédaction AM du 20/06/1997, art. 2 (effet 01/07/1997).
  L'exclusion de la personne mariée cohabitant avec son conjoint est déjà issue de l'AM du
  05/08/1996, art. 1 (effet 01/09/1996). Ne pas rétroprojeter l'ensemble avant juillet 1997.
last_verified: 2026-10-17
confidence: official
status: active
summary: >
  Déclaration du travailleur et de la personne à charge au moment requis ; absence du minimum
  de moyens d'existence ou de l'aide financière qui le remplace (RIS dans les documents actuels) ;
  absence, comme enfant, de charge d'un parent tenu à l'entretien ; absence de charge financière
  d'un autre chômeur cohabitant. Une personne mariée cohabitant avec son conjoint ne peut être
  financièrement à charge d'une autre personne au sens de cette disposition.
agent_instruction: >
  Séparer faits matériels, état de la déclaration et état officiel. Le calcul théorique sur
  faits ne certifie pas la formalité ; signaler la démarche restante et la réserve ONEM.
  Ne pas exclure sur le seul mariage ou sur une contribution financière d'une personne
  quelconque. Voir situation_familiale_cpas_contexte_partenaire avant tout reclassement.
red_flags:
  - rf_situation_familiale_ambigue
related_forms:
  - C1
  - C1-Partenaire
related_topics:
  - chomage_complet
```

```yaml
rule_id: situation_familiale_conjoint_revenus_conditions_am60
theme: situation_familiale
effective_from: unknown
source_name: SPF Justice — AM du 26/11/1991, art. 60, alinéas 2, 4, 5 et dernier alinéa
source_url: https://www.ejustice.just.fgov.be/cgi_loi/change_lg.pl?language=fr&la=F&cn=1991112630&table_name=loi
base_legale: >
  AR art. 110, §1 et §5 ; AM art. 60. Conditions contractuelles issues de l'AM du 27/04/2001
  (01/04/2001), exception de cumul de l'AM du 26/06/2008 (01/07/2008), disposition de montant
  pour revenu irrégulier depuis le 01/11/2012, renvoi de montant modifié au 01/03/2026.
last_verified: 2026-10-17
confidence: official
status: active
summary: >
  La dérogation pour le revenu du conjoint exige déclaration, travail salarié et plafond brut
  applicable. Aucun revenu de remplacement pour le mois, sauf incapacité de travail ou chômage
  temporaire durant l'occupation dont le revenu est neutralisé, avec cumul salaire/remplacement
  sous la limite. Vérifier la rémunération réelle du mois et celle prévue pour un mois complet ;
  cette dernière condition s'applique au CDI, à un CDD d'au moins un mois ou à plusieurs CDD
  successifs dont la durée totale atteint au moins un mois.
  Les revenus salariés sont rattachés à la période sous contrat.
agent_instruction: >
  Examiner tous les revenus et leur nature ; un salaire fixe sous seuil ne suffit pas.
  Pour revenu variable, C1-Info rubrique 16 et T147 demandent le C110A pour le mois concerné.
  Après la première période, le dernier alinéa de l'AM art. 60 fixe un montant journalier
  particulier lorsque la charge de famille ne peut être déterminée qu'après la fin du mois.
  Ne pas confondre catégorie du mois, montant et code de traitement 60A/60B. Leur correspondance
  complète reste à sourcer/tester dans un lot dédié ; aucun B final par défaut si le mois manque.
  Sans plafond daté ou faits décisifs, demander les précisions ou l'examen de l'organisme de paiement.
red_flags:
  - rf_situation_familiale_ambigue
related_forms:
  - C1
  - C110A
related_topics:
  - chomage_complet
```

```yaml
rule_id: situation_familiale_cpas_contexte_partenaire
theme: situation_familiale
effective_from: unknown
source_name: ONEM — T147, rubriques charge financière et Allocations du CPAS
source_url: https://www.onem.be/citoyens/chomage-complet/a-combien-seleve-votre-allocation-/quelle-est-votre-situation-familiale-
base_legale: AM du 26/11/1991, art. 59, alinéa 3, 2° ; AR art. 110, §1, alinéa 2
last_verified: 2026-10-17
confidence: official
status: active
summary: >
  T147 ne considère pas le RIS et l'aide financière remplaçant le RIS comme des revenus de
  remplacement, sauf pour le partenaire, auquel cas la charge de famille est exclue.
agent_instruction: >
  Conserver nature de la prestation et contexte de couple après une exclusion d'assimilation.
  Ne pas fabriquer A par conversion en tiers sans revenu pertinent. Pour une combinaison
  non documentée, demander une revue avec motif précis, sans lettre de catégorie finale.
  Ne pas étendre à toute aide CPAS ni prétendre statuer sur un droit CPAS.
red_flags:
  - rf_situation_familiale_ambigue
related_forms:
  - C1
  - C1-Partenaire
related_topics:
  - chomage_complet
```

```yaml
rule_id: situation_familiale_impact_montant
theme: situation_familiale
effective_from: 2026-03-01
source_name: ONEM — À combien s'élève votre allocation après une occupation (T201)
source_url: https://www.onem.be/page/a-combien-s-eleve-votre-allocation-de-chomage-apres-une-occupation---situation-a-partir-du-01.03.2026-
base_legale: >
  AR du 25/11/1991, art. 110 (catégories familiales) et art. 111-119 (montant selon la période et
  la catégorie), notamment art. 114 et 116 (2e période forfaitaire). Texte consolidé public :
  ejustice.just.fgov.be (Justel, numac 1991013192). Aussi dans RioLex.
base_legale_url: https://www.ejustice.just.fgov.be/eli/arrete/1991/11/25/1991013192/justel
last_verified: 2026-06-30
confidence: official
status: active
summary: >
  À partir de la 2e période d'indemnisation du chômage complet, l'allocation est forfaitaire et
  son montant dépend de la catégorie familiale (et non plus du dernier salaire).
agent_instruction: >
  Sert à expliquer pourquoi la situation familiale est déterminante. Ne pas chiffrer (cf.
  calculateur). Toujours conclure que la catégorie doit être confirmée.
red_flags:
  - rf_situation_familiale_ambigue
  - rf_demande_montant_exact
related_forms:
  - C1
related_topics:
  - chomage_complet
```

```yaml
rule_id: situation_familiale_revenu_enfant_premier_emploi
theme: situation_familiale
effective_from: 2002-01-01
source_name: ONEM / RioLex — AM du 26/11/1991, art. 60, commentaire 8
source_url: https://rvaonemtech.powerappsportals.com/fr-FR/wetsartikel/?id=26_11_1991-1-art_60&GoTo=true&materie=329720005&submaterie=100000000&juraard=0&articlenr=
base_legale: >
  AM du 26/11/1991, art. 60, alinéa 3 : le premier revenu professionnel d'un enfant après
  les études peut être neutralisé pendant douze mois, calculés de date à date. Le commentaire
  ONEM précise le départ après la fin des études lorsque l'occupation a commencé avant.
last_verified: 2026-10-08
confidence: official
status: active
summary: >
  Le revenu du premier emploi d'un enfant peut être neutralisé temporairement. À l'échéance,
  le code 110&1V impose une réévaluation selon la situation alors connue ; il ne permet pas
  de déduire automatiquement une catégorie A, B ou N.
agent_instruction: >
  Ne proposer 110&1M que si la première activité, les dates et la demande de neutralisation
  sont établies. Évaluer ensuite la composition complète du ménage ; ne jamais décider A, B ou N
  à partir de 110&1M seul, ni à son échéance.
red_flags:
  - rf_situation_familiale_ambigue
related_forms:
  - C1
related_topics:
  - chomage_complet
```

```yaml
rule_id: situation_familiale_revenu_enfant_contrat_etudiant
theme: situation_familiale
effective_from: unknown
source_name: ONEM — C1 feuille info, rubriques 15 et 16 (chômage)
source_url: https://www.onem.be/index.php/file/cc73d96153bbd5448a56f19d925d05b1379c7f21/448471413941904267f10257baa3afef967570c8/01-01-2024_c1-info_fr.pdf
base_legale: >
  C1-Info chômage, rubrique 16 : revenu brut professionnel de l'enfant, travail d'étudiant
  non compris. Source directe relue sans étendre l'exception aux droits sociaux ou fiscaux.
  Ancienne référence conservée pour provenance : C1 crédit-temps, version 24/05/2024,
  https://www.onem.be/file/cc73d96153bbd5448a56f19d925d05b1379c7f21/577956c3877236b0c91fa85d6bc06caa6b31bdd9/c1-ct-cct103ter-06-17-2024-05-24-fr.pdf.
last_verified: 2026-10-17
confidence: official
status: active
summary: >
  Lorsqu'un utilisateur déclare explicitement un contrat d'occupation d'étudiant pour un enfant,
  le montant est conservé mais n'est pas retenu pour l'examen du revenu professionnel de cet
  enfant au titre de l'article 110. Cette exception ne s'étend pas à une simple qualité
  d'étudiant ou à une autre forme de contrat.
agent_instruction: >
  Ne jamais déduire les allocations familiales, un quota d'heures, une qualification sociale ou
  fiscale, ni une catégorie familiale à partir du seul contrat. Conserver le montant déclaré et
  demander une précision pour toute autre activité.
red_flags:
  - rf_situation_familiale_ambigue
related_forms:
  - C1
related_topics:
  - chomage_complet
```

```yaml
rule_id: situation_familiale_composition_priorities
theme: situation_familiale
effective_from: unknown
source_name: ONEM — T147 « Quelle est votre situation familiale ? » et AR du 25/11/1991, art. 110
source_url: https://www.onem.be/citoyens/chomage-complet/a-combien-seleve-votre-allocation-/quelle-est-votre-situation-familiale-
base_legale: >
  AR du 25/11/1991, art. 110 ; AM du 26/11/1991, art. 59 à 64. La situation familiale se lit
  selon la composition entière du ménage, puis les conditions propres à la branche pertinente.
last_verified: 2026-10-08
confidence: official
status: active
summary: >
  Un conjoint ou partenaire reconnu est prioritaire sur les enfants, parents, alliés et tiers.
  Les enfants seuls constituent une branche distincte. Les compositions mixtes ne permettent pas
  de déduire une catégorie sans la règle spécifique correspondante.
agent_instruction: >
  Classer d'abord l'ensemble du ménage. Pour les branches non implémentées, demander une revue
  plutôt que de propager une catégorie obtenue dans une ancienne composition.
red_flags:
  - rf_situation_familiale_ambigue
related_forms:
  - C1
related_topics:
  - chomage_complet
```

```yaml
rule_id: situation_familiale_conjoint_revenu_am60
theme: situation_familiale
effective_from: unknown
source_name: ONEM / RioLex — AM du 26/11/1991, article 60
source_url: https://rvaonemtech.powerappsportals.com/fr-FR/wetsartikel/?id=26_11_1991-1-art_60&GoTo=true&materie=329720005&submaterie=100000000&juraard=0&articlenr=
base_legale: AM du 26/11/1991, art. 60, alinéas 2 et 3 ; AR du 25/11/1991, art. 110.
last_verified: 2026-10-08
confidence: official
status: deprecated
replaced_by: situation_familiale_conjoint_revenus_conditions_am60
summary: >
  L'examen du revenu professionnel d'un conjoint ou partenaire repose sur le plafond du barème
  publié et sur les caractéristiques établies de l'occupation. Un CDI à revenu fixe sous plafond
  relève de 60A ; un revenu variable reçoit le traitement de base B / 60B et nécessite le C110A
  pour apprécier le taux du mois. Un mois sous plafond peut être évalué au taux A sans changer ce
  traitement de base. Un CDD ne déclenche pas 60A sur la seule base d'un revenu fixe : il reste à
  vérifier avec l'organisme de paiement.
agent_instruction: >
  Description historique 60A/60B conservée, à ne plus appliquer pour conclure. Elle ne couvre
  pas exactement les contrats successifs, revenus mixtes et distinction catégorie/paiement.
  Lire situation_familiale_conjoint_revenus_conditions_am60 ; correspondance opérationnelle
  complète 60A/60B à vérifier séparément, sans faire du comportement livré une preuve légale.
red_flags:
  - rf_situation_familiale_ambigue
related_forms:
  - C1
related_topics:
  - chomage_complet
```

---

```yaml
rule_id: situation_familiale_third_parties
theme: situation_familiale
effective_from: unknown
# Ancienne date 2026-09-01 = mise à jour T147, pas effet établi de cette règle entière.
source_name: ONEM — T147 « Quelle est votre situation familiale ? »
source_url: https://www.onem.be/citoyens/chomage-complet/a-combien-seleve-votre-allocation-/quelle-est-votre-situation-familiale-
base_legale: AR du 25/11/1991, art. 110 ; AM du 26/11/1991, art. 59 à 64
base_legale_url: https://www.ejustice.just.fgov.be/eli/arrete/1991/11/25/1991013192/justel
last_verified: 2026-10-08
confidence: official
status: active
summary: >
  Avec des tiers, les allocations familiales d'un enfant ne suffisent que si aucun tiers ne
  possède de revenu professionnel ou de remplacement pertinent. Les tiers sans revenu pertinent
  n'empêchent pas à eux seuls l'examen de la branche enfant ou parent/allié.
agent_instruction: >
  Ne jamais assimiler un tiers à un partenaire. Une relation ou un revenu ambigu, ou une possible
  vie autonome en co-housing, impose une revue plutôt qu'une catégorie calculée.
related_forms:
  - C1
related_topics:
  - chomage_complet
```

```yaml
rule_id: situation_familiale_ascendants_pensions
theme: situation_familiale
effective_from: unknown
# Ancienne date 2026-09-01 = mise à jour T147, pas effet établi de cette règle entière.
source_name: ONEM — T147 « Quelle est votre situation familiale ? »
source_url: https://www.onem.be/citoyens/chomage-complet/a-combien-seleve-votre-allocation-/quelle-est-votre-situation-familiale-
base_legale: AR du 25/11/1991, art. 110 ; AM du 26/11/1991, art. 62
base_legale_url: https://www.ejustice.just.fgov.be/eli/arrete/1991/11/25/1991013192/justel
last_verified: 2026-10-08
confidence: official
status: active
summary: >
  Les allocations aux personnes handicapées ne sont jamais un revenu de remplacement.
  Les pensions brutes des ascendants sont cumulées avant comparaison au barème applicable ;
  le plafond spécial handicap exige une attestation SPF établissant le critère requis.
agent_instruction: >
  Ne jamais neutraliser une pension parce qu'une personne est handicapée. Lire les seuils
  datés dans AndereBedrWLH_AutresMontCHOM ; sans attestation ou sans montant brut complet,
  demander les documents ou une revue plutôt que d'appliquer le plafond spécial.
related_forms:
  - C1
related_topics:
  - chomage_complet
```

```yaml
rule_id: situation_familiale_children_only
theme: situation_familiale
effective_from: unknown
source_name: ONEM — T147 « Quelle est votre situation familiale ? »
source_url: https://www.onem.be/citoyens/chomage-complet/a-combien-seleve-votre-allocation-/quelle-est-votre-situation-familiale-
base_legale: AR du 25/11/1991, art. 110 (catégories familiales)
base_legale_url: https://www.ejustice.just.fgov.be/eli/arrete/1991/11/25/1991013192/justel
last_verified: 2026-10-08
confidence: official
status: active
summary: >
  Avec uniquement un ou plusieurs enfants, l'examen de la catégorie tient compte des droits
  aux allocations familiales et des revenus professionnels ou de remplacement pertinents.
  Un changement doit être déclaré même lorsqu'un autre enfant maintient la catégorie attendue.
agent_instruction: >
  Évaluer tous les enfants ensemble, sans déduire un code ONEM. Tracer séparément le changement
  de fait et la catégorie calculée ; la neutralisation 110&1M ne porte que sur l'enfant concerné.
related_forms:
  - C1
related_topics:
  - chomage_complet
```

```yaml
rule_id: situation_familiale_isole_pension_alimentaire
theme: situation_familiale
effective_from: unknown
source_name: ONEM — feuille info C1, rubrique 10
source_url: https://www.onem.be/index.php/file/cc73d96153bbd5448a56f19d925d05b1379c7f21/448471413941904267f10257baa3afef967570c8/01-01-2024_c1-info_fr.pdf
base_legale: AR du 25/11/1991, art. 110 (catégories familiales)
base_legale_url: https://www.ejustice.just.fgov.be/eli/arrete/1991/11/25/1991013192/justel
last_verified: 2026-10-08
confidence: official
status: active
summary: >
  Une personne habitant seule qui paie effectivement une pension alimentaire peut relever
  de la charge de famille lorsque l'obligation repose sur une décision judiciaire, un acte
  notarié de divorce, ou un acte notarié pour son enfant. Pour un enfant majeur, l'état de
  besoin doit être examiné par l'organisme de paiement.
agent_instruction: >
  Ne jamais fixer un code ONEM. Exiger la base juridique, le paiement effectif et la copie
  ou le statut de la pièce ; si la copie est attendue ou si l'enfant majeur est concerné,
  demander l'examen par l'organisme de paiement.
related_forms:
  - C1
related_topics:
  - chomage_complet
```

```yaml
rule_id: situation_familiale_isole_garde_alternee
theme: situation_familiale
effective_from: unknown
source_name: ONEM — feuille info C1 et T147
source_url: https://www.onem.be/citoyens/chomage-complet/a-combien-seleve-votre-allocation-/quelle-est-votre-situation-familiale-
last_verified: 2026-10-08
confidence: to_verify
status: to_verify
summary: >
  Une garde alternée requiert l'examen de la réalité et de la régularité de l'hébergement,
  des allocations familiales ou de l'absence de revenu pertinent de l'enfant. La source
  actuelle consultée ne permet pas de qualifier automatiquement un dossier individuel.
agent_instruction: >
  Décrire la piste à faire examiner sans aperçu de catégorie A/B/N ; toute information
  décisive absente ou contradictoire reste en revue ONEM, sans seuil pratique ni code officiel.
related_forms:
  - C1
related_topics:
  - chomage_complet
```

```yaml
rule_id: situation_familiale_cohousing_a_verifier
theme: situation_familiale
effective_from: unknown
source_name: ONEM — T147 et Annexe REGIS
source_url: https://www.onem.be/citoyens/chomage-complet/a-combien-seleve-votre-allocation-/quelle-est-votre-situation-familiale-
last_verified: 2026-10-08
confidence: to_verify
status: to_verify
summary: >
  Une même adresse ou une colocation ne suffit pas à qualifier une catégorie familiale.
  Les faits de vie autonome et la différence éventuelle avec les registres doivent être
  documentés et examinés par l'ONEM ou l'organisme de paiement.
agent_instruction: >
  Conserver la demande comme ISOLATED_CLAIM / NEEDS_ONEM_REVIEW, réutiliser l'Annexe REGIS
  lorsqu'elle est requise et reclasser hors du co-housing si un lien familial ou de couple est déclaré.
related_forms:
  - C1
  - C1-Annexe REGIS
related_topics:
  - chomage_complet
```

## Red flags spécifiques
- **Catégorie incertaine** (composition du ménage / revenus ambigus) → `rf_situation_familiale_ambigue`.
- **Demande de montant exact** liée à la catégorie → `rf_demande_montant_exact`.

## Situations ambiguës (exemples)
- Colocation où chacun a ses revenus : cohabitant ? isolé ? → demander la composition réelle,
  renvoyer à l'organisme de paiement.
- Parent séparé versant une pension alimentaire : possible « charge de famille » → à confirmer.
- Personne hébergée temporairement : statut variable → `a_verifier`.

## Phrase à intégrer dans les outils
> « Votre situation familiale peut influencer le montant de vos allocations et **doit être
> confirmée** auprès de votre organisme de paiement. »

## Ce qui reste « à vérifier »
- Couverture moteur de la qualification : à la base `41b24ad7`, le rôle déclaré `partner`
  suffit encore à déclencher la priorité (`household-composition.ts`, lignes 379 et 452).
  Ce lot ne corrige ni ce raccourci ni les adaptateurs historiques.
- Parents aux revenus inconnus, allocations familiales non renseignées et inventaires de
  revenus partiels : conserver l'inconnu et identifier les faits décisifs dans un lot dédié.
  Une ressource neutralisée connue ne prouve pas l'absence d'autres revenus.
- Correspondance complète 60A/60B, mois incomplet ou variable, contrats et cumuls complexes :
  sourcer et tester séparément la catégorie du mois, le traitement et le paiement mensuel.
- Pensions hors ascendants, revenus particuliers et situations spéciales de l'article 110 :
  règles dédiées nécessaires avant toute extension ; pas de résultat inventé dans ce lot.
- Garde alternée et co-housing restent `to_verify` ; pas de catégorie tirée du seul libellé,
  pas de N automatique après exclusion d'une personne, pas d'arrêt sur un fondement pension
  alimentaire invalide sans examiner les autres fondements pertinents.
- Barème absent pour la date de situation : ne bloque que les comparaisons qui en dépendent.
  Ne pas réutiliser par défaut les valeurs courantes pour une situation antérieure.

> **« Cet outil vous aide à vous orienter. Il ne remplace pas une décision de l'ONEM, de votre
> organisme de paiement ou d'un conseiller compétent. »**
