# Organismes régionaux de l'emploi

> **Thème :** `organismes_regionaux`. L'**inscription comme demandeur d'emploi** se fait auprès
> du service régional **selon le lieu de résidence**. C'est en général une **condition** pour
> percevoir des allocations (et obligatoire pour le stage d'insertion / les évaluations).

---

## Vue d'ensemble
| Région | Organisme | Site |
|--------|-----------|------|
| Bruxelles-Capitale | **Actiris** | <https://www.actiris.brussels/fr/citoyens/> |
| Wallonie | **Le Forem** | <https://www.leforem.be/> |
| Flandre | **VDAB** | <https://www.vdab.be/> |
| Communauté germanophone | **ADG** (*Arbeitsamt der DG*) | <https://adg.be/> |

## Rôle général
- **Inscription** comme demandeur d'emploi (ouvre/maintient des droits sociaux).
- **Accompagnement** : conseil, coaching, formation, offres d'emploi.
- **Contrôle régional** de la disponibilité et du comportement de recherche (compétence
  régionalisée ; modalités propres à chaque office — détail non documenté ici).
- Pour les allocations d'insertion : ce sont les services régionaux qui réalisent les
  **évaluations** du comportement de recherche d'emploi.

## Point d'attention « délai »
L'inscription doit en principe se faire **le jour de la demande d'allocations** ou **dans les
8 jours calendrier** qui suivent ; à défaut, les allocations ne sont dues qu'à partir du jour de
l'inscription effective.

---

## Règles

```yaml
rule_id: regional_inscription_demandeur_emploi
theme: organismes_regionaux
effective_from: unknown
source_name: ONEM — Comment introduire une demande après une occupation
source_url: https://www.onem.be/citoyens/chomage-complet/comment-devez-vous-demander-les-allocations-/comment-devez-vous-introduire-une-demande-apres-une-occupation
last_verified: 2026-06-30
confidence: official
status: active
summary: >
  Il faut s'inscrire comme demandeur d'emploi auprès du service régional compétent pour le
  domicile (VDAB, Actiris, Forem ou ADG), le jour de la demande d'allocations ou dans les 8 jours
  calendrier ; à défaut, les allocations ne sont dues qu'à partir de l'inscription effective.
agent_instruction: >
  Toujours rappeler l'inscription régionale et le délai. Déterminer l'organisme via la RÉGION DE
  RÉSIDENCE (à demander si inconnue : rf_* via requiredInfo).
red_flags: []
related_forms: []
related_topics:
  - chomage_complet
  - allocations_insertion
```

```yaml
rule_id: regional_actiris
theme: organismes_regionaux
effective_from: unknown
source_name: Actiris — Citoyens
source_url: https://www.actiris.brussels/fr/citoyens/
last_verified: 2026-06-30
confidence: official
status: active
summary: >
  Actiris est le service public de l'emploi de la Région de Bruxelles-Capitale (inscription,
  accompagnement, coaching, formation, aides à l'embauche).
agent_instruction: >
  Orienter vers Actiris les résidents bruxellois. La restriction « résidents bruxellois
  uniquement » n'était pas énoncée explicitement sur la page (formulation prudente).
red_flags: []
related_forms: []
related_topics:
  - organismes_regionaux
```

```yaml
rule_id: regional_forem
theme: organismes_regionaux
effective_from: unknown
source_name: Le Forem — site officiel
source_url: https://www.leforem.be/
last_verified: 2026-06-30
confidence: official
status: active
summary: >
  Le Forem est l'office wallon de l'emploi et de la formation, compétent pour les résidents de
  Wallonie (inscription qui « ouvre les droits sociaux », conseils, offres, formations, Maisons de
  l'emploi).
agent_instruction: >
  Orienter vers le Forem les résidents wallons (hors Communauté germanophone, qui relève de l'ADG).
red_flags: []
related_forms: []
related_topics:
  - organismes_regionaux
```

```yaml
rule_id: regional_vdab
theme: organismes_regionaux
effective_from: unknown
source_name: VDAB — site officiel
source_url: https://www.vdab.be/
last_verified: 2026-06-30
confidence: official
status: active
summary: >
  Le VDAB est le service flamand de l'emploi et de la formation (recherche d'emploi, formations,
  orientation, inscription — notamment pour démarrer le stage d'insertion ou demander
  allocations/AGR). Accompagne aussi des publics spécifiques (jeunes diplômés, 55+, etc.).
agent_instruction: >
  Orienter vers le VDAB les résidents de Flandre. Pour les outils, prévoir le néerlandais.
red_flags: []
related_forms: []
related_topics:
  - organismes_regionaux
```

```yaml
rule_id: regional_adg
theme: organismes_regionaux
effective_from: 2023-05-23
source_name: ADG — Décret 2023 relatif au placement axé sur les besoins (Communauté germanophone)
source_url: https://adg.be/
last_verified: 2026-06-30
confidence: medium
status: active
summary: >
  L'ADG (Arbeitsamt der Deutschsprachigen Gemeinschaft) est l'office de l'emploi de la Communauté
  germanophone : conseil, accompagnement et placement gratuits et adaptés. La liste exhaustive des
  services n'a pas pu être confirmée mot pour mot (page d'accueil ADG en erreur 403 lors de la
  vérification).
agent_instruction: >
  Orienter vers l'ADG les résidents de la Communauté germanophone (est de la Belgique). Prévoir
  l'allemand. a_verifier sur le détail des services.
red_flags: []
related_forms: []
related_topics:
  - organismes_regionaux
# TODO_SOURCE_OFFICIELLE : liste complète des services ADG + page d'accueil (fetch 403).
```

---

## Red flags spécifiques
- **Région de résidence inconnue** → impossible d'orienter vers le bon organisme : `requiredInfo`.
- **Frontalier / travail à l'étranger** → règles spécifiques : `rf_frontalier`, `rf_travail_etranger`.
- **Déménagement entre régions** → l'organisme compétent peut changer : `a_verifier`.

## Exemples d'orientation
- *« J'habite à Liège, où m'inscrire ? »* → Le Forem (Wallonie francophone) ; `recommande`.
- *« J'habite à Eupen »* → ADG (Communauté germanophone) ; `recommande` (services détaillés à
  vérifier).
- *« Je vis à Bruxelles »* → Actiris ; `recommande`.

## Ce qui reste « à vérifier »
- Détail des obligations de **contrôle de disponibilité** propres à chaque office.
- Liste complète des **services ADG** (page en erreur lors de la vérification).

> **« Cet outil vous aide à vous orienter. Il ne remplace pas une décision de l'ONEM, de votre
> organisme de paiement ou d'un conseiller compétent. »**
