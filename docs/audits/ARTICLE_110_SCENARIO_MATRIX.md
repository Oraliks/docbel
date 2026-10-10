# Article 110 — exploration combinatoire

Généré le 2026-10-10.

## Méthode

Exploration combinatoire déterministe des dimensions réellement lues par le moteur ; les états incompatibles sont écartés avant exécution et les ménages symétriques sont dédupliqués par signature canonique.

## Espace exploré

- Combinaisons brutes : 339
- Combinaisons invalides éliminées : 4
- Doublons métier éliminés : 139
- Scénarios uniques exécutés : 196

Exclusions explicites : seul_et_conjoint_incompatibles (1), cohousing_avec_famille_incompatible (1), document_sur_branche_non_concernee (1), doublon_symetrique_normalise_avant_execution (1).

## Catégories opérationnelles

- A : 66
- B : 121
- N : 9
- Total : 196

Les catégories A, B et N sont exhaustives ; les états suivants peuvent se cumuler avec elles.

## États complémentaires

- Informations à compléter : 74
- Pièces à fournir : 28
- Décision ONEM nécessaire : 18
- Automatisation partielle : 90
- Non automatisé : 2

## Droits plus avantageux potentiels

- B → N : 17
- B → A : 1
- N → A : 0

## Résultats techniques historiques

- Décision déterminée : 95
- Informations manquantes : 72
- Pièce à fournir : 9
- Décision ONEM requise : 9
- Non automatisé : 11
- Incohérents : 0
- Sans justification : 0

## Couverture par branche

- alimony : 2
- alone : 2
- alternating_care : 2
- children_and_relatives : 1
- children_and_third_parties : 2
- children_only : 63
- children_relatives_and_third_parties : 1
- cohousing : 26
- mixed_or_unsupported : 2
- relatives_and_third_parties : 1
- relatives_only : 36
- spouse_or_partner : 54
- third_parties_only : 4

## Couverture par dimension

### partenaire

- conjoint
- partenaire établi
- revenu pro : inconnu/non/sous seuil/seuil/au-dessus/variable
- revenu de remplacement : inconnu/non/oui
- C110A : présent/absent
- priorité avec enfant/parent/tiers

### enfants

- nombre : 1/2/3
- allocations familiales : oui/non/inconnu
- revenu pro : oui/non/inconnu
- revenu de remplacement : oui/non/inconnu
- 110&1M : date manquante/début/période/veille/échéance/lendemain/fin de mois/bissextile

### parents

- nombre : 1/2
- revenu pro : oui/non
- pension : sous seuil/seuil/au-dessus
- preuve SPF : présente/absente
- handicap : documenté

### compositions

- seul
- tiers
- enfant + tiers
- parent + tiers
- enfant + parent + tiers
- partenaire + autres
- relations ambiguës

### situations_isolees

- pension alimentaire : condition établie/en attente, pièce disponible/manquante
- hébergement alterné : condition établie/en attente, pièce disponible/manquante
- co-housing : reconnaissance ONEM oui/non/inconnue × pièces
- co-housing + pension alimentaire établie

## mixed_or_unsupported

- 1 scénario(s) — unknown — Le classificateur retourne mixed_or_unsupported lorsqu’une relation est inconnue ou qu’un partenaire n’est pas établi. Diagnostic A.
- 1 scénario(s) — partner non établi — Le classificateur retourne mixed_or_unsupported lorsqu’une relation est inconnue ou qu’un partenaire n’est pas établi. Diagnostic A.

## Co-housing

Sans état ONEM confirmé, la catégorie en l’état est **B** et une décision ONEM reste nécessaire. Le moteur met en évidence N ou A uniquement comme possibilité fondée sur les faits déjà établis, sans la présenter comme appliquée.

## Contrats

