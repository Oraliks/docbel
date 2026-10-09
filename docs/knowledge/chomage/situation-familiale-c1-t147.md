# Situation familiale (catégories) & formulaire C1

> **Thème :** `situation_familiale`. La situation familiale **influence la catégorie et le
> montant** des allocations. Elle est déclarée via le **C1**.
>
> **Source pratique actuelle.** L'ONEM publie la feuille info **T147 — « Quelle est votre
> situation familiale ? »**, mise à jour le **01/09/2026**. Elle couvre les catégories, les
> personnes cohabitantes, la pension alimentaire, les revenus et les ressources. Cette phase
> actualise la source ; elle ne transforme pas son contenu en qualification automatique.

> **Référence.** <https://www.onem.be/citoyens/chomage-complet/a-combien-seleve-votre-allocation-/quelle-est-votre-situation-familiale->
> (T147, vérifiée le 08/10/2026). T201 reste la source liée aux montants après occupation.

---

## Rôle de la situation familiale
À partir de la 2e période d'indemnisation (chômage complet), le montant devient **forfaitaire**
et dépend de la **catégorie familiale** (et non plus du dernier salaire). La catégorie influence
donc directement ce que la personne perçoit.

## Catégories à documenter avec prudence
Trois grandes catégories (codes ONEM **A / N / B**), hiérarchie de montant **A > N > B** :

- **Chef de ménage / charge de famille (catégorie A)** : cohabite avec une ou plusieurs
  personnes **à charge** (ou paie une pension alimentaire en tant qu'isolé). Montant le plus
  élevé.
- **Isolé (catégorie N)** : vit **effectivement seul**.
- **Cohabitant (catégorie B)** : vit avec une ou plusieurs personnes disposant de revenus ;
  ni chef de ménage ni isolé. Montant le plus bas.

> Les **définitions complètes** (notamment les seuils de revenus du cohabitant/partenaire et la
> notion de « personne à charge ») **doivent être confirmées** auprès de l'ONEM / de l'organisme
> de paiement : elles n'ont pas été lues sur une page officielle accessible.

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
status: to_verify
summary: >
  Définitions détaillées des catégories (chef de ménage / charge de famille, isolé, cohabitant)
  avec personnes cohabitantes, revenus et notion de personne à charge. Base légale = AR art. 110 +
  AM art. 59-63. La source est vérifiée, mais aucune qualification individuelle n'est implémentée.
agent_instruction: >
  NE PAS trancher la catégorie d'une personne sur la base des seuils chiffrés non confirmés.
  Expliquer les grandes catégories (définitions AR art. 110), demander la composition du ménage,
  et renvoyer vers l'organisme de paiement pour la qualification exacte (a_verifier).
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
status: active
summary: >
  L'examen du revenu professionnel d'un conjoint ou partenaire repose sur le plafond du barème
  publié et sur les caractéristiques établies de l'occupation. Un CDI à revenu fixe sous plafond
  relève de 60A ; un revenu variable reçoit le traitement de base B / 60B et nécessite le C110A
  pour apprécier le taux du mois. Un mois sous plafond peut être évalué au taux A sans changer ce
  traitement de base. Un CDD ne déclenche pas 60A sur la seule base d'un revenu fixe : il reste à
  vérifier avec l'organisme de paiement.
agent_instruction: >
  Le C110A officiel est demandé comme document externe, sans créer un faux formulaire DocBel.
  Sans barème, montant, contrat ou caractère fixe/variable, produire une revue à vérifier.
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
effective_from: 2026-09-01
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
effective_from: 2026-09-01
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
  Ne proposer qu'une possibilité de catégorie A à confirmer ; toute information absente ou
  contradictoire reste en revue ONEM, sans seuil pratique ni code officiel.
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
- Définitions juridiques complètes des catégories + seuils de revenus du cohabitant.
- Montants forfaitaires par catégorie (barème ONEM en refonte ; cf. calculateur).
- Nature exacte d'une éventuelle feuille info « T147 ».

> **« Cet outil vous aide à vous orienter. Il ne remplace pas une décision de l'ONEM, de votre
> organisme de paiement ou d'un conseiller compétent. »**
