# Rules Index — Chômage Belgique

> Table d'aiguillage de **toutes les règles** métier. Permet à un agent de savoir vite quel
> fichier `knowledge/` ouvrir. **Toute règle utilisée dans un outil/wizard doit figurer ici.**
>
> Légende statut/confiance : `official` (lu sur source institutionnelle), `high`, `medium`,
> `to_verify`. Statut : `active`, `transitional`, `deprecated`, `to_verify`.
> Date de mise à jour de l'index : **2026-06-30**.

## Réforme 2026 — `reforme-2026.md`
| rule_id | statut / confiance | résumé |
|---------|--------------------|--------|
| `reforme_2026_entree_vigueur` | active / official | Réforme en vigueur le 01/03/2026 (transition dès 01/07/2025) |
| `chomage_complet_limitation_2026` | active / official | Chômage complet limité à 24 mois (12 + jusqu'à 12 selon passé pro) |
| `allocations_insertion_limitation_2026` | active / official | Allocations d'insertion limitées à 1 an |
| `reforme_2026_exemptions_limitation` | active / official | 6 catégories exemptées de la limitation |
| `reforme_2026_mesures_transitoires` | transitional / high | Bénéficiaires existants traités par vagues (dates exactes à vérifier) |
| `reforme_2026_fin_de_droit_a_verifier` | to_verify / to_verify | Toute fin de droit individuelle = a_verifier |
| `chomage_complet_degressivite_exceptions` | active / official | 3 exceptions à la dégressivité (55 ans / 33 % / passé pro) |

## Chômage complet — `chomage-complet.md`
| rule_id | statut / confiance | résumé |
|---------|--------------------|--------|
| `chomage_complet_admission_312j_36m` | active / official | 312 jours de travail/assimilés sur 36 mois, quel que soit l'âge |
| `chomage_complet_jours_assimiles` | active / official | Définition des jours de travail et assimilés |
| `chomage_complet_periode_reference_prolongation` | active / official | Prolongation de la période de référence (max 15 ans) |
| `chomage_complet_degressivite_structure` | active / official | Structure : 1re période 12 mois dégressive, 2e période forfait familial |

## Chômage temporaire — `chomage-temporaire.md`
| rule_id | statut / confiance | résumé |
|---------|--------------------|--------|
| `chomage_temporaire_definition` | active / official | Contrat maintenu, exécution suspendue |
| `chomage_temporaire_formes` | active / official | 6 formes reconnues |
| `chomage_temporaire_causes_economiques` | active / official | Ouvriers + employés ; crédit employés 16/26 semaines |
| `chomage_temporaire_force_majeure` | active / official | Événement soudain/imprévisible/indépendant |
| `chomage_temporaire_accident_technique` | active / official | Ouvriers, dès 8e jour, 7 jours salaire (durée max non confirmée) |
| `chomage_temporaire_intemperies` | active / official | Ouvriers ; lien direct intempéries/travaux |

## eC3.2 — `ec32.md`
| rule_id | statut / confiance | résumé |
|---------|--------------------|--------|
| `ec32_obligatoire_2025` | active / official | Obligatoire depuis 01/01/2025 (exception CP 327) |
| `ec32_role_travailleur` | active / official | Le travailleur encode lui-même (codes blanc/T/M/V/A) |
| `ec32_acces` | active / official | App / socialsecurity.be, eID/itsme |
| `ec32_employeur_pas_acces` | active / official | L'employeur ne peut s'opposer et n'a pas accès |
| `ec32_exception_cp327` | active / official | Ateliers protégés CP 327 = papier possible |
| `ec32_vs_ec3` | active / official | eC3.2 (temporaire) ≠ eC3 (complet) |

## Temps partiel / AGR — `agr-temps-partiel.md`
| rule_id | statut / confiance | résumé |
|---------|--------------------|--------|
| `agr_definition` | active / official | AGR = complément de revenu du temps partiel avec maintien des droits |
| `agr_plafond_4_5` | active / official | Horaire moyen ≤ 4/5 d'un temps plein |
| `agr_seuil_tiers_temps_55h` | active / official | Seuil 1/3 temps = 55 h/mois (base 38 h/sem) |
| `agr_tpmd_inscription` | active / official | Rester demandeur d'emploi à temps plein et disponible |
| `agr_exclusions` | active / official | Pas d'AGR si rémunération due ; passage volontaire exclu ; carence 3 mois |
| `agr_montants_2026` | active / official | Montants indexés ; ne pas recalculer sans formule officielle |

## Situation familiale — `situation-familiale-c1-t147.md`
| rule_id | statut / confiance | résumé |
|---------|--------------------|--------|
| `situation_familiale_c1` | active / official | C1 = déclaration situation perso/familiale (impact droit et montant) |
| `situation_familiale_categories` | active / high | 3 catégories A (charge famille) / N (isolé) / B (cohabitant) |
| `situation_familiale_definitions` | to_verify / to_verify | Définitions détaillées + seuils non confirmés (page en refonte) |
| `situation_familiale_impact_montant` | active / official | 2e période = forfait selon catégorie familiale |

## Formulaires — `formulaires-onem.md`
| rule_id | statut / confiance | résumé |
|---------|--------------------|--------|
| `formulaire_c1` | active / official | C1 fourni par l'organisme de paiement, complété par le demandeur |
| `formulaire_c4` | active / official | C4 = certificat de chômage de l'employeur (+ C4-DRS papier) |
| `chomage_complet_procedure_demande` | active / official | Demande après occupation : C4 + C1 chez un organisme de paiement |
| `formulaire_c109_36_demande` | active / high | C109/36-demande (versions avant/après 01/03/2026) |
| `formulaire_c109_seul` | to_verify / to_verify | Usage du C109 seul non confirmé |
| `formulaire_ec32` | active / official | eC3.2 = carte de contrôle du chômage temporaire |

## Allocations d'insertion — `allocations-insertion.md`
| rule_id | statut / confiance | résumé |
|---------|--------------------|--------|
| `allocations_insertion_duree_12m_2026` | active / official | Durée limitée à 12 mois (régime 2026) |
| `allocations_insertion_prolongation_variable` | active / official | Prolongation = durée égale aux périodes de travail/assimilés (pas un forfait) |
| `allocations_insertion_stage_156j` | active / official | Stage d'insertion = 156 jours (ancien : 310) |
| `allocations_insertion_condition_age_25` | active / official | Ne pas avoir atteint 25 ans à la demande |
| `allocations_insertion_condition_diplome` | active / official | Diplôme/certificat reconnu requis |
| `allocations_insertion_deux_evaluations` | active / official | 2 évaluations positives régionales avant octroi |
| `allocations_insertion_ancien_regime_310j_36m` | deprecated / official | Ancien régime (310 jours / 36 mois) — historique |

## Organismes régionaux — `organismes-regionaux.md`
| rule_id | statut / confiance | résumé |
|---------|--------------------|--------|
| `regional_inscription_demandeur_emploi` | active / official | Inscription régionale (jour de la demande / 8 jours) |
| `regional_actiris` | active / official | Actiris = Bruxelles |
| `regional_forem` | active / official | Le Forem = Wallonie |
| `regional_vdab` | active / official | VDAB = Flandre |
| `regional_adg` | active / medium | ADG = Communauté germanophone (services détaillés à vérifier) |

---

## Ajouter une règle
1. Écrire le bloc YAML dans le bon fichier `knowledge/` (cf. [README](../../knowledge/chomage/README.md)).
2. Ajouter une ligne ici dans la section du thème (rule_id, statut/confiance, résumé court).
3. Si la règle est câblée dans un outil/wizard, son `rule_id` **doit** apparaître ici — sinon
   l'agent considère qu'elle n'existe pas et bascule en `a_verifier`.

## Règles `to_verify` (à ne pas utiliser pour conclure)
- `reforme_2026_fin_de_droit_a_verifier`
- `situation_familiale_definitions`
- `formulaire_c109_seul`

Ces règles servent à **cadrer** un `a_verifier`, jamais à fonder une conclusion ferme.
