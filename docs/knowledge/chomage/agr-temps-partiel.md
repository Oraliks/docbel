# Temps partiel & AGR (Allocation de Garantie de Revenus)

> **Thème :** `agr_temps_partiel`. Régime **distinct** du chômage complet et de l'insertion.
> **Ne jamais mélanger** avec ces régimes dans un même verdict.
>
> ⚠️ **Pas de calcul définitif.** Le montant de l'AGR dépend d'une formule officielle non
> reproduite ici. Toute estimation chiffrée doit venir d'une source officielle / d'un outil
> dédié, jamais d'un calcul improvisé.

---

## Définition vulgarisée de l'AGR
L'**Allocation de Garantie de Revenus (AGR)** est un **complément** versé par l'ONEM à un
**travailleur à temps partiel avec maintien des droits (TPMD)** : elle complète la rémunération
du temps partiel pour **garantir un revenu global** au moins égal à l'allocation de chômage
(si l'emploi ne dépasse pas 1/3 temps) et supérieur à celle-ci (si l'emploi dépasse 1/3 temps).

## Différence temps plein / temps partiel
- **Temps plein** : pas d'AGR (on est soit en emploi, soit au chômage complet).
- **Temps partiel involontaire avec maintien des droits** : on peut, sous conditions, **cumuler**
  un salaire à temps partiel et une AGR, tout en restant demandeur d'emploi **à temps plein**.

## Maintien des droits (TPMD)
- Rester **inscrit comme demandeur d'emploi à temps plein** et **disponible** pour un temps plein.
- Demander à l'employeur un **temps plein** s'il se libère ; demander l'adaptation du contrat en
  cas d'heures supplémentaires régulières.

## Données nécessaires
- **Régime horaire** (fraction du temps plein ; seuil 1/3 = 55 h/mois sur base 38 h/sem).
- **Salaire** à temps partiel.
- **Caractère involontaire** du passage à temps partiel (le passage volontaire est exclu, sauf
  plan de restructuration approuvé).
- **Situation chômage antérieure** (droits ouverts), **rémunération encore due** éventuelle
  (préavis/indemnité).

---

## Règles

```yaml
rule_id: agr_definition
theme: agr_temps_partiel
effective_from: 2026-03-01
source_name: ONEM — Avez-vous droit à l'allocation de garantie de revenus ?
source_url: https://www.onem.be/citoyens/travail-a-temps-partiel/avez-vous-droit-a-l-allocation-de-garantie-de-revenus-
base_legale: >
  AR du 25/11/1991, art. 131bis (allocation de garantie de revenus). Texte consolidé public :
  ejustice.just.fgov.be (Justel, numac 1991013192). Aussi dans RioLex. La formule de calcul
  détaillée reste a_verifier (voir montants_2026 ci-dessous).
base_legale_url: https://www.ejustice.just.fgov.be/eli/arrete/1991/11/25/1991013192/justel
last_verified: 2026-06-30
confidence: official
status: active
summary: >
  L'AGR complète la rémunération d'un travail à temps partiel pour garantir un revenu global au
  moins égal à l'allocation de chômage (emploi ≤ 1/3 temps) ou supérieur (emploi > 1/3 temps),
  pour un travailleur à temps partiel avec maintien des droits.
agent_instruction: >
  Présenter l'AGR comme un complément possible, jamais comme un droit acquis. Ne pas chiffrer le
  montant. Renvoyer vers l'ONEM/organisme de paiement et, le cas échéant, l'outil de calcul dédié.
red_flags:
  - rf_temps_partiel_maintien_droits
  - rf_demande_montant_exact
related_forms: []
related_topics:
  - chomage_complet
```

```yaml
rule_id: agr_plafond_4_5
theme: agr_temps_partiel
effective_from: 2026-03-01
source_name: ONEM — AGR
source_url: https://www.onem.be/citoyens/travail-a-temps-partiel/avez-vous-droit-a-l-allocation-de-garantie-de-revenus-
last_verified: 2026-06-30
confidence: official
status: active
summary: >
  Pour avoir droit à l'AGR, l'horaire contractuel moyen ne doit pas dépasser 4/5 d'un horaire à
  temps plein.
agent_instruction: >
  Si l'horaire dépasse 4/5, signaler que l'AGR est en principe fermée. Demander la fraction
  horaire si elle est inconnue.
red_flags: []
related_forms: []
related_topics:
  - agr_temps_partiel
```

```yaml
rule_id: agr_seuil_tiers_temps_55h
theme: agr_temps_partiel
effective_from: 2026-03-01
source_name: ONEM — AGR
source_url: https://www.onem.be/citoyens/travail-a-temps-partiel/avez-vous-droit-a-l-allocation-de-garantie-de-revenus-
last_verified: 2026-06-30
confidence: official
status: active
summary: >
  Le seuil « 1/3 temps » équivaut à 55 heures par mois (base 38 h/semaine). Il sert à distinguer
  les régimes de garantie (≤ 1/3 vs > 1/3).
agent_instruction: >
  Utiliser pour situer la personne par rapport au seuil 1/3, sans calculer le montant final.
red_flags: []
related_forms: []
related_topics:
  - agr_temps_partiel
```

