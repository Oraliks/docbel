# Article 110 — exploration combinatoire

Généré le 2026-10-10.

## Méthode

Exploration combinatoire déterministe des dimensions réellement lues par le moteur ; les états incompatibles sont écartés avant exécution et les ménages symétriques sont dédupliqués par signature canonique.

## Espace exploré

- Combinaisons brutes : 314
- Combinaisons invalides éliminées : 4
- Doublons métier éliminés : 138
- Scénarios uniques exécutés : 172

Exclusions explicites : seul_et_conjoint_incompatibles (1), cohousing_avec_famille_incompatible (1), document_sur_branche_non_concernee (1), doublon_symetrique_normalise_avant_execution (1).

## Résultats

- Décision déterminée : 90
- Informations manquantes : 52
- Pièce à fournir : 11
- Décision ONEM requise : 13
- Non automatisé : 6
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
- cohousing : 8
- mixed_or_unsupported : 6
- relatives_and_third_parties : 1
- relatives_only : 36
- spouse_or_partner : 48

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

- pension alimentaire : disponible/en attente
- hébergement alterné : disponible/en attente
- co-housing : 8 états documentaires

## mixed_or_unsupported

- 1 scénario(s) — unknown — Le classificateur retourne mixed_or_unsupported lorsqu’une relation est inconnue ou qu’un partenaire n’est pas établi. Diagnostic A.
- 1 scénario(s) — third_party — Le classificateur retourne mixed_or_unsupported lorsqu’une relation est inconnue ou qu’un partenaire n’est pas établi. Diagnostic A.
- 1 scénario(s) — third_party — Le classificateur retourne mixed_or_unsupported lorsqu’une relation est inconnue ou qu’un partenaire n’est pas établi. Diagnostic A.
- 1 scénario(s) — third_party — Le classificateur retourne mixed_or_unsupported lorsqu’une relation est inconnue ou qu’un partenaire n’est pas établi. Diagnostic A.
- 1 scénario(s) — third_party — Le classificateur retourne mixed_or_unsupported lorsqu’une relation est inconnue ou qu’un partenaire n’est pas établi. Diagnostic A.
- 1 scénario(s) — partner non établi — Le classificateur retourne mixed_or_unsupported lorsqu’une relation est inconnue ou qu’un partenaire n’est pas établi. Diagnostic A.

## Co-housing

État : **Décision ONEM requise**. Le Bureau du chômage peut effectuer une enquête sur la situation réelle avant de décider si le chômeur peut être considéré comme isolé.

## Trous du moteur

- Les compositions mixed_or_unsupported restent explicitement non automatisées ; aucune catégorie n’est devinée.
- Les catégories issues d’une appréciation de fait (dont le co-housing) restent soumises à la décision ONEM.

## Contrats

