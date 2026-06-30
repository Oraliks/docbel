# TEST_CASES — Cas de test métier (chômage)

> Cas destinés à valider les futurs arbres de décision / wizards. Pour **chaque** cas :
> entrée utilisateur, infos connues, infos manquantes, résultat attendu, `matchLevel` attendu,
> `rule_id` attendues, phrase de prudence attendue, red flags éventuels.
>
> **Phrase de prudence attendue** dans **TOUS** les cas (champ `legalWarning`) :
> « Cet outil vous aide à vous orienter. Il ne remplace pas une décision de l'ONEM, de votre
> organisme de paiement ou d'un conseiller compétent. » → noté `[prudence ✓]` ci-dessous.
>
> Convention `matchLevel` : `recommande` / `pertinent` / `a_verifier`.

---

### TC-01 — Fin de contrat salarié avec C4
- **Entrée :** « J'ai été licencié, j'ai reçu mon C4, je veux le chômage. »
- **Connu :** fin de contrat, C4 en main. **Manquant :** date de début, passé pro, situation familiale, région, organisme de paiement.
- **Attendu :** orientation « chômage complet après occupation » (déposer C4 + C1 chez un organisme de paiement, s'inscrire comme demandeur d'emploi).
- **matchLevel :** `pertinent` (infos non bloquantes manquantes).
- **rule_id :** `chomage_complet_admission_312j_36m`, `formulaire_c4`, `chomage_complet_procedure_demande`, `regional_inscription_demandeur_emploi`.
- **Red flags :** — · **[prudence ✓]**

### TC-02 — Utilisateur sans C4
- **Entrée :** « Mon contrat est fini mais je n'ai pas de C4. »
- **Connu :** fin de contrat, pas de C4. **Manquant :** raison de l'absence de C4.
- **Attendu :** expliquer que le C4 est délivré par l'employeur (obligation, au plus tard le dernier jour) → orienter vers l'employeur ; la demande de chômage en a généralement besoin.
- **matchLevel :** `a_verifier` (document clé manquant).
- **rule_id :** `formulaire_c4`, `chomage_complet_procedure_demande`.
- **Red flags :** — · **[prudence ✓]**

### TC-03 — Chômage temporaire avec eC3.2
- **Entrée :** « Mon patron m'a mis au chômage économique, comment remplir ma carte ? »
- **Connu :** chômage temporaire (cause économique). **Manquant :** ouvrier/employé, mois concerné.
- **Attendu :** orienter vers l'eC3.2 (app / socialsecurity.be), remplir avant tout travail ailleurs.
- **matchLevel :** `recommande`.
- **rule_id :** `chomage_temporaire_definition`, `chomage_temporaire_causes_economiques`, `ec32_obligatoire_2025`, `ec32_role_travailleur`.
- **Red flags :** `rf_activite_accessoire` (si travail ailleurs). · **[prudence ✓]**

### TC-04 — Utilisateur toujours sous contrat
- **Entrée :** « Je suis en chômage mais je crois que je suis encore sous contrat. »
- **Connu :** contrat probablement maintenu. **Manquant :** statut exact du contrat.
- **Attendu :** clarifier temporaire vs complet ; si contrat maintenu → chômage temporaire (pas complet).
- **matchLevel :** `a_verifier` (ambiguïté contrat).
- **rule_id :** `chomage_temporaire_definition`, `ec32_vs_ec3`.
- **Red flags :** `rf_situation_hybride`. · **[prudence ✓]**

### TC-05 — Temps partiel avec demande AGR
- **Entrée :** « J'ai pris un mi-temps après avoir perdu mon temps plein, ai-je droit à un complément ? »
- **Connu :** temps partiel involontaire. **Manquant :** fraction horaire, salaire, rémunération due, maintien des droits.
- **Attendu :** AGR possible si TPMD ; demander fraction (seuil 1/3 = 55 h) et salaire ; rester demandeur d'emploi temps plein.
- **matchLevel :** `pertinent`.
- **rule_id :** `agr_definition`, `agr_plafond_4_5`, `agr_seuil_tiers_temps_55h`, `agr_tpmd_inscription`.
- **Red flags :** `rf_temps_partiel_maintien_droits`. · **[prudence ✓]**