| Scénario | Branche | Catégorie | États | Potentiel | Justification |
| --- | --- | --- | --- | --- | --- |
| composition-missing | alone | B | info: incomplete, document: complete, ONEM: not_required | — | La composition réelle du ménage n'est pas encore renseignée. |
| alone-no-special-situation | alone | N | info: complete, document: complete, ONEM: not_required | — | Le chômeur a déclaré vivre seul, sans autre situation particulière établie. |
| spouse-missing-income | spouse_or_partner | B | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| spouse-no-income | spouse_or_partner | A | info: complete, document: complete, ONEM: not_required | — | Le conjoint ou partenaire est prioritaire pour l'évaluation de la situation familiale. |
| spouse-cdi-below | spouse_or_partner | A | info: complete, document: complete, ONEM: not_required | — | Le conjoint ou partenaire est prioritaire pour l'évaluation de la situation familiale. |
| spouse-cdi-at-threshold | spouse_or_partner | A | info: complete, document: complete, ONEM: not_required | — | Le conjoint ou partenaire est prioritaire pour l'évaluation de la situation familiale. |
| spouse-cdi-above | spouse_or_partner | B | info: complete, document: complete, ONEM: not_required | — | Le conjoint ou partenaire est prioritaire pour l'évaluation de la situation familiale. |
| spouse-variable-c110a-missing | spouse_or_partner | B | info: complete, document: required, ONEM: not_required | — | Les éléments déclarés nécessitent une vérification avant de déterminer la catégorie. |
| children-allowances | children_only | A | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| children-income | children_only | B | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| children-110-1m | children_only | A | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| relative-pension-document-missing | relatives_only | B | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| relative-pension-at-threshold | relatives_only | A | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| relative-pension-above | relatives_only | B | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| child-third-party-income | children_and_third_parties | B | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| alimony-document-pending | alimony | B | info: incomplete, document: required, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| alimony-established | alimony | A | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| alternating-care-pending | alternating_care | B | info: incomplete, document: required, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| alternating-care-established | alternating_care | A | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| cohousing-never-recognized | cohousing | B | info: complete, document: complete, ONEM: required | N | La situation de co-housing est appréciée par l’ONEM sur la situation réelle.  Le Bureau du chômage peut effectuer une enquête avant de décider si le chômeur peut être considéré comme isolé. |
| cohousing-alimony-established | cohousing | B | info: complete, document: complete, ONEM: required | A | La situation de co-housing est appréciée par l’ONEM sur la situation réelle.  Le Bureau du chômage peut effectuer une enquête avant de décider si le chômeur peut être considéré comme isolé. |
| cohousing-recognized-same-address | cohousing | N | info: complete, document: complete, ONEM: not_required | — | La situation de co-housing est appréciée par l’ONEM sur la situation réelle.  Le Bureau du chômage peut effectuer une enquête avant de décider si le chômeur peut être considéré comme isolé. |
| cohousing-recognition-unknown | cohousing | B | info: incomplete, document: required, ONEM: required | N | Des informations sont nécessaires pour évaluer la situation familiale. |
| unknown-relation | mixed_or_unsupported | B | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-spouse-unknown-no | spouse_or_partner | B | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-spouse-unknown-yes | spouse_or_partner | B | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-spouse-none-unknown | spouse_or_partner | B | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-spouse-none-yes | spouse_or_partner | B | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-spouse-below-unknown | spouse_or_partner | B | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-spouse-below-no | spouse_or_partner | A | info: complete, document: complete, ONEM: not_required | — | Le conjoint ou partenaire est prioritaire pour l'évaluation de la situation familiale. |
| comb-partner-spouse-below-yes | spouse_or_partner | A | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-spouse-exact-unknown | spouse_or_partner | B | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-spouse-exact-yes | spouse_or_partner | A | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-spouse-above-unknown | spouse_or_partner | B | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-spouse-above-no | spouse_or_partner | B | info: complete, document: complete, ONEM: not_required | — | Le conjoint ou partenaire est prioritaire pour l'évaluation de la situation familiale. |
| comb-partner-spouse-above-yes | spouse_or_partner | B | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-spouse-variable-c110a-missing-unknown | spouse_or_partner | B | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-spouse-variable-c110a-missing-yes | spouse_or_partner | B | info: incomplete, document: required, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-spouse-variable-c110a-amount-unknown-unknown | spouse_or_partner | B | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-spouse-variable-c110a-amount-unknown-no | spouse_or_partner | B | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-spouse-variable-c110a-amount-unknown-yes | spouse_or_partner | B | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-spouse-variable-c110a-present-unknown | spouse_or_partner | B | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-spouse-variable-c110a-present-no | spouse_or_partner | B | info: complete, document: complete, ONEM: not_required | — | Les éléments déclarés nécessitent une vérification avant de déterminer la catégorie. |
| comb-partner-spouse-variable-c110a-present-yes | spouse_or_partner | B | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-partner-unknown-unknown | spouse_or_partner | B | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-partner-unknown-no | spouse_or_partner | B | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-partner-unknown-yes | spouse_or_partner | B | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-partner-none-unknown | spouse_or_partner | B | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-partner-none-no | spouse_or_partner | A | info: complete, document: complete, ONEM: not_required | — | Le conjoint ou partenaire est prioritaire pour l'évaluation de la situation familiale. |
| comb-partner-partner-none-yes | spouse_or_partner | B | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-partner-below-unknown | spouse_or_partner | B | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-partner-below-no | spouse_or_partner | A | info: complete, document: complete, ONEM: not_required | — | Le conjoint ou partenaire est prioritaire pour l'évaluation de la situation familiale. |
| comb-partner-partner-below-yes | spouse_or_partner | A | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-partner-exact-unknown | spouse_or_partner | B | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-partner-exact-no | spouse_or_partner | A | info: complete, document: complete, ONEM: not_required | — | Le conjoint ou partenaire est prioritaire pour l'évaluation de la situation familiale. |
| comb-partner-partner-exact-yes | spouse_or_partner | A | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-partner-above-unknown | spouse_or_partner | B | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-partner-above-no | spouse_or_partner | B | info: complete, document: complete, ONEM: not_required | — | Le conjoint ou partenaire est prioritaire pour l'évaluation de la situation familiale. |
| comb-partner-partner-above-yes | spouse_or_partner | B | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-partner-variable-c110a-missing-unknown | spouse_or_partner | B | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-partner-variable-c110a-missing-no | spouse_or_partner | B | info: complete, document: required, ONEM: not_required | — | Les éléments déclarés nécessitent une vérification avant de déterminer la catégorie. |
| comb-partner-partner-variable-c110a-missing-yes | spouse_or_partner | B | info: incomplete, document: required, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-partner-variable-c110a-amount-unknown-unknown | spouse_or_partner | B | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-partner-variable-c110a-amount-unknown-no | spouse_or_partner | B | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-partner-variable-c110a-amount-unknown-yes | spouse_or_partner | B | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-partner-variable-c110a-present-unknown | spouse_or_partner | B | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-partner-variable-c110a-present-no | spouse_or_partner | B | info: complete, document: complete, ONEM: not_required | — | Les éléments déclarés nécessitent une vérification avant de déterminer la catégorie. |
| comb-partner-partner-variable-c110a-present-yes | spouse_or_partner | B | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-priority-1 | spouse_or_partner | A | info: complete, document: complete, ONEM: not_required | — | Le conjoint ou partenaire est prioritaire pour l'évaluation de la situation familiale. |
| comb-partner-priority-2 | spouse_or_partner | A | info: complete, document: complete, ONEM: not_required | — | Le conjoint ou partenaire est prioritaire pour l'évaluation de la situation familiale. |
| comb-partner-priority-3 | spouse_or_partner | A | info: complete, document: complete, ONEM: not_required | — | Le conjoint ou partenaire est prioritaire pour l'évaluation de la situation familiale. |
| comb-partner-priority-4 | spouse_or_partner | A | info: complete, document: complete, ONEM: not_required | — | Le conjoint ou partenaire est prioritaire pour l'évaluation de la situation familiale. |
| comb-children-none | children_only | A | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-replacement | children_only | B | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-unknown | children_only | A | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-children-af-af | children_only | A | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-af-none | children_only | A | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-af-professional | children_only | A | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-af-replacement | children_only | A | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-af-unknown | children_only | A | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-children-none-none | children_only | A | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-none-professional | children_only | B | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-none-replacement | children_only | B | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-none-unknown | children_only | A | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-children-professional-professional | children_only | B | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-professional-replacement | children_only | B | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-professional-unknown | children_only | B | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-children-replacement-replacement | children_only | B | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-replacement-unknown | children_only | B | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-children-unknown-unknown | children_only | A | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-children-af-af-af | children_only | A | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-af-af-none | children_only | A | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-af-af-professional | children_only | A | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-af-af-replacement | children_only | A | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-af-af-unknown | children_only | A | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-children-af-none-none | children_only | A | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-af-none-professional | children_only | A | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-af-none-replacement | children_only | A | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-af-none-unknown | children_only | A | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-children-af-professional-professional | children_only | A | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-af-professional-replacement | children_only | A | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-af-professional-unknown | children_only | A | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-children-af-replacement-replacement | children_only | A | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-af-replacement-unknown | children_only | A | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-children-af-unknown-unknown | children_only | A | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-children-none-none-none | children_only | A | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-none-none-professional | children_only | B | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-none-none-replacement | children_only | B | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-none-none-unknown | children_only | A | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-children-none-professional-professional | children_only | B | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-none-professional-replacement | children_only | B | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-none-professional-unknown | children_only | B | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-children-none-replacement-replacement | children_only | B | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-none-replacement-unknown | children_only | B | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-children-none-unknown-unknown | children_only | A | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-children-professional-professional-professional | children_only | B | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-professional-professional-replacement | children_only | B | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-professional-professional-unknown | children_only | B | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-children-professional-replacement-replacement | children_only | B | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-professional-replacement-unknown | children_only | B | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-children-professional-unknown-unknown | children_only | B | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-children-replacement-replacement-replacement | children_only | B | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-replacement-replacement-unknown | children_only | B | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-children-replacement-unknown-unknown | children_only | B | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-children-unknown-unknown-unknown | children_only | A | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-110-temporal-0 | children_only | B | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-110-temporal-2 | children_only | A | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-110-temporal-3 | children_only | A | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-110-temporal-4 | children_only | A | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-110-temporal-5 | children_only | A | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-110-temporal-6 | children_only | A | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-110-temporal-7 | children_only | A | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-none | relatives_only | A | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-professional | relatives_only | B | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-pension-below | relatives_only | A | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-pension-above | relatives_only | B | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-disability | relatives_only | A | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-none-none | relatives_only | A | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-none-professional | relatives_only | B | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-none-pension-below | relatives_only | A | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-none-pension-exact | relatives_only | A | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-none-pension-above | relatives_only | B | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-none-pension-proof-missing | relatives_only | B | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-none-disability | relatives_only | A | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-professional-professional | relatives_only | B | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-professional-pension-below | relatives_only | B | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-professional-pension-exact | relatives_only | B | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-professional-pension-above | relatives_only | B | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-professional-pension-proof-missing | relatives_only | B | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-professional-disability | relatives_only | B | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-pension-below-pension-below | relatives_only | B | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-pension-below-pension-exact | relatives_only | B | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-pension-below-pension-above | relatives_only | B | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-pension-below-pension-proof-missing | relatives_only | B | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-pension-below-disability | relatives_only | B | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-pension-exact-pension-exact | relatives_only | B | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-pension-exact-pension-above | relatives_only | B | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-pension-exact-pension-proof-missing | relatives_only | B | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-pension-exact-disability | relatives_only | B | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-pension-above-pension-above | relatives_only | B | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-pension-above-pension-proof-missing | relatives_only | B | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-pension-above-disability | relatives_only | B | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-pension-proof-missing-pension-proof-missing | relatives_only | B | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-pension-proof-missing-disability | relatives_only | B | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-disability-disability | relatives_only | B | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-composition-third-no-income | third_parties_only | B | info: complete, document: complete, ONEM: not_required | — | Les éléments déclarés nécessitent une vérification avant de déterminer la catégorie. |
| comb-composition-third-professional-income | third_parties_only | B | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-composition-third-replacement-income | third_parties_only | B | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-composition-third-income-unknown | third_parties_only | B | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-composition-child-relative | children_and_relatives | A | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-composition-child-third | children_and_third_parties | A | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-composition-relative-third | relatives_and_third_parties | A | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-composition-child-relative-third | children_relatives_and_third_parties | A | info: complete, document: complete, ONEM: not_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-composition-partner-ambiguous | mixed_or_unsupported | B | info: incomplete, document: complete, ONEM: not_required | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-cohousing-yes-000 | cohousing | N | info: complete, document: required, ONEM: not_required | — | La situation de co-housing est appréciée par l’ONEM sur la situation réelle.  Le Bureau du chômage peut effectuer une enquête avant de décider si le chômeur peut être considéré comme isolé. |
| comb-cohousing-yes-001 | cohousing | N | info: complete, document: required, ONEM: not_required | — | La situation de co-housing est appréciée par l’ONEM sur la situation réelle.  Le Bureau du chômage peut effectuer une enquête avant de décider si le chômeur peut être considéré comme isolé. |
| comb-cohousing-yes-010 | cohousing | N | info: complete, document: required, ONEM: not_required | — | La situation de co-housing est appréciée par l’ONEM sur la situation réelle.  Le Bureau du chômage peut effectuer une enquête avant de décider si le chômeur peut être considéré comme isolé. |
| comb-cohousing-yes-011 | cohousing | N | info: complete, document: required, ONEM: not_required | — | La situation de co-housing est appréciée par l’ONEM sur la situation réelle.  Le Bureau du chômage peut effectuer une enquête avant de décider si le chômeur peut être considéré comme isolé. |
| comb-cohousing-yes-100 | cohousing | N | info: complete, document: required, ONEM: not_required | — | La situation de co-housing est appréciée par l’ONEM sur la situation réelle.  Le Bureau du chômage peut effectuer une enquête avant de décider si le chômeur peut être considéré comme isolé. |
| comb-cohousing-yes-101 | cohousing | N | info: complete, document: required, ONEM: not_required | — | La situation de co-housing est appréciée par l’ONEM sur la situation réelle.  Le Bureau du chômage peut effectuer une enquête avant de décider si le chômeur peut être considéré comme isolé. |
| comb-cohousing-yes-110 | cohousing | N | info: complete, document: required, ONEM: not_required | — | La situation de co-housing est appréciée par l’ONEM sur la situation réelle.  Le Bureau du chômage peut effectuer une enquête avant de décider si le chômeur peut être considéré comme isolé. |
| comb-cohousing-no-000 | cohousing | B | info: complete, document: required, ONEM: required | N | La situation de co-housing est appréciée par l’ONEM sur la situation réelle.  Le Bureau du chômage peut effectuer une enquête avant de décider si le chômeur peut être considéré comme isolé. |
| comb-cohousing-no-001 | cohousing | B | info: complete, document: required, ONEM: required | N | La situation de co-housing est appréciée par l’ONEM sur la situation réelle.  Le Bureau du chômage peut effectuer une enquête avant de décider si le chômeur peut être considéré comme isolé. |
| comb-cohousing-no-010 | cohousing | B | info: complete, document: required, ONEM: required | N | La situation de co-housing est appréciée par l’ONEM sur la situation réelle.  Le Bureau du chômage peut effectuer une enquête avant de décider si le chômeur peut être considéré comme isolé. |
| comb-cohousing-no-011 | cohousing | B | info: complete, document: required, ONEM: required | N | La situation de co-housing est appréciée par l’ONEM sur la situation réelle.  Le Bureau du chômage peut effectuer une enquête avant de décider si le chômeur peut être considéré comme isolé. |
| comb-cohousing-no-100 | cohousing | B | info: complete, document: required, ONEM: required | N | La situation de co-housing est appréciée par l’ONEM sur la situation réelle.  Le Bureau du chômage peut effectuer une enquête avant de décider si le chômeur peut être considéré comme isolé. |
| comb-cohousing-no-101 | cohousing | B | info: complete, document: required, ONEM: required | N | La situation de co-housing est appréciée par l’ONEM sur la situation réelle.  Le Bureau du chômage peut effectuer une enquête avant de décider si le chômeur peut être considéré comme isolé. |
| comb-cohousing-no-110 | cohousing | B | info: complete, document: required, ONEM: required | N | La situation de co-housing est appréciée par l’ONEM sur la situation réelle.  Le Bureau du chômage peut effectuer une enquête avant de décider si le chômeur peut être considéré comme isolé. |
| comb-cohousing-unknown-000 | cohousing | B | info: incomplete, document: required, ONEM: required | N | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-cohousing-unknown-001 | cohousing | B | info: incomplete, document: required, ONEM: required | N | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-cohousing-unknown-010 | cohousing | B | info: incomplete, document: required, ONEM: required | N | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-cohousing-unknown-011 | cohousing | B | info: incomplete, document: required, ONEM: required | N | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-cohousing-unknown-100 | cohousing | B | info: incomplete, document: required, ONEM: required | N | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-cohousing-unknown-101 | cohousing | B | info: incomplete, document: required, ONEM: required | N | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-cohousing-unknown-110 | cohousing | B | info: incomplete, document: required, ONEM: required | N | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-cohousing-unknown-111 | cohousing | B | info: incomplete, document: complete, ONEM: required | N | Des informations sont nécessaires pour évaluer la situation familiale. |