| Scénario | Branche | Résultat | Catégorie | Justification |
| --- | --- | --- | --- | --- |
| composition-missing | alone | information_missing | — | La composition réelle du ménage n'est pas encore renseignée. |
| alone-no-special-situation | alone | onem_decision_required | — | Les éléments déclarés nécessitent une vérification avant de déterminer la catégorie. |
| spouse-missing-income | spouse_or_partner | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| spouse-no-income | spouse_or_partner | decision_determined | A | Le conjoint ou partenaire est prioritaire pour l'évaluation de la situation familiale. |
| spouse-cdi-below | spouse_or_partner | decision_determined | A | Le conjoint ou partenaire est prioritaire pour l'évaluation de la situation familiale. |
| spouse-cdi-at-threshold | spouse_or_partner | decision_determined | A | Le conjoint ou partenaire est prioritaire pour l'évaluation de la situation familiale. |
| spouse-cdi-above | spouse_or_partner | decision_determined | B | Le conjoint ou partenaire est prioritaire pour l'évaluation de la situation familiale. |
| spouse-variable-c110a-missing | spouse_or_partner | document_required | — | Les éléments déclarés nécessitent une vérification avant de déterminer la catégorie. |
| children-allowances | children_only | decision_determined | A | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| children-income | children_only | decision_determined | B | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| children-110-1m | children_only | decision_determined | A | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| relative-pension-document-missing | relatives_only | document_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| relative-pension-at-threshold | relatives_only | decision_determined | A | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| relative-pension-above | relatives_only | decision_determined | B | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| child-third-party-income | children_and_third_parties | decision_determined | B | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| alimony-document-pending | alimony | document_required | — | Les éléments déclarés nécessitent une vérification avant de déterminer la catégorie. |
| alimony-established | alimony | onem_decision_required | — | Les éléments déclarés nécessitent une vérification avant de déterminer la catégorie. |
| alternating-care-pending | alternating_care | document_required | — | Les éléments déclarés nécessitent une vérification avant de déterminer la catégorie. |
| alternating-care-established | alternating_care | onem_decision_required | — | Les éléments déclarés nécessitent une vérification avant de déterminer la catégorie. |
| cohousing-complete | cohousing | onem_decision_required | — | La situation de co-housing est appréciée par l’ONEM sur la situation réelle.  Le Bureau du chômage peut effectuer une enquête avant de décider si le chômeur peut être considéré comme isolé. |
| unknown-relation | mixed_or_unsupported | not_automated | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-spouse-unknown-no | spouse_or_partner | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-spouse-unknown-yes | spouse_or_partner | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-spouse-none-unknown | spouse_or_partner | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-spouse-none-yes | spouse_or_partner | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-spouse-below-unknown | spouse_or_partner | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-spouse-below-no | spouse_or_partner | decision_determined | A | Le conjoint ou partenaire est prioritaire pour l'évaluation de la situation familiale. |
| comb-partner-spouse-below-yes | spouse_or_partner | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-spouse-exact-unknown | spouse_or_partner | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-spouse-exact-yes | spouse_or_partner | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-spouse-above-unknown | spouse_or_partner | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-spouse-above-no | spouse_or_partner | decision_determined | B | Le conjoint ou partenaire est prioritaire pour l'évaluation de la situation familiale. |
| comb-partner-spouse-above-yes | spouse_or_partner | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-spouse-variable-c110a-missing-unknown | spouse_or_partner | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-spouse-variable-c110a-missing-yes | spouse_or_partner | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-spouse-variable-c110a-present-unknown | spouse_or_partner | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-spouse-variable-c110a-present-no | spouse_or_partner | onem_decision_required | — | Les éléments déclarés nécessitent une vérification avant de déterminer la catégorie. |
| comb-partner-spouse-variable-c110a-present-yes | spouse_or_partner | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-partner-unknown-unknown | spouse_or_partner | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-partner-unknown-no | spouse_or_partner | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-partner-unknown-yes | spouse_or_partner | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-partner-none-unknown | spouse_or_partner | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-partner-none-no | spouse_or_partner | decision_determined | A | Le conjoint ou partenaire est prioritaire pour l'évaluation de la situation familiale. |
| comb-partner-partner-none-yes | spouse_or_partner | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-partner-below-unknown | spouse_or_partner | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-partner-below-no | spouse_or_partner | decision_determined | A | Le conjoint ou partenaire est prioritaire pour l'évaluation de la situation familiale. |
| comb-partner-partner-below-yes | spouse_or_partner | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-partner-exact-unknown | spouse_or_partner | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-partner-exact-no | spouse_or_partner | decision_determined | A | Le conjoint ou partenaire est prioritaire pour l'évaluation de la situation familiale. |
| comb-partner-partner-exact-yes | spouse_or_partner | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-partner-above-unknown | spouse_or_partner | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-partner-above-no | spouse_or_partner | decision_determined | B | Le conjoint ou partenaire est prioritaire pour l'évaluation de la situation familiale. |
| comb-partner-partner-above-yes | spouse_or_partner | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-partner-variable-c110a-missing-unknown | spouse_or_partner | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-partner-variable-c110a-missing-no | spouse_or_partner | document_required | — | Les éléments déclarés nécessitent une vérification avant de déterminer la catégorie. |
| comb-partner-partner-variable-c110a-missing-yes | spouse_or_partner | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-partner-variable-c110a-present-unknown | spouse_or_partner | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-partner-variable-c110a-present-no | spouse_or_partner | onem_decision_required | — | Les éléments déclarés nécessitent une vérification avant de déterminer la catégorie. |
| comb-partner-partner-variable-c110a-present-yes | spouse_or_partner | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-partner-priority-1 | spouse_or_partner | decision_determined | A | Le conjoint ou partenaire est prioritaire pour l'évaluation de la situation familiale. |
| comb-partner-priority-2 | spouse_or_partner | decision_determined | A | Le conjoint ou partenaire est prioritaire pour l'évaluation de la situation familiale. |
| comb-partner-priority-3 | spouse_or_partner | decision_determined | A | Le conjoint ou partenaire est prioritaire pour l'évaluation de la situation familiale. |
| comb-partner-priority-4 | spouse_or_partner | decision_determined | A | Le conjoint ou partenaire est prioritaire pour l'évaluation de la situation familiale. |
| comb-children-none | children_only | decision_determined | A | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-replacement | children_only | decision_determined | B | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-unknown | children_only | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-children-af-af | children_only | decision_determined | A | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-af-none | children_only | decision_determined | A | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-af-professional | children_only | decision_determined | A | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-af-replacement | children_only | decision_determined | A | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-af-unknown | children_only | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-children-none-none | children_only | decision_determined | A | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-none-professional | children_only | decision_determined | B | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-none-replacement | children_only | decision_determined | B | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-none-unknown | children_only | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-children-professional-professional | children_only | decision_determined | B | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-professional-replacement | children_only | decision_determined | B | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-professional-unknown | children_only | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-children-replacement-replacement | children_only | decision_determined | B | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-replacement-unknown | children_only | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-children-unknown-unknown | children_only | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-children-af-af-af | children_only | decision_determined | A | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-af-af-none | children_only | decision_determined | A | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-af-af-professional | children_only | decision_determined | A | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-af-af-replacement | children_only | decision_determined | A | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-af-af-unknown | children_only | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-children-af-none-none | children_only | decision_determined | A | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-af-none-professional | children_only | decision_determined | A | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-af-none-replacement | children_only | decision_determined | A | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-af-none-unknown | children_only | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-children-af-professional-professional | children_only | decision_determined | A | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-af-professional-replacement | children_only | decision_determined | A | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-af-professional-unknown | children_only | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-children-af-replacement-replacement | children_only | decision_determined | A | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-af-replacement-unknown | children_only | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-children-af-unknown-unknown | children_only | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-children-none-none-none | children_only | decision_determined | A | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-none-none-professional | children_only | decision_determined | B | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-none-none-replacement | children_only | decision_determined | B | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-none-none-unknown | children_only | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-children-none-professional-professional | children_only | decision_determined | B | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-none-professional-replacement | children_only | decision_determined | B | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-none-professional-unknown | children_only | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-children-none-replacement-replacement | children_only | decision_determined | B | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-none-replacement-unknown | children_only | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-children-none-unknown-unknown | children_only | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-children-professional-professional-professional | children_only | decision_determined | B | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-professional-professional-replacement | children_only | decision_determined | B | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-professional-professional-unknown | children_only | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-children-professional-replacement-replacement | children_only | decision_determined | B | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-professional-replacement-unknown | children_only | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-children-professional-unknown-unknown | children_only | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-children-replacement-replacement-replacement | children_only | decision_determined | B | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-children-replacement-replacement-unknown | children_only | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-children-replacement-unknown-unknown | children_only | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-children-unknown-unknown-unknown | children_only | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-110-temporal-0 | children_only | decision_determined | B | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-110-temporal-2 | children_only | decision_determined | A | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-110-temporal-3 | children_only | decision_determined | A | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-110-temporal-4 | children_only | decision_determined | A | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-110-temporal-5 | children_only | decision_determined | A | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-110-temporal-6 | children_only | decision_determined | A | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-110-temporal-7 | children_only | decision_determined | A | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-none | relatives_only | decision_determined | A | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-professional | relatives_only | decision_determined | B | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-pension-below | relatives_only | decision_determined | A | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-pension-above | relatives_only | decision_determined | B | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-disability | relatives_only | decision_determined | A | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-none-none | relatives_only | decision_determined | A | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-none-professional | relatives_only | decision_determined | B | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-none-pension-below | relatives_only | decision_determined | A | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-none-pension-exact | relatives_only | decision_determined | A | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-none-pension-above | relatives_only | decision_determined | B | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-none-pension-proof-missing | relatives_only | document_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-none-disability | relatives_only | decision_determined | A | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-professional-professional | relatives_only | decision_determined | B | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-professional-pension-below | relatives_only | decision_determined | B | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-professional-pension-exact | relatives_only | decision_determined | B | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-professional-pension-above | relatives_only | decision_determined | B | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-professional-pension-proof-missing | relatives_only | decision_determined | B | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-professional-disability | relatives_only | decision_determined | B | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-pension-below-pension-below | relatives_only | decision_determined | B | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-pension-below-pension-exact | relatives_only | decision_determined | B | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-pension-below-pension-above | relatives_only | decision_determined | B | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-pension-below-pension-proof-missing | relatives_only | document_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-pension-below-disability | relatives_only | decision_determined | B | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-pension-exact-pension-exact | relatives_only | decision_determined | B | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-pension-exact-pension-above | relatives_only | decision_determined | B | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-pension-exact-pension-proof-missing | relatives_only | document_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-pension-exact-disability | relatives_only | decision_determined | B | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-pension-above-pension-above | relatives_only | decision_determined | B | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-pension-above-pension-proof-missing | relatives_only | document_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-pension-above-disability | relatives_only | decision_determined | B | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-pension-proof-missing-pension-proof-missing | relatives_only | document_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-pension-proof-missing-disability | relatives_only | document_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-relatives-disability-disability | relatives_only | decision_determined | B | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-composition-third-no-income | mixed_or_unsupported | not_automated | — | Les éléments déclarés nécessitent une vérification avant de déterminer la catégorie. |
| comb-composition-third-professional-income | mixed_or_unsupported | not_automated | — | Les éléments déclarés nécessitent une vérification avant de déterminer la catégorie. |
| comb-composition-third-replacement-income | mixed_or_unsupported | not_automated | — | Les éléments déclarés nécessitent une vérification avant de déterminer la catégorie. |
| comb-composition-third-income-unknown | mixed_or_unsupported | not_automated | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-composition-child-relative | children_and_relatives | decision_determined | A | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-composition-child-third | children_and_third_parties | decision_determined | A | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-composition-relative-third | relatives_and_third_parties | decision_determined | A | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-composition-child-relative-third | children_relatives_and_third_parties | decision_determined | A | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| comb-composition-partner-ambiguous | mixed_or_unsupported | not_automated | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| comb-cohousing-000 | cohousing | onem_decision_required | — | La situation de co-housing est appréciée par l’ONEM sur la situation réelle.  Le Bureau du chômage peut effectuer une enquête avant de décider si le chômeur peut être considéré comme isolé. |
| comb-cohousing-001 | cohousing | onem_decision_required | — | La situation de co-housing est appréciée par l’ONEM sur la situation réelle.  Le Bureau du chômage peut effectuer une enquête avant de décider si le chômeur peut être considéré comme isolé. |
| comb-cohousing-010 | cohousing | onem_decision_required | — | La situation de co-housing est appréciée par l’ONEM sur la situation réelle.  Le Bureau du chômage peut effectuer une enquête avant de décider si le chômeur peut être considéré comme isolé. |
| comb-cohousing-011 | cohousing | onem_decision_required | — | La situation de co-housing est appréciée par l’ONEM sur la situation réelle.  Le Bureau du chômage peut effectuer une enquête avant de décider si le chômeur peut être considéré comme isolé. |
| comb-cohousing-100 | cohousing | onem_decision_required | — | La situation de co-housing est appréciée par l’ONEM sur la situation réelle.  Le Bureau du chômage peut effectuer une enquête avant de décider si le chômeur peut être considéré comme isolé. |
| comb-cohousing-101 | cohousing | onem_decision_required | — | La situation de co-housing est appréciée par l’ONEM sur la situation réelle.  Le Bureau du chômage peut effectuer une enquête avant de décider si le chômeur peut être considéré comme isolé. |
| comb-cohousing-110 | cohousing | onem_decision_required | — | La situation de co-housing est appréciée par l’ONEM sur la situation réelle.  Le Bureau du chômage peut effectuer une enquête avant de décider si le chômeur peut être considéré comme isolé. |

