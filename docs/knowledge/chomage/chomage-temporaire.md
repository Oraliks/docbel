# Chômage temporaire

> **Thème :** `chomage_temporaire`. Le **contrat de travail subsiste** : différence
> fondamentale avec le chômage complet. Carte de contrôle dédiée : voir [`ec32.md`](ec32.md).

---

## Définition vulgarisée
Le **chômage temporaire** est une suspension **provisoire** de l'exécution du contrat : le
travailleur **reste lié à son employeur** et reprendra son poste. C'est l'employeur qui place le
travailleur en chômage temporaire pour une cause précise.

## Différence avec le chômage complet
| | Chômage temporaire | Chômage complet |
|---|---|---|
| Contrat de travail | **Maintenu** (suspendu) | **Rompu** |
| Initiative | L'employeur | Suite à une fin d'occupation |
| Carte de contrôle | **eC3.2** | eC3 |
| Retour à l'emploi | Chez le même employeur | Recherche d'un nouvel emploi |

## Documents probables
- Carte de contrôle électronique **eC3.2** (voir [`ec32.md`](ec32.md)).
- Documents transmis par l'employeur à l'ONEM (déclarations DRS selon la cause).
- Feuilles info ONEM : **T2** (chômage temporaire), **T74** (eC3.2 travailleur).

## Questions à poser
- Quelle **cause** de chômage temporaire (économique, intempéries, force majeure, accident
  technique, fermeture collective, grève) ?
- **Ouvrier ou employé** (certaines causes ne concernent que les ouvriers) ?
- Avez-vous bien rempli votre **eC3.2** (avant de commencer un éventuel travail) ?
- Travaillez-vous **ailleurs** certains jours (à déclarer) ?

---

## Règles

```yaml
rule_id: chomage_temporaire_definition
theme: chomage_temporaire
effective_from: unknown
source_name: ONEM — Chômage temporaire
source_url: https://www.onem.be/page/chomage-temporaire
last_verified: 2026-06-30
confidence: official
status: active
summary: >
  Forme de chômage où, contrairement au chômage complet, le travailleur reste lié par un contrat
  de travail dont l'exécution est temporairement suspendue.
agent_instruction: >
  Toujours distinguer du chômage complet. Si la personne décrit une rupture de contrat, ce n'est
  PAS du chômage temporaire (réorienter vers chomage-complet.md).
red_flags: []
related_forms:
  - eC3.2
related_topics:
  - ec32
```

```yaml
rule_id: chomage_temporaire_formes
theme: chomage_temporaire
effective_from: unknown
source_name: ONEM — Formes de chômage temporaire
source_url: https://www.onem.be/employeurs/chomage-temporaire/plus-d-infos-sur-le-chomage-temporaire
last_verified: 2026-06-30
confidence: official
status: active
summary: >
  Six formes reconnues : (1) manque de travail pour causes économiques (ouvriers et employés) ;
  (2) force majeure (ouvriers et employés) ; (3) accident technique (ouvriers) ; (4) intempéries
  (ouvriers) ; (5) fermeture collective (vacances annuelles / repos compensatoire) ; (6) grève /
  lock-out.
agent_instruction: >
  Aider la personne à identifier la cause. Préciser qu'accident technique et intempéries ne
  concernent que les ouvriers. Ne pas trancher l'éligibilité : orienter.
red_flags: []
related_forms:
  - eC3.2
related_topics:
  - chomage_temporaire
```

```yaml
rule_id: chomage_temporaire_causes_economiques
theme: chomage_temporaire
effective_from: unknown
source_name: ONEM — Formes de chômage temporaire
source_url: https://www.onem.be/employeurs/chomage-temporaire/plus-d-infos-sur-le-chomage-temporaire
last_verified: 2026-06-30
confidence: official
status: active
summary: >
  Le chômage temporaire pour causes économiques concerne ouvriers ET employés. Pour les employés,
  un crédit annuel s'applique : 16 semaines de suspension totale ou 26 semaines de travail à temps
  réduit (avec au moins deux jours d'occupation par semaine).
agent_instruction: >
  Information de cadrage ; ne pas calculer de droits. Renvoyer à l'employeur/ONEM pour les
  modalités.
red_flags: []
related_forms: []
related_topics:
  - chomage_temporaire
```

