# Formulaires ONEM (inventaire)

> **Thème :** `formulaires`. Inventaire vulgarisé des principaux formulaires/cartes. Pour chacun :
> nom, usage, situation typique, source, statut de vérification, red flags, notes Docbel.
>
> ⚠️ Ne pas inventer un usage précis non vérifié. Le **bon** formulaire peut dépendre d'une
> **date** (versions « jusqu'au 28.02.2026 » vs « à partir du 01.03.2026 ») ou d'une **situation**
> → `rf_formulaire_depend_date_ou_situation`.

---

## C1 — Déclaration de la situation personnelle et familiale
- **Usage vulgarisé :** déclarer sa situation perso/familiale (détermine la catégorie familiale).
- **Situation typique :** première demande d'allocations après une occupation.
- **Qui le fournit :** l'**organisme de paiement** ; **complété par le demandeur**.
- **Source :** ONEM — <https://www.onem.be/formulaires-attestations/c1>
- **Statut :** confirmé (`official`).
- **Red flags :** `rf_situation_familiale_ambigue` (catégorie incertaine).
- **Notes Docbel :** ne pas remplir à la place de la personne ; détails dans
  [`situation-familiale-c1-t147.md`](situation-familiale-c1-t147.md).

## C4 — Certificat de chômage
- **Usage vulgarisé :** document de **fin d'occupation** remis par l'**employeur**, nécessaire
  pour demander le chômage.
- **Situation typique :** fin d'un contrat (licenciement, fin de CDD, rupture).
- **Qui le fournit :** l'**employeur**, **d'initiative et au plus tard le dernier jour de
  travail** (parties A à E : occupation, ONSS, circonstances de fin, indemnités, Pacte des
  générations). En cas de déclaration électronique (DRS), un **C4-DRS papier** complémentaire est
  remis au travailleur.
- **Source :** ONEM — <https://www.onem.be/employeurs/chomage-complet/formulaire-c4-certificat-de-chomage>
- **Statut :** confirmé (`official`).
- **Red flags :** `rf_motif_grave` (motif de fin sensible), `rf_sanction_exclusion_radiation`.
- **Notes Docbel :** sans C4, orienter la personne vers son employeur pour l'obtenir.

## C109/36 — Demande d'allocations d'insertion
- **Usage vulgarisé :** demander les **allocations d'insertion** (après études).
- **Documents liés :** **C109/36-DEMANDE** (la demande), **C109/36-diplôme** (preuve de diplôme),
  **C36.3** (autorisation formation/stage à l'étranger).
- **Situation typique :** jeune sortant des études, après le stage d'insertion.
- **Qui le fournit :** via l'**organisme de paiement** (CAPAC ou syndicat).
- **Source :** ONEM — version **à partir du 01.03.2026** :
  <https://www.onem.be/formulaires-attestations/c10936-demande-a-partir-du-01.03.2026> ·
  version **jusqu'au 28.02.2026** :
  <https://www.onem.be/formulaires-attestations/c109-36-demande-jusqu-au-28.02.2026>
- **Statut :** existence des deux versions confirmée (`official`) ; détail procédural exact
  (`high`, page descriptive partiellement en refonte).
- **Red flags :** `rf_formulaire_depend_date_ou_situation` (choisir la bonne version selon la date).
- **Notes Docbel :** voir [`allocations-insertion.md`](allocations-insertion.md).

## C109 (seul) — à vérifier
- **Usage vulgarisé :** formulaire de la famille C109 distinct du C109/36 — **usage exact non
  confirmé** (PDF officiel non lisible lors de la vérification).
- **Statut :** `to_verify` (`TODO_SOURCE_OFFICIELLE`).
- **Notes Docbel :** ne pas affirmer son usage ; renvoyer à l'ONEM.

## eC3.2 — Carte de contrôle électronique (chômage temporaire)
- **Usage vulgarisé :** déclarer jour par jour sa situation en **chômage temporaire**.
- **Situation typique :** mise en chômage temporaire par l'employeur.
- **Qui la remplit :** le **travailleur** (l'employeur n'y a pas accès), via app / socialsecurity.be.
- **Source :** ONEM — <https://www.onem.be/employeurs/chomage-temporaire/chomage-temporaire---la-carte-de-controle-electronique-ec3.2>
- **Statut :** confirmé (`official`).
- **Red flags :** `rf_activite_accessoire` (travail ailleurs à déclarer avant).
- **Notes Docbel :** distincte de l'**eC3** (chômage complet). Détails : [`ec32.md`](ec32.md).

## Autres formulaires (à ajouter plus tard)
- **eC3** (carte chômage complet), **C36.3** (formation/stage à l'étranger), feuilles info
  (T-series). À documenter au fil des besoins, toujours avec source officielle.

---

## Règles

```yaml
rule_id: formulaire_c1
theme: formulaires
effective_from: unknown
source_name: ONEM — C1
source_url: https://www.onem.be/formulaires-attestations/c1
last_verified: 2026-06-30
confidence: official
status: active
summary: >
  C1 = Déclaration de la situation personnelle et familiale, fournie par l'organisme de paiement
  et complétée par le demandeur ; détermine notamment la catégorie familiale.
agent_instruction: >
  Orienter vers l'organisme de paiement pour obtenir/compléter le C1 ; insister sur l'exactitude.
red_flags:
  - rf_situation_familiale_ambigue
related_forms:
  - C1
related_topics:
  - situation_familiale
  - chomage_complet
```

```yaml
rule_id: formulaire_c4
theme: formulaires
effective_from: unknown
source_name: ONEM — Formulaire C4-Certificat de chômage (employeurs)
source_url: https://www.onem.be/employeurs/chomage-complet/formulaire-c4-certificat-de-chomage
last_verified: 2026-06-30
confidence: official
status: active
summary: >
  C4 = Certificat de chômage, délivré par l'employeur (d'initiative, au plus tard le dernier jour
  de travail). En cas de C4 électronique (DRS), un formulaire papier C4-DRS complémentaire est
  remis au travailleur.
agent_instruction: >
  Si la personne n'a pas son C4, l'orienter vers son employeur. Ne pas interpréter le motif de fin
  de contrat (partie C) : matière sensible (rf_motif_grave).
red_flags:
  - rf_motif_grave
related_forms:
  - C4
related_topics:
  - chomage_complet
```

```yaml
rule_id: chomage_complet_procedure_demande
theme: formulaires
effective_from: unknown
source_name: ONEM — Comment introduire une demande après une occupation
source_url: https://www.onem.be/citoyens/chomage-complet/comment-devez-vous-demander-les-allocations-/comment-devez-vous-introduire-une-demande-apres-une-occupation
base_legale: >
  AR du 25/11/1991, art. 17-26 (organismes de paiement : CAPAC et organismes agréés). Texte
  consolidé public : ejustice.just.fgov.be (Justel, numac 1991013192). Aussi dans RioLex. NB : la
  base légale fixe les catégories d'organismes ; la liste nominative exacte (dont CGSLB) reste
  a_verifier (voir TODO ci-dessous).
base_legale_url: https://www.ejustice.just.fgov.be/eli/arrete/1991/11/25/1991013192/justel
last_verified: 2026-06-30
confidence: official
status: active
summary: >
  Pour demander le chômage après une occupation, le travailleur se présente à l'organisme de
  paiement de son choix (CAPAC publique, ou syndicat : CSC, FGTB, SYNOVA), muni du C4 de
  l'employeur, et y complète le C1.
agent_instruction: >
  Orienter vers le choix d'un organisme de paiement + documents (C4, C1). La présence de la CGSLB
  dans cette liste précise n'était pas confirmée sur la page consultée → ne pas l'exclure mais ne
  pas l'affirmer pour cette démarche.
red_flags: []
related_forms:
  - C1
  - C4
related_topics:
  - chomage_complet
  - organismes_regionaux
# TODO_SOURCE_OFFICIELLE : confirmer la liste exacte des organismes de paiement (CGSLB incluse ?)
# pour la demande après occupation.
```

```yaml
rule_id: formulaire_c109_36_demande
theme: formulaires
effective_from: 2026-03-01
source_name: ONEM — C109/36-demande à partir du 01.03.2026
source_url: https://www.onem.be/formulaires-attestations/c10936-demande-a-partir-du-01.03.2026
last_verified: 2026-06-30
confidence: high
status: active
summary: >
  Le C109/36-DEMANDE sert à demander les allocations d'insertion. Il existe en version « jusqu'au
  28.02.2026 » et « à partir du 01.03.2026 » (adaptée à la nouvelle réglementation).
agent_instruction: >
  Choisir la version selon la date de demande (rf_formulaire_depend_date_ou_situation). Documents
  liés : C109/36-diplôme, C36.3.
red_flags:
  - rf_formulaire_depend_date_ou_situation
related_forms:
  - C109/36
related_topics:
  - allocations_insertion
```

```yaml
rule_id: formulaire_c109_seul
theme: formulaires
effective_from: unknown
source_name: ONEM (PDF non lisible lors de la vérification)
source_url: TODO_SOURCE_OFFICIELLE
last_verified: 2026-06-30
confidence: to_verify
status: to_verify
summary: >
  Usage exact du formulaire C109 (sans suffixe /36), distinct du C109/36, non confirmé.
agent_instruction: >
  Ne pas affirmer l'usage du C109 seul ; renvoyer à l'ONEM. a_verifier si une orientation en
  dépend.
red_flags:
  - rf_formulaire_depend_date_ou_situation
related_forms:
  - C109
related_topics:
  - allocations_insertion
# TODO_SOURCE_OFFICIELLE : fonction exacte du C109 seul vs C109/36 (PDF onem.be à lire).
```

```yaml
rule_id: formulaire_ec32
theme: formulaires
effective_from: 2025-01-01
source_name: ONEM — eC3.2 (employeurs)
source_url: https://www.onem.be/employeurs/chomage-temporaire/chomage-temporaire---la-carte-de-controle-electronique-ec3.2
last_verified: 2026-06-30
confidence: official
status: active
summary: >
  eC3.2 = carte de contrôle électronique du chômage temporaire (obligatoire depuis le 01/01/2025),
  remplie par le travailleur. Distincte de l'eC3 (chômage complet).
agent_instruction: >
  Pour le chômage temporaire uniquement ; détails dans ec32.md. Ne pas orienter un chômeur complet
  vers l'eC3.2.
red_flags: []
related_forms:
  - eC3.2
related_topics:
  - ec32
  - chomage_temporaire
```

---

## Red flags spécifiques
- **Bon formulaire dépend d'une date/situation** → `rf_formulaire_depend_date_ou_situation`.
- **Motif de fin de contrat** (partie C du C4) → `rf_motif_grave`.

## Ce qui reste « à vérifier »
- Usage du **C109 seul** (PDF non lisible).
- Liste exacte des **organismes de paiement** pour la demande après occupation (CGSLB ?).
- Libellé exact imprimé sur les PDF des C1/C4 (les usages proviennent des pages HTML officielles).

> **« Cet outil vous aide à vous orienter. Il ne remplace pas une décision de l'ONEM, de votre
> organisme de paiement ou d'un conseiller compétent. »**