## Validation de couverture

### Types de résultat

- Déterminés : 90
- Informations manquantes : 52
- Pièces : 11
- Décisions ONEM : 13
- Non automatisés : 6
- TOTAL : 172

### Catégories déterminées

- A : 48
- B : 42
- N : 0
- TOTAL : 90

### Couverture des compositions

| Composition | Scénarios | Déterminés | Incomplets | Pièces | ONEM | Non automatisés |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| seul | 9 | 0 | 0 | 0 | 9 | 0 |
| conjoint | 23 | 6 | 15 | 1 | 1 | 0 |
| partenaire | 22 | 4 | 15 | 1 | 1 | 1 |
| enfants seuls | 68 | 42 | 22 | 2 | 2 | 0 |
| parents seuls | 36 | 29 | 0 | 7 | 0 | 0 |
| tiers seul | 4 | 0 | 0 | 0 | 0 | 4 |
| enfants + parents | 1 | 1 | 0 | 0 | 0 | 0 |
| enfants + tiers | 2 | 2 | 0 | 0 | 0 | 0 |
| parents + tiers | 1 | 1 | 0 | 0 | 0 | 0 |
| enfants + parents + tiers | 1 | 1 | 0 | 0 | 0 | 0 |
| partenaire + autres | 4 | 4 | 0 | 0 | 0 | 0 |