```yaml
rule_id: agr_tpmd_inscription
theme: agr_temps_partiel
effective_from: 2026-03-01
source_name: ONEM — AGR
source_url: https://www.onem.be/citoyens/travail-a-temps-partiel/avez-vous-droit-a-l-allocation-de-garantie-de-revenus-
base_legale: >
  AR du 25/11/1991, art. 104 et 129bis (travailleur à temps partiel avec maintien des droits /
  compléments) et art. 131bis (AGR). Texte consolidé public : ejustice.just.fgov.be (Justel,
  numac 1991013192). Aussi dans RioLex. Conditions fines TPMD (T70/T71) restent a_verifier.
base_legale_url: https://www.ejustice.just.fgov.be/eli/arrete/1991/11/25/1991013192/justel
last_verified: 2026-06-30
confidence: official
status: active
summary: >
  Le travailleur à temps partiel avec maintien des droits doit rester inscrit comme demandeur
  d'emploi à temps plein, être disponible pour un temps plein, et demander un temps plein qui se
  libérerait chez l'employeur.
agent_instruction: >
  Rappeler l'obligation de rester demandeur d'emploi à temps plein. Détails TPMD = feuilles info
  T70/T71 (non chargées lors de la vérification) → a_verifier sur les conditions fines.
red_flags:
  - rf_temps_partiel_maintien_droits
related_forms: []
related_topics:
  - organismes_regionaux
# TODO_SOURCE_OFFICIELLE : conditions détaillées du TPMD (feuilles info T70/T71, pages en refonte).
```

```yaml
rule_id: agr_exclusions
theme: agr_temps_partiel
effective_from: 2026-03-01
source_name: ONEM — AGR
source_url: https://www.onem.be/citoyens/travail-a-temps-partiel/avez-vous-droit-a-l-allocation-de-garantie-de-revenus-
last_verified: 2026-06-30
confidence: official
status: active
summary: >
  Pas de droit à l'AGR si une rémunération est encore due par l'employeur précédent (préavis /
  indemnité de rupture). Le passage volontaire d'un temps plein à un temps partiel est exclu
  (sauf plan de restructuration approuvé) ; un délai de carence de 3 mois s'applique au passage
  involontaire temps plein -> temps partiel.
agent_instruction: >
  Vérifier le caractère involontaire et l'absence de rémunération due. Modalités exactes du délai
  de 3 mois non détaillées → a_verifier.
red_flags:
  - rf_temps_partiel_maintien_droits
related_forms: []
related_topics:
  - agr_temps_partiel
# TODO_SOURCE_OFFICIELLE : modalités précises du délai de carence de 3 mois (T70/T71).
```

```yaml
rule_id: agr_montants_2026
theme: agr_temps_partiel
effective_from: 2026-03-01
source_name: ONEM — AGR (montants valables à partir du 01.03.2026)
source_url: https://www.onem.be/citoyens/travail-a-temps-partiel/avez-vous-droit-a-l-allocation-de-garantie-de-revenus-
last_verified: 2026-06-30
confidence: official
status: active
summary: >
  Des montants de référence existent (ex. revenu mensuel brut maximum, supplément horaire,
  montant minimum), indexés et susceptibles d'évoluer. Ils ne permettent PAS de calculer l'AGR
  sans la formule officielle complète.
agent_instruction: >
  NE PAS recopier ni recalculer l'AGR à partir de montants partiels. Toute estimation doit venir
  d'une source officielle ou d'un outil dédié. Pour un chiffre, a_verifier + renvoi ONEM.
red_flags:
  - rf_demande_montant_exact
related_forms: []
related_topics:
  - agr_temps_partiel
# TODO_SOURCE_OFFICIELLE : formule de calcul complète de l'AGR (allocation journalière de
# référence, demi-allocation, conversion 4/5 en heures/mois). Montants indexés à revérifier.
```

---

## Red flags spécifiques
- **Temps partiel avec maintien des droits** mélangé au chômage complet → traiter séparément
  (`rf_temps_partiel_maintien_droits`).
- **Demande de montant exact** d'AGR → `rf_demande_montant_exact`.
- **Activité accessoire / indépendant** en plus → `rf_activite_accessoire`, `rf_situation_hybride`.

## Interdiction de conclure sans données complètes
Sans **fraction horaire**, **salaire**, **caractère involontaire** et **situation chômage
antérieure**, l'agent **ne conclut pas** sur le droit à l'AGR ni sur son montant : `a_verifier`.

## Exemples d'orientation
- *« J'ai accepté un mi-temps après avoir perdu mon temps plein, ai-je droit à un complément ? »*
  → AGR possible si TPMD et passage involontaire ; demander la fraction horaire et le salaire ;
  `pertinent`/`a_verifier`.
- *« Combien d'AGR vais-je toucher ? »* → `a_verifier` ; renvoyer ONEM / outil dédié.

> **« Cet outil vous aide à vous orienter. Il ne remplace pas une décision de l'ONEM, de votre
> organisme de paiement ou d'un conseiller compétent. »**
