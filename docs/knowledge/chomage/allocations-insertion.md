# Allocations d'insertion (chômage après les études)

> **Thème :** `allocations_insertion`. Régime documenté = **première demande à partir du
> 01/03/2026** (feuille info ONEM **T199**). À ne **pas** confondre avec le chômage complet
> « après une occupation ».

---

## Définition vulgarisée
Les **allocations d'insertion** peuvent être accordées à un **jeune après ses études**, sous
conditions, une fois accompli un **stage d'insertion** (période d'attente). Elles ne supposent
pas d'avoir suffisamment travaillé (contrairement au chômage complet).

## Public concerné
- Jeunes effectuant une **première demande** d'allocations d'insertion **à partir du 01/03/2026**.
- Les personnes déjà indemnisées avant cette date relèvent de **mesures transitoires**
  (suppression progressive en plusieurs vagues — `a_verifier`).

## Lien avec études / stage d'insertion
- **Stage d'insertion** = **156 jours** (dimanches non compris), soit environ 6 mois, quel que
  soit l'âge (réduit pour les formations en alternance). *(Ancien régime : 310 jours.)*
- **Deux évaluations positives** du comportement de recherche d'emploi sont requises avant
  l'octroi (par le service régional de l'emploi).

## Impact de la réforme 2026
- Durée **limitée à 12 mois** (auparavant 36 mois) → règle `allocations_insertion_duree_12m_2026`.
- Prolongation **variable** possible (durée égale aux périodes de travail / événements
  assimilés) → `allocations_insertion_prolongation_variable`.

