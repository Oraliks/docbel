# Chômage complet (après une occupation)

> **Thème :** `chomage_complet`. Régime documenté ici = **situation à partir du 01/03/2026**
> (feuilles info ONEM **T200** / **T201**). Pour la limitation dans le temps, voir
> [`reforme-2026.md`](reforme-2026.md).
>
> ⚠️ **Aucun montant garanti.** Les montants viennent du moteur
> [`lib/calculators/chomage.ts`](../../../lib/calculators/chomage.ts) et restent des
> **estimations**. Les fichiers `knowledge/` décrivent les règles d'**orientation**, pas les barèmes.

---

## Définition vulgarisée
Le **chômage complet** concerne une personne **sans emploi** qui demande des allocations après
avoir travaillé (le lien avec l'employeur est rompu), par opposition au **chômage temporaire**
(le contrat continue). On parle ici de la situation « **après une occupation** » salariée.

## Situations typiques
- Fin d'un contrat (licenciement, fin de CDD, rupture…) → demande d'allocations.
- Personne déjà au chômage complet qui s'interroge sur la durée / le montant.
- Reprise puis nouvelle perte d'emploi.

## Données nécessaires (pour orienter)
- Date de fin de contrat et **date de début du chômage** (avant/après 01/03/2026).
- **Passé professionnel** (jours/temps de travail, période de référence).
- **Âge**, **situation familiale**, **région** (inscription régionale).
- **Organisme de paiement** choisi (CAPAC / syndicat).
- Documents en main : **C4** (de l'employeur), **C1** (à compléter).

## Formulaires probables
- **C4** — certificat de chômage remis par l'employeur (voir [`formulaires-onem.md`](formulaires-onem.md)).
- **C1** — déclaration de la situation personnelle et familiale (voir
  [`situation-familiale-c1-t147.md`](situation-familiale-c1-t147.md)).
- Carte de contrôle **eC3** (chômage complet — distincte de l'eC3.2 du temporaire).

## Lien avec la réforme 2026
- Limitation à **24 mois maximum** (12 + jusqu'à 12) → `chomage_complet_limitation_2026`
  (dans `reforme-2026.md`).
- Exemptions possibles → `reforme_2026_exemptions_limitation`.
- Arrêt de la dégressivité (55 ans / 33 % / passé pro) → `chomage_complet_degressivite_exceptions`.

---

## Règles

```yaml
rule_id: chomage_complet_admission_312j_36m
theme: chomage_complet
effective_from: 2026-03-01
source_name: ONEM — Feuille info T200 (allocations après une occupation, à partir du 01.03.2026)
source_url: https://www.onem.be/page/avez-vous-droit-aux-allocations-de-chomage-apres-une-occupation---situation-a-partir-du-01.03.2026-
last_verified: 2026-06-30
confidence: official
status: active
summary: >
  Pour être admis, il faut prouver 312 jours de travail et/ou jours assimilés sur une période de
  référence (éventuellement prolongée) de 36 mois, et ce quel que soit l'âge (plus de tranches
  d'âge différenciées).
agent_instruction: >
  Si le passé professionnel est inconnu/incomplet, ne pas conclure à l'admission : a_verifier
  (rf_passe_pro_incomplet). Présenter « 312 jours / 36 mois » comme la condition générale, à
  confirmer auprès de l'organisme de paiement.
red_flags:
  - rf_passe_pro_incomplet
related_forms:
  - C4
related_topics:
  - reforme_2026
```

```yaml
rule_id: chomage_complet_jours_assimiles
theme: chomage_complet
effective_from: 2026-03-01
source_name: ONEM — Feuille info T200
source_url: https://www.onem.be/page/avez-vous-droit-aux-allocations-de-chomage-apres-une-occupation---situation-a-partir-du-01.03.2026-
last_verified: 2026-06-30
confidence: official
status: active
summary: >
  Les jours de travail = jours salariés rémunérés avec cotisations de sécurité sociale (le
  travail indépendant ne compte pas). Jours assimilés : vacances couvertes par le pécule, jours
  fériés/repos compensatoire payés, incapacité couverte par salaire garanti ou indemnité, congés
  maternité/naissance/adoption, chômage temporaire indemnisé, grève/lock-out, etc. Nuance : la
  maladie SANS salaire garanti ni indemnité ne compte plus comme jour assimilé.
agent_instruction: >
  Sert à expliquer pourquoi le décompte de 312 jours est complexe. Ne pas faire le calcul à la
  place de l'organisme de paiement ; renvoyer vers lui en cas de doute.
red_flags:
  - rf_passe_pro_incomplet
related_forms: []
related_topics:
  - chomage_complet
```

```yaml
rule_id: chomage_complet_periode_reference_prolongation
theme: chomage_complet
effective_from: 2026-03-01
source_name: ONEM — Feuille info T200
source_url: https://www.onem.be/page/avez-vous-droit-aux-allocations-de-chomage-apres-une-occupation---situation-a-partir-du-01.03.2026-
last_verified: 2026-06-30
confidence: official
status: active
summary: >
  La période de référence de 36 mois peut être prolongée (maladie/accident indemnisés sauf
  maternité, périodes de 3 mois et plus en occupation non couverte type indépendant/fonction
  publique, interruptions de carrière avec allocations, détention), sans excéder 15 ans au total.
agent_instruction: >
  Utile pour les parcours atypiques (maladie, indépendance, étranger). Le barème détaillé par cas
  n'est pas documenté ici : si la prolongation est déterminante, a_verifier + organisme de paiement.
red_flags:
  - rf_passe_pro_incomplet
  - rf_retour_apres_maladie_invalidite
related_forms: []
related_topics:
  - chomage_complet
# TODO_SOURCE_OFFICIELLE : barème détaillé des cas/durées de prolongation (T200 liste les types
# et un plafond de 15 ans, sans détail par cas).
```

```yaml
rule_id: chomage_complet_degressivite_structure
theme: chomage_complet
effective_from: 2026-03-01
source_name: ONEM — À combien s'élève votre allocation après une occupation (à partir du 01.03.2026) (T201)
source_url: https://www.onem.be/page/a-combien-s-eleve-votre-allocation-de-chomage-apres-une-occupation---situation-a-partir-du-01.03.2026-
last_verified: 2026-06-30
confidence: official
status: active
summary: >
  Structure de l'indemnisation : 1re période de 12 mois, dégressive en 3 phases (≈ mois 1-3 :
  65 % du dernier salaire plafonné ; mois 4-6 et 7-12 : 60 % avec plafonds décroissants) ; puis
  2e période de maximum 12 mois sous forme d'allocation FORFAITAIRE dépendant de la catégorie
  familiale (et non plus du dernier salaire).
agent_instruction: >
  Décrire UNIQUEMENT la structure (phases dégressives puis forfait familial). Ne JAMAIS afficher
  les montants en euros depuis ce fichier : ils sont indexés et viennent du calculateur
  (lib/calculators/chomage.ts) ou de l'ONEM. Toute demande de montant exact = estimation au mieux,
  sinon a_verifier (rf_demande_montant_exact).
red_flags:
  - rf_demande_montant_exact
related_forms: []
related_topics:
  - situation_familiale
  - reforme_2026
# TODO_SOURCE_OFFICIELLE : table des montants journaliers MAXIMUM par catégorie/phase
# (la page ONEM des barèmes dédiée était en refonte lors de la vérification).
```

> **Demande & catégories familiales.** La procédure de demande (C4 + C1, organisme de paiement)
> et les catégories familiales (A/N/B) sont documentées dans
> [`formulaires-onem.md`](formulaires-onem.md) et
> [`situation-familiale-c1-t147.md`](situation-familiale-c1-t147.md) — voir les règles
> `chomage_complet_procedure_demande`, `formulaire_c1`, `formulaire_c4`,
> `situation_familiale_categories`.

---

## Red flags spécifiques
- **Fin de droit** potentielle → `rf_fin_de_droit` (toujours `a_verifier`).
- **Passé pro incomplet** → `rf_passe_pro_incomplet`.
- **Sanction / motif grave** (licenciement pour motif grave, abandon d'emploi) → `rf_motif_grave`,
  `rf_sanction_exclusion_radiation`.
- **Demande de montant exact** → `rf_demande_montant_exact`.

## Exemples d'orientation
- *« J'ai reçu mon C4, je veux le chômage »* → orienter vers la demande après occupation
  (C4 + C1 chez un organisme de paiement) ; rappeler l'inscription comme demandeur d'emploi ;
  `recommande` si la situation est claire, `pertinent` si des infos manquent.
- *« Combien je vais toucher et pendant combien de temps ? »* → expliquer la structure
  (dégressivité, limitation 24 mois) **sans chiffrer**, renvoyer au calculateur/ONEM ;
  `a_verifier` sur les montants et la durée.

## Ce qui reste « à vérifier »
- Montants maximum par catégorie familiale et par phase (barème ONEM en refonte).
- Calcul des mois supplémentaires (réforme) — cf. `reforme-2026.md`.
- Règles anti-abus / durée minimale du dernier contrat dans le nouveau régime (non confirmées).

> **« Cet outil vous aide à vous orienter. Il ne remplace pas une décision de l'ONEM, de votre
> organisme de paiement ou d'un conseiller compétent. »**
