# Situation familiale (catégories) & formulaire C1

> **Thème :** `situation_familiale`. La situation familiale **influence la catégorie et le
> montant** des allocations. Elle est déclarée via le **C1**.
>
> ⚠️ **Catégorie à confirmer.** Les **définitions précises** des catégories (seuils de revenus
> du cohabitant, personnes à charge…) **n'ont pas pu être confirmées** sur une page ONEM
> accessible (page « catégorie familiale » en refonte lors de la vérification) → `to_verify`.

> **Note sur le nom de fichier.** Ce fichier couvre la situation familiale et le **C1**. La
> référence « T147 » du nom de fichier n'a **pas** été confirmée comme feuille info ONEM
> pertinente lors de la recherche : à vérifier (`TODO_SOURCE_OFFICIELLE`). La feuille info
> reliée aux catégories/montants est plutôt **T201** (montant après occupation).

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
source_name: ONEM — Quelle est ma catégorie familiale (page en refonte)
source_url: https://www.onem.be/fr/quelle-est-ma-categorie-familiale
last_verified: 2026-06-30
confidence: to_verify
status: to_verify
summary: >
  Définitions détaillées des catégories (chef de ménage / charge de famille, isolé, cohabitant)
  avec seuils de revenus et notion de personne à charge. Non confirmées sur une page officielle
  accessible (page en refonte / 404 lors de la vérification).
agent_instruction: >
  NE PAS trancher la catégorie d'une personne sur la base de définitions non confirmées. Expliquer
  les grandes catégories, demander la composition du ménage, et renvoyer vers l'organisme de
  paiement pour la qualification exacte (a_verifier).
red_flags:
  - rf_situation_familiale_ambigue
related_forms:
  - C1
related_topics:
  - chomage_complet
# TODO_SOURCE_OFFICIELLE : définitions complètes des catégories familiales + seuils de revenus du
# cohabitant (pages ONEM /fr/quelle-est-ma-categorie-familiale et /citoyens/... à revérifier après
# refonte du site).
```

```yaml
rule_id: situation_familiale_impact_montant
theme: situation_familiale
effective_from: 2026-03-01
source_name: ONEM — À combien s'élève votre allocation après une occupation (T201)
source_url: https://www.onem.be/page/a-combien-s-eleve-votre-allocation-de-chomage-apres-une-occupation---situation-a-partir-du-01.03.2026-
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

---

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