### mixed_or_unsupported

- unknown-relation — composition mixed_or_unsupported; faits : unknown; attendu si précisé : relation à qualifier; Le classificateur retourne mixed_or_unsupported lorsqu’une relation est inconnue ou qu’un partenaire n’est pas établi.
- comb-composition-third-no-income — composition mixed_or_unsupported; faits : third_party; attendu si précisé : tiers seul : branche non automatisée; Le classificateur retourne mixed_or_unsupported lorsqu’une relation est inconnue ou qu’un partenaire n’est pas établi.
- comb-composition-third-professional-income — composition mixed_or_unsupported; faits : third_party; attendu si précisé : tiers seul : branche non automatisée; Le classificateur retourne mixed_or_unsupported lorsqu’une relation est inconnue ou qu’un partenaire n’est pas établi.
- comb-composition-third-replacement-income — composition mixed_or_unsupported; faits : third_party; attendu si précisé : tiers seul : branche non automatisée; Le classificateur retourne mixed_or_unsupported lorsqu’une relation est inconnue ou qu’un partenaire n’est pas établi.
- comb-composition-third-income-unknown — composition mixed_or_unsupported; faits : third_party; attendu si précisé : tiers seul : branche non automatisée; Le classificateur retourne mixed_or_unsupported lorsqu’une relation est inconnue ou qu’un partenaire n’est pas établi.
- comb-composition-partner-ambiguous — composition mixed_or_unsupported; faits : partner non établi; attendu si précisé : conjoint ou partenaire établi; Le classificateur retourne mixed_or_unsupported lorsqu’une relation est inconnue ou qu’un partenaire n’est pas établi.

### Anomalies

- ANOMALIE DE COUVERTURE : le scénario explicite « vit seul sans situation particulière » est généré, mais le moteur actuel ne renvoie pas N ; il renvoie une revue sans catégorie attendue.

Assertions : types=true, catégories=true, incohérents=true, justifications=true, A=true, B=true, N=false.

Durée : 33.86 ms
