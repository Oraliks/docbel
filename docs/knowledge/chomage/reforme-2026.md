# Réforme du chômage 2026

> **Thème :** `reforme_2026`. Réforme entrée en vigueur le **1er mars 2026**.
> Source de référence projet : la page publique [`/reforme-chomage-2026`](../../../app/reforme-chomage-2026/page.tsx)
> (informatif, ne calcule pas les droits).
>
> ⚠️ **Sujet sensible et mouvant.** Le **principe** des règles ci-dessous est confirmé sur
> ONEM, mais plusieurs **détails chiffrés** (barème des mois supplémentaires, dates exactes
> de fin de droit par vague) **ne sont pas confirmés ligne par ligne** et restent
> `TODO_SOURCE_OFFICIELLE`. Toute **fin de droit** se traite en `a_verifier`.

---

## En une phrase (pour l'utilisateur)

Depuis le 1er mars 2026, les allocations de chômage ne sont **plus illimitées dans le temps** :
le chômage complet est plafonné à **24 mois maximum** et les allocations d'insertion à
**1 an maximum**, avec des **exceptions** et des **mesures transitoires** pour les personnes
déjà indemnisées. Les conséquences exactes dépendent de votre situation et **doivent être
confirmées auprès de l'ONEM ou de votre organisme de paiement**.