## Formulaires probables
- **C109/36-DEMANDE** (demande), **C109/36-diplôme** (preuve de diplôme), **C36.3** (autorisation
  liée à une formation/stage à l'étranger). Voir [`formulaires-onem.md`](formulaires-onem.md).

## Données nécessaires
- **Âge** (condition < 25 ans), **diplôme/certificat** reconnu, **fin des études**, **stage
  d'insertion** accompli, **évaluations** régionales, **région** d'inscription.

---

## Règles

```yaml
rule_id: allocations_insertion_duree_12m_2026
theme: allocations_insertion
effective_from: 2026-03-01
source_name: ONEM — Feuille info T199
source_url: https://www.onem.be/page/avez-vous-droit-aux-allocations-apres-des-etudes-allocations-dinsertion-et-pendant-combien-de-temps
base_legale: >
  AR du 25/11/1991, art. 36quater (allocations de stage / d'insertion) et art. 124 (montant). La
  limitation à 12 mois découle de la réforme 2026 : Loi-programme du 18/07/2025, art. 209-216
  (M.B. 29/07/2025). Textes consolidés publics : ejustice.just.fgov.be (Justel, numac 1991013192
  pour l'AR, 2025005578 pour la loi-programme). Aussi dans RioLex.
base_legale_url: https://www.ejustice.just.fgov.be/eli/arrete/1991/11/25/1991013192/justel
last_verified: 2026-06-30
confidence: official
status: active
summary: >
  Le droit aux allocations d'insertion est limité à 1 an (12 mois) maximum. Exemple officiel
  ONEM : bénéfice à partir du 01.09.2026 => droit jusqu'au 31.08.2027.
agent_instruction: >
  Distinguer du chômage complet (24 mois). Ne pas annoncer une fin de droit individuelle :
  a_verifier dès qu'une fin de droit est en jeu (rf_fin_de_droit).
red_flags:
  - rf_fin_de_droit
related_forms:
  - C109/36
related_topics:
  - reforme_2026
```

```yaml
rule_id: allocations_insertion_prolongation_variable
theme: allocations_insertion
effective_from: 2026-03-01
source_name: ONEM — Feuille info T199
source_url: https://www.onem.be/page/avez-vous-droit-aux-allocations-apres-des-etudes-allocations-dinsertion-et-pendant-combien-de-temps
last_verified: 2026-06-30
confidence: official
status: active
summary: >
  La période de 12 mois peut être prolongée d'une durée ÉGALE aux périodes de travail (temps
  plein, temps partiel avec maintien des droits) ou d'événements assimilés (maternité, accident,
  maladie) survenus pendant la période d'indemnisation. Ce n'est PAS un forfait fixe.
agent_instruction: >
  Ne pas présenter de durée de prolongation forfaitaire (ex. « 6 mois ») : la prolongation est
  variable. En cas de question précise, a_verifier + organisme de paiement.
red_flags: []
related_forms: []
related_topics:
  - allocations_insertion
# NOTE : une formulation « +6 mois si 156 jours de travail sur 24 mois » a été RÉFUTÉE lors de la
# vérification — ne pas la réintroduire sans texte réglementaire la confirmant.
```

```yaml
rule_id: allocations_insertion_stage_156j
theme: allocations_insertion
effective_from: 2026-03-01
source_name: ONEM — Feuille info T199
source_url: https://www.onem.be/page/avez-vous-droit-aux-allocations-apres-des-etudes-allocations-dinsertion-et-pendant-combien-de-temps
base_legale: >
  AR du 25/11/1991, art. 36 (stage d'insertion professionnelle). Texte consolidé public :
  ejustice.just.fgov.be (Justel, numac 1991013192). Aussi dans RioLex.
base_legale_url: https://www.ejustice.just.fgov.be/eli/arrete/1991/11/25/1991013192/justel
last_verified: 2026-06-30
confidence: official
status: active
summary: >
  Le stage d'insertion professionnelle dure 156 jours (dimanches non compris), environ 6 mois,
  quel que soit l'âge ; réduit pour les formations en alternance. (Ancien régime : 310 jours.)
agent_instruction: >
  Ne pas confondre les 156 jours du stage avec une condition de prolongation. Expliquer que les
  allocations ne sont versées qu'après le stage et 2 évaluations positives.
red_flags: []
related_forms: []
related_topics:
  - allocations_insertion
```

```yaml
rule_id: allocations_insertion_condition_age_25
theme: allocations_insertion
effective_from: 2026-03-01
source_name: ONEM — Feuille info T199
source_url: https://www.onem.be/page/avez-vous-droit-aux-allocations-apres-des-etudes-allocations-dinsertion-et-pendant-combien-de-temps
base_legale: >
  AR du 25/11/1991, art. 36 (conditions d'octroi des allocations d'insertion, dont la condition
  d'âge). Texte consolidé public : ejustice.just.fgov.be (Justel, numac 1991013192). Aussi dans RioLex.
base_legale_url: https://www.ejustice.just.fgov.be/eli/arrete/1991/11/25/1991013192/justel
last_verified: 2026-06-30
confidence: official
status: active
summary: >
  Il faut ne pas avoir atteint l'âge de 25 ans au moment de la demande (exceptions possibles :
  travail ou force majeure ayant empêché une demande antérieure).
agent_instruction: >
  Si la personne a 25 ans ou plus, signaler que l'allocation d'insertion est en principe fermée,
  sauf exception ; a_verifier + organisme de paiement.
red_flags: []
related_forms: []
related_topics:
  - allocations_insertion
```

```yaml
rule_id: allocations_insertion_condition_diplome
theme: allocations_insertion
effective_from: 2026-03-01
source_name: ONEM — Feuille info T199
source_url: https://www.onem.be/page/avez-vous-droit-aux-allocations-apres-des-etudes-allocations-dinsertion-et-pendant-combien-de-temps
base_legale: >
  AR du 25/11/1991, art. 36 (conditions d'octroi, dont la condition de diplôme/études). Texte
  consolidé public : ejustice.just.fgov.be (Justel, numac 1991013192). Aussi dans RioLex. NB : la
  distinction éventuelle pour les < 21 ans reste non confirmée (voir TODO ci-dessous).
base_legale_url: https://www.ejustice.just.fgov.be/eli/arrete/1991/11/25/1991013192/justel
last_verified: 2026-06-30
confidence: official
status: active
summary: >
  Il faut posséder un diplôme, certificat ou attestation reconnu (condition de diplôme uniforme
  quel que soit l'âge ; diplômes étrangers acceptés sous conditions).
agent_instruction: >
  Demander quel diplôme/certificat. Ne pas affirmer de condition spécifique aux moins de 21 ans
  (non confirmée dans le régime 2026).
red_flags: []
related_forms:
  - C109/36
related_topics:
  - allocations_insertion
# TODO_SOURCE_OFFICIELLE : une éventuelle condition de diplôme distincte pour les < 21 ans dans le
# régime 2026 n'est PAS confirmée (T199 indique une condition uniforme).
```

```yaml
rule_id: allocations_insertion_deux_evaluations
theme: allocations_insertion
effective_from: 2026-03-01
source_name: ONEM — Feuille info T199
source_url: https://www.onem.be/page/avez-vous-droit-aux-allocations-apres-des-etudes-allocations-dinsertion-et-pendant-combien-de-temps
last_verified: 2026-06-30
confidence: official
status: active
summary: >
  Deux évaluations positives du comportement de recherche d'emploi (par le service régional de
  l'emploi) sont requises avant le versement des allocations d'insertion.
agent_instruction: >
  Relier à l'inscription régionale (Actiris/Forem/VDAB/ADG). Expliquer que l'octroi n'est pas
  automatique à la fin du stage.
red_flags: []
related_forms: []
related_topics:
  - organismes_regionaux
```

```yaml
rule_id: allocations_insertion_ancien_regime_310j_36m
theme: allocations_insertion
effective_from: 2012-01-01
source_name: ONEM — Nouveau régime pour les jeunes sortant des études (2012)
source_url: https://www.onem.be/page/nouveau-regime-pour-les-jeunes-sortant-des-etudes
last_verified: 2026-06-30
confidence: official
status: deprecated
summary: >
  Régime ANTÉRIEUR à la réforme 2026 : stage de 310 jours quel que soit l'âge ; allocations pour
  36 mois maximum. Renommage « allocations/stage d'insertion » (ex-« allocations/stage d'attente »)
  au 01/01/2012.
agent_instruction: >
  Ne s'applique PAS aux premières demandes à partir du 01/03/2026. Utile uniquement pour
  comprendre l'historique ou des situations transitoires (a_verifier).
red_flags:
  - rf_mesure_transitoire
related_forms: []
related_topics:
  - reforme_2026
```

---

## Red flags spécifiques
- **Fin de droit** après limitation 2026 → `rf_fin_de_droit`.
- **Jeune après études** dont la date de 1re demande encadre avant/après 01/03/2026 →
  `rf_depend_reforme_2026`.
- **25 ans ou plus** → vérifier l'exception ; sinon orienter ailleurs.

## Exemples d'orientation
- *« J'ai fini mes études, je n'ai jamais travaillé, à quoi ai-je droit ? »* → allocation
  d'insertion (stage 156 j, < 25 ans, diplôme, 2 évaluations) ; inscription régionale ;
  `pertinent` (souvent infos manquantes : diplôme, dates).
- *« Combien de temps vais-je toucher ? »* → 12 mois max, prolongation variable ; `a_verifier`
  sur la durée individuelle.

## Ce qui reste « à vérifier »
- Montant brut des allocations d'insertion selon âge/situation familiale (non extrait).
- Liste exhaustive des événements assimilés ouvrant droit à prolongation.
- Mesures transitoires détaillées (suppression en vagues) pour les indemnisés avant 01/03/2026.

> **« Cet outil vous aide à vous orienter. Il ne remplace pas une décision de l'ONEM, de votre
> organisme de paiement ou d'un conseiller compétent. »**