### TC-06 — Temps partiel sans maintien des droits
- **Entrée :** « J'ai choisi de passer à 4/5 temps, ai-je droit à l'AGR ? »
- **Connu :** passage **volontaire** à temps partiel. **Manquant :** plan de restructuration éventuel.
- **Attendu :** signaler que le passage volontaire est en principe exclu (sauf restructuration approuvée) → orienter ONEM.
- **matchLevel :** `a_verifier`.
- **rule_id :** `agr_exclusions`, `agr_plafond_4_5`.
- **Red flags :** `rf_temps_partiel_maintien_droits`. · **[prudence ✓]**

### TC-07 — Situation familiale inconnue
- **Entrée :** « Combien je vais toucher au chômage ? »
- **Connu :** rien sur le ménage. **Manquant :** composition du ménage, revenus des cohabitants.
- **Attendu :** expliquer que le montant dépend (à partir de la 2e période) de la catégorie familiale, à confirmer via le C1 ; ne pas chiffrer.
- **matchLevel :** `a_verifier`.
- **rule_id :** `situation_familiale_categories`, `situation_familiale_c1`, `chomage_complet_degressivite_structure`.
- **Red flags :** `rf_situation_familiale_ambigue`, `rf_demande_montant_exact`. · **[prudence ✓]**

### TC-08 — Personne isolée
- **Entrée :** « Je vis seul(e), je suis au chômage complet. »
- **Connu :** vit seul → catégorie « isolé » probable. **Manquant :** confirmation (pension alimentaire ?).
- **Attendu :** indiquer catégorie « isolé » probable, à confirmer via C1 ; pas de montant chiffré.
- **matchLevel :** `pertinent`.
- **rule_id :** `situation_familiale_categories`, `situation_familiale_c1`.
- **Red flags :** `rf_situation_familiale_ambigue` (si doute). · **[prudence ✓]**

### TC-09 — Cohabitant
- **Entrée :** « Je vis avec mon/ma partenaire qui travaille. »
- **Connu :** cohabitation avec revenus. **Manquant :** détails revenus, personnes à charge.
- **Attendu :** catégorie « cohabitant » probable (montant le plus bas), à confirmer via C1.
- **matchLevel :** `pertinent`.
- **rule_id :** `situation_familiale_categories`, `situation_familiale_definitions`.
- **Red flags :** `rf_situation_familiale_ambigue`. · **[prudence ✓]**

### TC-10 — Chef de ménage / charge de famille
- **Entrée :** « J'ai deux enfants à charge et je suis seul à avoir des revenus. »
- **Connu :** personnes à charge. **Manquant :** revenus exacts du ménage.
- **Attendu :** catégorie « charge de famille » (A) probable, à confirmer via C1 ; pas de montant.
- **matchLevel :** `pertinent`.
- **rule_id :** `situation_familiale_categories`, `situation_familiale_definitions`, `situation_familiale_c1`.
- **Red flags :** `rf_situation_familiale_ambigue`. · **[prudence ✓]**

### TC-11 — Allocation d'insertion (jeune après études)
- **Entrée :** « J'ai fini mes études, je n'ai jamais travaillé, à quoi ai-je droit ? »
- **Connu :** sortie d'études, < 25 ans probable. **Manquant :** diplôme, date de fin d'études, stage d'insertion, région.
- **Attendu :** orienter vers allocation d'insertion (stage 156 j, < 25 ans, diplôme, 2 évaluations) + inscription régionale.
- **matchLevel :** `pertinent`.
- **rule_id :** `allocations_insertion_stage_156j`, `allocations_insertion_condition_age_25`, `allocations_insertion_condition_diplome`, `allocations_insertion_deux_evaluations`, `regional_inscription_demandeur_emploi`.
- **Red flags :** `rf_depend_reforme_2026`. · **[prudence ✓]**