## Entrée en vigueur
- **Période transitoire** débutée le **01/07/2025**.
- **Nouvelles règles** applicables aux demandes dont la **date d'admission est à partir du
  01/03/2026**. (Préférer « date d'admission » à « demande introduite après le 28/02/2026 ».)

## Informations nécessaires pour orienter quelqu'un
1. **Date de début / d'admission** au chômage (avant ou après le 01/03/2026).
2. **Type d'allocation** : chômage complet vs allocation d'insertion.
3. **Passé professionnel** (années) — détermine les mois supplémentaires et certaines exemptions.
4. **Âge** (seuil 55 ans).
5. **Période d'indemnisation** en cours (1re / 2e / 3e).
6. **Ancienneté de chômage** déjà accumulée (vague transitoire).
7. **Statut particulier** (ports/pêche, arts, RCC, incapacité ≥ 33 %, atelier protégé,
   allocation de sauvegarde).

---

## Règles

```yaml
rule_id: reforme_2026_entree_vigueur
theme: reforme_2026
effective_from: 2026-03-01
source_name: ONEM — Nouvelle réglementation chômage en vigueur depuis le 1er mars 2026
source_url: https://www.onem.be/actualites/2026/03/02/nouvelle-reglementation-chomage-en-vigueur-depuis-le-1er-mars-2026
base_legale: >
  Loi-programme du 18/07/2025, art. 209-216 (Moniteur belge du 29/07/2025) — base légale de la
  réforme 2026. Texte consolidé public : ejustice.just.fgov.be (Justel, numac 2025005578).
  Aussi disponible dans le corpus RioLex (partenaire).
base_legale_url: https://www.ejustice.just.fgov.be/eli/loi/2025/07/18/2025005578/justel
last_verified: 2026-06-30
confidence: official
status: active
summary: >
  La réforme du chômage est entrée en vigueur le 1er mars 2026 (après une période transitoire
  débutée le 1er juillet 2025). Les nouvelles règles s'appliquent aux demandes dont la date
  d'admission est à partir du 01/03/2026.
agent_instruction: >
  Toujours situer la personne par rapport au 01/03/2026. Avant cette date = ancien régime
  (souvent via mesures transitoires) ; à partir de cette date = nouveau régime. Si la date de
  début/d'admission est inconnue, marquer requiredInfo + a_verifier (rf_date_debut_inconnue).
red_flags:
  - rf_date_debut_inconnue
  - rf_depend_reforme_2026
related_forms: []
related_topics:
  - chomage_complet
  - allocations_insertion
  - fin_de_droit
```

```yaml
rule_id: chomage_complet_limitation_2026
theme: reforme_2026
effective_from: 2026-03-01
source_name: ONEM — Réforme de la réglementation du chômage
source_url: https://www.onem.be/reforme-de-la-reglementation-du-chomage
last_verified: 2026-06-30
confidence: official
status: active
summary: >
  Le droit aux allocations de chômage complet est limité à un MAXIMUM de 24 mois : une période
  de base de 12 mois, à laquelle peuvent s'ajouter jusqu'à 12 mois supplémentaires selon le
  passé professionnel.
agent_instruction: >
  Expliquer le plafond de 24 mois (12 + jusqu'à 12) comme une orientation, jamais comme un
  calcul de fin de droit personnel. Le barème exact reliant années de carrière et mois
  supplémentaires N'EST PAS confirmé (voir TODO ci-dessous) : ne pas annoncer un nombre de
  mois précis. Renvoyer à la feuille info T202 et à l'organisme de paiement.
red_flags:
  - rf_fin_de_droit
  - rf_passe_pro_incomplet
related_forms: []
related_topics:
  - chomage_complet
  - fin_de_droit
# TODO_SOURCE_OFFICIELLE : grille année-par-année des mois supplémentaires (au-delà des 12 de
# base, jusqu'à 24) — à lire dans la feuille info T202 en intégralité.
```

```yaml
rule_id: allocations_insertion_limitation_2026
theme: reforme_2026
effective_from: 2026-03-01
source_name: ONEM — Nouvelle réglementation chômage en vigueur depuis le 1er mars 2026
source_url: https://www.onem.be/actualites/2026/03/02/nouvelle-reglementation-chomage-en-vigueur-depuis-le-1er-mars-2026
last_verified: 2026-06-30
confidence: official
status: active
summary: >
  Le droit aux allocations d'insertion est limité à une durée de 1 an (12 mois) maximum.
agent_instruction: >
  Distinguer clairement allocation d'insertion (après études) et chômage complet (après
  occupation) : ce sont deux régimes différents. Détails dans allocations-insertion.md.
red_flags:
  - rf_fin_de_droit
related_forms:
  - C109/36
related_topics:
  - allocations_insertion
```

```yaml
rule_id: reforme_2026_exemptions_limitation
theme: reforme_2026
effective_from: 2026-03-01
source_name: ONEM — Réforme de la réglementation du chômage
source_url: https://www.onem.be/reforme-de-la-reglementation-du-chomage
last_verified: 2026-06-30
confidence: official
status: active
summary: >
  Six catégories sont exemptées de la limitation dans le temps : (1) allocation de sauvegarde ;
  (2) (anciens) travailleurs des arts ; (3) ouvriers portuaires, marins-pêcheurs, débardeurs et
  trieurs de poisson reconnus ; (4) régime de chômage avec complément d'entreprise (RCC) ;
  (5) demandeurs d'emploi de PLUS de 55 ans avec PLUS de 30 ans de passé professionnel (seuil
  relevé d'un an par an pour atteindre 35 ans en 2030) ; (6) travailleurs en situation de
  handicap occupés sans interruption depuis le 01/07/2004 en atelier protégé.
agent_instruction: >
  Si la personne pourrait relever d'une de ces catégories, le signaler comme possible exemption
  et renvoyer à l'ONEM pour confirmation (ne pas conclure qu'elle est exemptée). Noter la
  formulation ONEM : « plus de 55 ans » et « plus de 30 ans » (strictement supérieur).
red_flags:
  - rf_depend_reforme_2026
related_forms: []
related_topics:
  - chomage_complet
  - fin_de_droit
```

```yaml
rule_id: reforme_2026_mesures_transitoires
theme: reforme_2026
effective_from: 2025-07-01
source_name: ONEM — J'ai bénéficié d'allocations avant le 1er mars 2026, mes allocations vont-elles être limitées ?
source_url: https://www.onem.be/citoyens/chomage-complet/reforme-de-la-reglementation-du-chomage/jai-beneficie-dallocations-de-chomage-avant-le-1er-mars-2026.-mes-allocations-vont-elles-etre-limitees-dans-le-temps-
last_verified: 2026-06-30
confidence: high
status: transitional
summary: >
  Les personnes déjà indemnisées avant le 01/03/2026 sont traitées par vagues successives, avec
  une date de fin de droit personnalisée communiquée par courrier (vagues identifiées V1 à V6
  selon la période d'indemnisation et l'ancienneté de chômage).
agent_instruction: >
  Ne JAMAIS calculer la date de fin de droit d'une personne. Expliquer que l'ONEM communique une
  date personnalisée par courrier, et orienter vers l'organisme de paiement. Les seuils/dates
  exacts par vague divergent entre sources (ONEM vs CAPAC) → a_verifier.
red_flags:
  - rf_mesure_transitoire
  - rf_fin_de_droit
  - rf_lettre_onem_contenu_inconnu
related_forms: []
related_topics:
  - fin_de_droit
# TODO_SOURCE_OFFICIELLE : dates de fin de droit exactes par vague (V1=01/01/2026 … V6=mars 2026
# selon la page ONEM ; seuils différents dans la FAQ CAPAC). À trancher sur la page transitoire
# ONEM dédiée et la feuille info T202.
```

```yaml
rule_id: reforme_2026_fin_de_droit_a_verifier
theme: reforme_2026
effective_from: 2026-03-01
source_name: ONEM — Réforme de la réglementation du chômage
source_url: https://www.onem.be/reforme-de-la-reglementation-du-chomage
last_verified: 2026-06-30
confidence: to_verify
status: to_verify
summary: >
  Toute question portant sur une FIN DE DROIT individuelle (date, montant, conséquences) ne peut
  pas être tranchée par Docbel : elle dépend de paramètres personnels et de la mise en œuvre par
  vagues.
agent_instruction: >
  Dès qu'une fin de droit est en jeu, produire un résultat a_verifier : expliquer le principe
  (limitation 24 mois / 1 an, vagues transitoires), lister les infos utiles, et renvoyer vers
  l'ONEM et l'organisme de paiement. Ne jamais confirmer ni infirmer une fin de droit.
red_flags:
  - rf_fin_de_droit
  - rf_depend_reforme_2026
  - rf_mesure_transitoire
related_forms: []
related_topics:
  - fin_de_droit
```

```yaml
rule_id: chomage_complet_degressivite_exceptions
theme: reforme_2026
effective_from: unknown
source_name: ONEM — Quelles sont les 3 exceptions qui permettent de ne pas avoir de dégressivité ?
source_url: https://www.onem.be/fr/quelles-sont-les-3-exceptions-qui-permettent-de-ne-pas-avoir-de-degressivite
base_legale: >
  AR du 25/11/1991, art. 111-119 (montant, salaire, indexation et périodes d'indemnisation),
  notamment art. 114 (périodes), 115 (montant journalier minimum), 116 (prolongation/retour).
  Texte consolidé public : ejustice.just.fgov.be (Justel, numac 1991013192). Aussi dans RioLex.
base_legale_url: https://www.ejustice.just.fgov.be/eli/arrete/1991/11/25/1991013192/justel
last_verified: 2026-06-30
confidence: official
status: active
summary: >
  Le montant des allocations cesse de diminuer (devient fixe) dès la 2e période d'indemnisation
  si l'une des 3 conditions est remplie : (1) atteindre 55 ans ; (2) au moins 33 % d'inaptitude
  permanente (médecin désigné par l'ONEM) ; (3) passé professionnel suffisamment long (20 à 24
  ans selon la date de début de la 2e période). NB : dispositif préexistant à la réforme du
  01/03/2026.
agent_instruction: >
  Présenter comme une possibilité d'arrêt de la dégressivité, à confirmer auprès de l'organisme
  de paiement. Ne pas chiffrer les montants (cf. calculateur).
red_flags:
  - rf_demande_montant_exact
related_forms: []
related_topics:
  - chomage_complet
  - situation_familiale
```

---

## Ce qui doit rester « à vérifier » (TODO_SOURCE_OFFICIELLE)
- **Barème des mois supplémentaires** (combien d'années de carrière → combien de mois en plus,
  au-delà des 12 de base, jusqu'à 24). Principe confirmé, grille chiffrée non confirmée → T202.
- **Dates de fin de droit exactes par vague** transitoire (sources ONEM/CAPAC divergentes).
- **Montants forfaitaires / dégressivité chiffrée** après le 01/03/2026 → feuille info T201 +
  moteur [`lib/calculators/chomage.ts`](../../../lib/calculators/chomage.ts).
- **Base légale formelle** : Loi-programme du 18/07/2025, art. 209-216 (Moniteur belge du
  29/07/2025 ; texte consolidé Justel, numac 2025005578). Les articles de l'AR du 25/11/1991
  modifiés en conséquence sont consultables via le texte consolidé (ejustice / RioLex).
- **Libellé exact de la condition de travail préalable** (« 1 an de travail sur 3 ans ») :
  confirmé côté CAPAC (FAQ), à recouper mot pour mot sur une feuille info ONEM (T199/T200).
  Pour le chômage complet, la condition d'admission précise est documentée séparément
  (cf. `chomage-complet.md`, règle `chomage_complet_admission_312j_36m`).

## Sources officielles
- ONEM — Réforme de la réglementation du chômage : <https://www.onem.be/reforme-de-la-reglementation-du-chomage>
- ONEM — Actualité 01/03/2026 : <https://www.onem.be/actualites/2026/03/02/nouvelle-reglementation-chomage-en-vigueur-depuis-le-1er-mars-2026>
- ONEM — Feuille info T202 (limitation chômage complet) : <https://www.onem.be/page/j-ai-demande-des-allocations-de-chomage-apres-le-28.02.2026.-mes-allocations-vont-elles-etre-limitees-dans-le-temps->
- CAPAC — FAQ réforme : <https://capac.fgov.be/fr/faq>
- Base légale — Loi-programme du 18/07/2025, art. 209-216 (M.B. 29/07/2025), texte consolidé
  Justel : <https://www.ejustice.just.fgov.be/eli/loi/2025/07/18/2025005578/justel>
- Base légale — AR du 25/11/1991 portant réglementation du chômage (texte consolidé Justel) :
  <https://www.ejustice.just.fgov.be/eli/arrete/1991/11/25/1991013192/justel>

> **« Cet outil vous aide à vous orienter. Il ne remplace pas une décision de l'ONEM, de votre
> organisme de paiement ou d'un conseiller compétent. »**
