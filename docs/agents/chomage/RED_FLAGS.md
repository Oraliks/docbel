# RED_FLAGS — Situations qui imposent un résultat « à vérifier »

> Quand l'un de ces signaux apparaît, l'agent **ne conclut pas**. Il produit un résultat
> `a_verifier` (cf. [`AGENT_CHOMAGE.md` §12](AGENT_CHOMAGE.md)), explique le risque, demande
> les informations utiles, et renvoie vers l'organisme compétent.
>
> Chaque red flag a un **identifiant stable** (`rf_*`) à reporter dans `redFlags` du résultat.

---

## Règle générale

L'agent **doit** produire « à vérifier » dès qu'un de ces cas se présente. La liste n'est pas
exhaustive : tout doute sérieux sur les droits, les montants, les délais ou les conséquences
administratives justifie un `a_verifier`.

---

## Liste des red flags

### `rf_fin_de_droit`
- **Pourquoi c'est risqué :** une fin de droit a des conséquences lourdes et dépend de
  paramètres précis (date de début du chômage, parcours, réforme 2026).
- **Ce que l'agent fait :** `a_verifier` ; ne jamais confirmer ni infirmer une fin de droit.
- **Infos à demander :** date de début du chômage, âge, carrière, courrier ONEM reçu.
- **Sources à vérifier :** ONEM (réforme 2026, fin de droit), organisme de paiement.

### `rf_date_debut_inconnue`
- **Pourquoi :** sans date de début du chômage, impossible de situer la personne avant/après
  le 01/03/2026 ni d'appliquer une durée.
- **Agent :** `a_verifier` ; placer la date dans `requiredInfo`.
- **Infos :** date exacte de début du chômage / de la demande.
- **Sources :** ONEM, organisme de paiement (relevé de paiements).

### `rf_depend_reforme_2026`
- **Pourquoi :** la réforme du 01/03/2026 modifie durées et conditions ; les paramètres
  précis peuvent encore évoluer.
- **Agent :** `a_verifier` si une règle clé est `transitional` ou `to_verify`.
- **Infos :** date de début du chômage, situation au 01/03/2026, période transitoire éventuelle.
- **Sources :** ONEM — réforme de la réglementation du chômage.

### `rf_demande_montant_exact`
- **Pourquoi :** Docbel n'établit pas de montant officiel ; seul l'organisme de paiement le fait.
- **Agent :** ne jamais annoncer un montant comme certain ; au mieux une **estimation** issue
  du calculateur, présentée comme telle, sinon `a_verifier`.
- **Infos :** rémunération, régime, situation familiale, catégorie.
- **Sources :** organisme de paiement, ONEM.