```yaml
rule_id: chomage_temporaire_force_majeure
theme: chomage_temporaire
effective_from: unknown
source_name: ONEM — Formes de chômage temporaire
source_url: https://www.onem.be/employeurs/chomage-temporaire/plus-d-infos-sur-le-chomage-temporaire
last_verified: 2026-06-30
confidence: official
status: active
summary: >
  Force majeure = événement soudain, imprévisible, indépendant de la volonté de l'employeur et
  des travailleurs, rendant l'exécution du contrat momentanément et totalement impossible
  (ouvriers et employés). Exemples : incendie, panne électrique externe, travaux de voirie.
agent_instruction: >
  Cadrage uniquement. La qualification de « force majeure » relève de l'employeur et de l'ONEM.
red_flags: []
related_forms: []
related_topics:
  - chomage_temporaire
```

```yaml
rule_id: chomage_temporaire_accident_technique
theme: chomage_temporaire
effective_from: unknown
source_name: ONEM — Chômage temporaire - accident technique
source_url: https://www.onem.be/employeurs/chomage-temporaire/chomage-temporaire---accident-technique
last_verified: 2026-06-30
confidence: official
status: active
summary: >
  Accident technique : ouvriers uniquement. Le chômage temporaire débute à partir du 8e jour
  suivant l'accident ; pendant les 7 premiers jours calendrier, l'employeur poursuit le paiement
  de la rémunération. Notification à l'ONEM au plus tard le 1er jour ouvrable suivant l'accident.
agent_instruction: >
  Information de cadrage. NE PAS affirmer de durée maximale (voir TODO). Orienter vers
  l'employeur/ONEM.
red_flags: []
related_forms: []
related_topics:
  - chomage_temporaire
# TODO_SOURCE_OFFICIELLE : une éventuelle durée maximale (souvent citée « 3 mois ») N'A PAS été
# confirmée sur la page ONEM — ne pas l'affirmer.
```

```yaml
rule_id: chomage_temporaire_intemperies
theme: chomage_temporaire
effective_from: unknown
source_name: ONEM — Formes de chômage temporaire
source_url: https://www.onem.be/employeurs/chomage-temporaire/plus-d-infos-sur-le-chomage-temporaire
last_verified: 2026-06-30
confidence: official
status: active
summary: >
  Intempéries : ouvriers uniquement, avec un lien direct entre les intempéries et les travaux à
  exécuter (ex. gel empêchant la maçonnerie). Régime particulier dans la construction.
agent_instruction: >
  Cadrage. Pour la construction, rappeler que la carte de contrôle doit toujours être remplie
  (cf. ec32.md).
red_flags: []
related_forms:
  - eC3.2
related_topics:
  - chomage_temporaire
  - ec32
```

---

## Red flags spécifiques
- Personne **toujours sous contrat** mais croit être en chômage complet → clarifier (souvent
  c'est du temporaire) ; sinon `rf_situation_hybride`.
- **Travail ailleurs** pendant des jours de chômage temporaire → obligation de déclaration
  (cf. eC3.2) ; `rf_activite_accessoire` si activité accessoire.
- **Construction** : carte de contrôle toujours obligatoire.

## Exemples d'orientation
- *« Mon patron m'a mis au chômage économique »* → chômage temporaire (causes économiques) ;
  orienter vers la bonne carte de contrôle (eC3.2) et l'organisme de paiement ; `recommande`.
- *« Je suis en chômage technique, dois-je faire quelque chose ? »* → expliquer l'eC3.2
  (remplir avant de travailler ailleurs) ; `pertinent`/`recommande`.

> **« Cet outil vous aide à vous orienter. Il ne remplace pas une décision de l'ONEM, de votre
> organisme de paiement ou d'un conseiller compétent. »**