## Validation de couverture

### Types de résultat historiques

- Déterminés : 95
- Informations manquantes : 72
- Pièces : 9
- Décisions ONEM : 9
- Non automatisés : 11
- TOTAL : 196

### Catégories opérationnelles exhaustives

- A : 66
- B : 121
- N : 9
- TOTAL : 196

### États complémentaires

- Informations à compléter : 74
- Pièces à fournir : 28
- Décision ONEM nécessaire : 18

### Droits plus avantageux potentiels

- B → N : 17
- B → A : 1
- N → A : 0

### Couverture des compositions

| Composition | Scénarios | Déterminés | Incomplets | Pièces | ONEM | Non automatisés |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| seul | 27 | 1 | 9 | 7 | 9 | 1 |
| conjoint | 26 | 7 | 18 | 1 | 0 | 0 |
| partenaire | 25 | 5 | 18 | 1 | 0 | 1 |
| enfants seuls | 68 | 42 | 26 | 0 | 0 | 0 |
| parents seuls | 36 | 29 | 0 | 0 | 0 | 7 |
| tiers seul | 4 | 2 | 1 | 0 | 0 | 1 |
| enfants + parents | 1 | 1 | 0 | 0 | 0 | 0 |
| enfants + tiers | 2 | 2 | 0 | 0 | 0 | 0 |
| parents + tiers | 1 | 1 | 0 | 0 | 0 | 0 |
| enfants + parents + tiers | 1 | 1 | 0 | 0 | 0 | 0 |
| partenaire + autres | 4 | 4 | 0 | 0 | 0 | 0 |

### mixed_or_unsupported

- unknown-relation — composition mixed_or_unsupported; faits : unknown; attendu si précisé : relation à qualifier; Le classificateur retourne mixed_or_unsupported lorsqu’une relation est inconnue ou qu’un partenaire n’est pas établi.
- comb-composition-partner-ambiguous — composition mixed_or_unsupported; faits : partner non établi; attendu si précisé : conjoint ou partenaire établi; Le classificateur retourne mixed_or_unsupported lorsqu’une relation est inconnue ou qu’un partenaire n’est pas établi.

### Anomalies

- Aucune.

Assertions : types=true, catégories=true, incohérents=true, justifications=true, A=true, B=true, N=true.

Durée : 29.33 ms

## Décisions ONEM par branche

- cohousing : 18