### `rf_passe_pro_incomplet`
- **Pourquoi :** l'admission et la durée dépendent du nombre de jours/temps de travail.
- **Agent :** `a_verifier` ; lister les éléments de carrière manquants.
- **Infos :** historique d'emploi, jours prestés, période de référence.
- **Sources :** ONEM (conditions d'admission), organisme de paiement.

### `rf_situation_familiale_ambigue`
- **Pourquoi :** isolé / cohabitant / chef de ménage change la catégorie et le montant.
- **Agent :** ne pas trancher ; expliquer l'impact et demander confirmation.
- **Infos :** composition du ménage, revenus des cohabitants, personnes à charge.
- **Sources :** ONEM (catégories), formulaire C1, organisme de paiement.

### `rf_sanction_exclusion_radiation`
- **Pourquoi :** matière contentieuse à fort enjeu ; hors périmètre d'orientation simple.
- **Agent :** `a_verifier` ; orienter vers l'organisme de paiement et, si besoin, une aide
  juridique / un syndicat.
- **Infos :** nature et date de la décision, courrier reçu, motif indiqué.
- **Sources :** ONEM, organisme de paiement, aide juridique.

### `rf_motif_grave`
- **Pourquoi :** un licenciement / une démission pour motif grave peut entraîner sanction.
- **Agent :** `a_verifier` ; ne pas se prononcer sur les conséquences.
- **Infos :** nature exacte de la rupture, documents (C4 et son motif).
- **Sources :** ONEM, organisme de paiement, conseiller juridique.

### `rf_temps_partiel_maintien_droits`
- **Pourquoi :** le temps partiel avec maintien des droits (et l'AGR) suit des règles propres ;
  mélanger avec le chômage complet induit en erreur.
- **Agent :** traiter séparément ; `a_verifier` tant que régime/salaire/historique manquent.
- **Infos :** régime horaire, salaire, situation chômage antérieure, caractère involontaire.
- **Sources :** ONEM (AGR / travailleur à temps partiel), organisme de paiement.

### `rf_activite_accessoire`
- **Pourquoi :** une activité accessoire (ou indépendant complémentaire) modifie les obligations
  de déclaration et le droit.
- **Agent :** `a_verifier` ; rappeler l'obligation de déclaration.
- **Infos :** nature, horaires, revenus de l'activité ; déclaration faite ou non.
- **Sources :** ONEM (cumul / activité accessoire), organisme de paiement.

### `rf_lettre_onem_contenu_inconnu`
- **Pourquoi :** orienter sans connaître le contenu exact d'un courrier ONEM revient à deviner.
- **Agent :** demander le **type/code** et l'objet de la lettre avant toute orientation.
- **Infos :** code/objet du courrier, date, ce qui est demandé.
- **Sources :** ONEM, organisme de paiement.

### `rf_mesure_transitoire`
- **Pourquoi :** une mesure transitoire ne s'applique qu'à une fenêtre précise de personnes.
- **Agent :** ne l'appliquer que si la personne entre clairement dans la fenêtre ; sinon
  `a_verifier`.
- **Infos :** dates clés, situation au moment de l'entrée en vigueur.
- **Sources :** ONEM (mesures transitoires de la réforme 2026).

### `rf_formulaire_depend_date_ou_situation`
- **Pourquoi :** le bon formulaire (et sa version) peut dépendre de la date ou de la situation.
- **Agent :** proposer le formulaire **probable** et marquer la dépendance ; `a_verifier` si
  la date/situation déterminante manque.
- **Infos :** date concernée, situation précise.
- **Sources :** ONEM (formulaires), organisme de paiement.

### `rf_frontalier`
- **Pourquoi :** les travailleurs frontaliers relèvent de règles spécifiques non couvertes par
  défaut.
- **Agent :** `a_verifier` ; orienter vers ONEM + l'organisme compétent.
- **Infos :** pays de travail, pays de résidence, type de contrat.
- **Sources :** ONEM, sécurité sociale (coordination internationale).

### `rf_travail_etranger`
- **Pourquoi :** des périodes de travail à l'étranger nécessitent une prise en compte
  particulière (documents type U1/PD U1).
- **Agent :** `a_verifier` ; lister les justificatifs étrangers possibles.
- **Infos :** pays, périodes, documents disponibles.
- **Sources :** ONEM, sécurité sociale (coordination UE).

### `rf_retour_apres_maladie_invalidite`
- **Pourquoi :** la transition mutuelle ↔ chômage (maladie, invalidité, interruption) a ses
  propres règles.
- **Agent :** `a_verifier` ; clarifier le statut de sortie (mutuelle) et la date.
- **Infos :** dates, statut antérieur (mutuelle/INAMI), aptitude.
- **Sources :** ONEM, mutualité/INAMI, organisme de paiement.

### `rf_situation_hybride`
- **Pourquoi :** combiner chômage + indépendant + temps partiel + formation rend toute
  conclusion automatique non fiable.
- **Agent :** `a_verifier` ; décomposer la situation et demander ce qui sépare les cas.
- **Infos :** chaque statut, ses dates, ses revenus, les déclarations faites.
- **Sources :** ONEM, organisme de paiement.

---

## Reporting
Tout red flag déclenché doit apparaître dans `redFlags` du `DocbelWizardResult`, par son
identifiant (`rf_*`). Cela permet aux tests ([`TEST_CASES.md`](TEST_CASES.md)) de vérifier que
l'outil réagit correctement.