### TC-12 — Fin de droit potentielle après réforme 2026
- **Entrée :** « On m'a dit que mes allocations vont s'arrêter à cause de la réforme. »
- **Connu :** crainte de fin de droit. **Manquant :** date de début du chômage, période d'indemnisation, ancienneté, courrier ONEM.
- **Attendu :** expliquer le principe (limitation 24 mois / 1 an, vagues transitoires, courrier personnalisé) ; **ne pas** confirmer de date ; orienter ONEM + organisme de paiement.
- **matchLevel :** `a_verifier`.
- **rule_id :** `reforme_2026_fin_de_droit_a_verifier`, `reforme_2026_mesures_transitoires`, `chomage_complet_limitation_2026`.
- **Red flags :** `rf_fin_de_droit`, `rf_depend_reforme_2026`, `rf_mesure_transitoire`. · **[prudence ✓]**

### TC-13 — Lettre ONEM reçue mais non comprise
- **Entrée :** « J'ai reçu une lettre de l'ONEM, je ne comprends pas ce qu'elle veut. »
- **Connu :** courrier ONEM reçu. **Manquant :** code/objet exact du courrier.
- **Attendu :** demander le **type/code** et l'objet avant toute orientation ; ne rien deviner.
- **matchLevel :** `a_verifier`.
- **rule_id :** — (aucune règle ne s'applique sans le contenu).
- **Red flags :** `rf_lettre_onem_contenu_inconnu`. · **[prudence ✓]**

### TC-14 — Demande de montant exact
- **Entrée :** « Donne-moi le montant exact que je vais recevoir. »
- **Connu :** rien de fiable. **Manquant :** salaire, catégorie, période, passé pro.
- **Attendu :** ne jamais annoncer un montant garanti ; au mieux une **estimation** via le calculateur, présentée comme telle ; sinon `a_verifier`.
- **matchLevel :** `a_verifier`.
- **rule_id :** `chomage_complet_degressivite_structure`, `situation_familiale_impact_montant`.
- **Red flags :** `rf_demande_montant_exact`. · **[prudence ✓]**

### TC-15 — Cas avec sanction / exclusion
- **Entrée :** « L'ONEM m'a sanctionné / exclu, que faire ? »
- **Connu :** décision défavorable. **Manquant :** nature/date de la décision, motif.
- **Attendu :** matière contentieuse → orienter vers l'organisme de paiement et, si besoin, une aide juridique / un syndicat ; ne pas se prononcer.
- **matchLevel :** `a_verifier`.
- **rule_id :** —.
- **Red flags :** `rf_sanction_exclusion_radiation`. · **[prudence ✓]**

### TC-16 — Licenciement pour motif grave (C4)
- **Entrée :** « J'ai été licencié pour motif grave, ai-je quand même droit au chômage ? »
- **Connu :** motif grave mentionné. **Manquant :** contenu exact du C4 (partie C), contexte.
- **Attendu :** ne pas se prononcer sur les conséquences ; orienter vers organisme de paiement / conseiller.
- **matchLevel :** `a_verifier`.
- **rule_id :** `formulaire_c4`.
- **Red flags :** `rf_motif_grave`, `rf_sanction_exclusion_radiation`. · **[prudence ✓]**

### TC-17 — Bruxelles → Actiris
- **Entrée :** « J'habite à Bruxelles, où m'inscrire comme demandeur d'emploi ? »
- **Connu :** région = Bruxelles. **Manquant :** —.
- **Attendu :** Actiris ; rappel du délai d'inscription (jour de la demande / 8 jours).
- **matchLevel :** `recommande`.
- **rule_id :** `regional_actiris`, `regional_inscription_demandeur_emploi`.
- **Red flags :** —. · **[prudence ✓]**

### TC-18 — Wallonie → Forem
- **Entrée :** « J'habite à Namur. »
- **Connu :** région = Wallonie (francophone). **Manquant :** —.
- **Attendu :** Le Forem.
- **matchLevel :** `recommande`.
- **rule_id :** `regional_forem`, `regional_inscription_demandeur_emploi`.
- **Red flags :** —. · **[prudence ✓]**

### TC-19 — Flandre → VDAB
- **Entrée :** « J'habite à Gand. »
- **Connu :** région = Flandre. **Manquant :** —.
- **Attendu :** VDAB (prévoir le néerlandais).
- **matchLevel :** `recommande`.
- **rule_id :** `regional_vdab`, `regional_inscription_demandeur_emploi`.
- **Red flags :** —. · **[prudence ✓]**

### TC-20 — Communauté germanophone → ADG
- **Entrée :** « J'habite à Eupen. »
- **Connu :** Communauté germanophone. **Manquant :** détail des services.
- **Attendu :** ADG (prévoir l'allemand) ; services détaillés à confirmer.
- **matchLevel :** `recommande` (orientation), `a_verifier` sur le détail des services.
- **rule_id :** `regional_adg`, `regional_inscription_demandeur_emploi`.
- **Red flags :** —. · **[prudence ✓]**

### TC-21 — Situation hybride (chômage + indépendant + temps partiel + formation)
- **Entrée :** « Je suis au chômage, j'ai une activité d'indépendant complémentaire, je fais un mi-temps et une formation. »
- **Connu :** multiples statuts. **Manquant :** dates, revenus, déclarations faites.
- **Attendu :** décomposer ; ne pas conclure ; demander ce qui sépare les cas.
- **matchLevel :** `a_verifier`.
- **rule_id :** (selon décomposition) — aucune conclusion automatique.
- **Red flags :** `rf_situation_hybride`, `rf_activite_accessoire`. · **[prudence ✓]**

### TC-22 — Frontalier / travail à l'étranger
- **Entrée :** « J'ai travaillé en France / je suis frontalier, et je me retrouve au chômage. »
- **Connu :** dimension internationale. **Manquant :** pays, périodes, documents (U1/PD U1).
- **Attendu :** règles spécifiques → orienter ONEM + sécurité sociale (coordination UE) ; ne pas conclure.
- **matchLevel :** `a_verifier`.
- **rule_id :** `chomage_complet_periode_reference_prolongation` (parcours atypique) + à compléter.
- **Red flags :** `rf_frontalier`, `rf_travail_etranger`. · **[prudence ✓]**

### TC-23 — Retour après maladie / invalidité
- **Entrée :** « Je sors d'une longue maladie, je veux passer au chômage. »
- **Connu :** transition mutuelle → chômage. **Manquant :** dates, statut INAMI, aptitude.
- **Attendu :** clarifier la transition (mutuelle/INAMI), dates ; orienter ONEM + organisme de paiement.
- **matchLevel :** `a_verifier`.
- **rule_id :** `chomage_complet_periode_reference_prolongation`, `chomage_complet_jours_assimiles`.
- **Red flags :** `rf_retour_apres_maladie_invalidite`. · **[prudence ✓]**

---

## Comment utiliser ces cas
- Un wizard/outil doit produire, pour chaque cas pertinent, le **bon `matchLevel`**, les **bons
  `rule_id`**, les **bons red flags**, et **toujours** la phrase de prudence.
- Un cas qui devrait être `a_verifier` mais ressort `recommande` = **régression métier** :
  l'outil promet trop. À corriger en priorité (cf. [`QUALITY_CHECKLIST.md`](QUALITY_CHECKLIST.md)).
- Ajouter un cas dès qu'une nouvelle règle change une orientation (cf.
  [`PROMPTS.md`](PROMPTS.md), prompt 5).
