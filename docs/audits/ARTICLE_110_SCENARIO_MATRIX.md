# Article 110 — matrice exhaustive de scénarios

Généré le 2026-10-10.

## Méthode

Classes d’équivalence des branches, seuils réels fournis au moteur, états documentaires et dates 110&1M/110&1V ; aucune combinaison cartésienne.

## Résultats

- Scénarios : 21
- Décision déterminée : 11
- Informations manquantes : 2
- Pièce à fournir : 4
- Décision ONEM requise : 3
- Non automatisé : 1
- Incohérents : 0
- Sans justification : 0

## Couverture par branche

- alimony : 2
- alone : 1
- alternating_care : 2
- children_and_third_parties : 1
- children_only : 4
- cohousing : 1
- mixed_or_unsupported : 1
- relatives_only : 3
- spouse_or_partner : 6

## Co-housing

État : **Décision ONEM requise**. Le Bureau du chômage peut effectuer une enquête sur la situation réelle avant de décider si le chômeur peut être considéré comme isolé.

## Trous du moteur

- Les compositions mixed_or_unsupported restent explicitement non automatisées ; aucune catégorie n’est devinée.
- Les catégories issues d’une appréciation de fait (dont le co-housing) restent soumises à la décision ONEM.

## Contrats

| Scénario | Branche | Résultat | Catégorie | Justification |
| --- | --- | --- | --- | --- |
| composition-missing | alone | information_missing | — | La composition réelle du ménage n'est pas encore renseignée. |
| spouse-missing-income | spouse_or_partner | information_missing | — | Des informations sont nécessaires pour évaluer la situation familiale. |
| spouse-no-income | spouse_or_partner | decision_determined | A | Le conjoint ou partenaire est prioritaire pour l'évaluation de la situation familiale. |
| spouse-cdi-below | spouse_or_partner | decision_determined | A | Le conjoint ou partenaire est prioritaire pour l'évaluation de la situation familiale. |
| spouse-cdi-at-threshold | spouse_or_partner | decision_determined | A | Le conjoint ou partenaire est prioritaire pour l'évaluation de la situation familiale. |
| spouse-cdi-above | spouse_or_partner | decision_determined | B | Le conjoint ou partenaire est prioritaire pour l'évaluation de la situation familiale. |
| spouse-variable-c110a-missing | spouse_or_partner | document_required | B | Les éléments déclarés nécessitent une vérification avant de déterminer la catégorie. |
| children-allowances | children_only | decision_determined | A | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| children-income | children_only | decision_determined | B | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| children-110-1m | children_only | decision_determined | A | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| children-110-1v | children_only | decision_determined | B | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| relative-pension-document-missing | relatives_only | document_required | — | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| relative-pension-at-threshold | relatives_only | decision_determined | A | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| relative-pension-above | relatives_only | decision_determined | B | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| child-third-party-income | children_and_third_parties | decision_determined | B | La catégorie résulte de la composition du ménage et des revenus déclarés. |
| alimony-document-pending | alimony | document_required | — | Les éléments déclarés nécessitent une vérification avant de déterminer la catégorie. |
| alimony-established | alimony | onem_decision_required | A | Les éléments déclarés nécessitent une vérification avant de déterminer la catégorie. |
| alternating-care-pending | alternating_care | document_required | — | Les éléments déclarés nécessitent une vérification avant de déterminer la catégorie. |
| alternating-care-established | alternating_care | onem_decision_required | A | Les éléments déclarés nécessitent une vérification avant de déterminer la catégorie. |
| cohousing-complete | cohousing | onem_decision_required | — | La situation de co-housing est appréciée par l’ONEM sur la situation réelle.  Le Bureau du chômage peut effectuer une enquête avant de décider si le chômeur peut être considéré comme isolé. |
| unknown-relation | mixed_or_unsupported | not_automated | — | Des informations sont nécessaires pour évaluer la situation familiale. |
