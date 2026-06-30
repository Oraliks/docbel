# Base de connaissances — Chômage (Belgique)

> Ce dossier contient les **règles métier** du domaine chômage, sous une forme exploitable
> par les agents IA et les futurs outils Docbel. Il est piloté par
> [`../../agents/chomage/AGENT_CHOMAGE.md`](../../agents/chomage/AGENT_CHOMAGE.md).

## Rôle du dossier `knowledge/chomage/`

- Décrire **comment orienter** une personne (quel dossier, quel formulaire, quelle démarche).
- **Ne pas** contenir de barèmes chiffrés recopiés : les montants viennent du moteur
  [`lib/calculators/chomage.ts`](../../../lib/calculators/chomage.ts).
- Chaque règle est **sourcée**, **datée** et porte un **niveau de confiance**.
- Quand une information manque ou n'est pas confirmée, elle est marquée **`to_verify`** /
  `TODO_SOURCE_OFFICIELLE`, jamais inventée.

## Fichiers

| Fichier | Contenu |
|---------|---------|
| `reforme-2026.md` | Réforme entrée en vigueur le 01/03/2026 (durées, transitoire, fin de droit) |
| `chomage-complet.md` | Chômage complet après une occupation salariée |
| `chomage-temporaire.md` | Chômage temporaire (lien employeur maintenu) |
| `ec32.md` | Carte de contrôle électronique eC3.2 |
| `allocations-insertion.md` | Allocations d'insertion (après études) |
| `agr-temps-partiel.md` | Temps partiel + Allocation de Garantie de Revenus (AGR) |
| `situation-familiale-c1-t147.md` | Catégories familiales et formulaire C1 |
| `formulaires-onem.md` | Inventaire des formulaires (C1, C4, C109, C109/36, eC3.2…) |
| `organismes-regionaux.md` | Actiris, Forem, VDAB, ADG |
| `glossaire.md` | Définitions vulgarisées pour le grand public |

## Format d'une règle (obligatoire)

Chaque règle métier est un bloc YAML avec **tous** ces champs :

```yaml
rule_id: chomage_complet_limitation_2026   # identifiant STABLE, kebab/snake, jamais renommé
theme: chomage_complet                      # thème (= section du RULES_INDEX)
effective_from: 2026-03-01                  # date d'entrée en vigueur si connue, sinon TODO_DATE
source_name: ONEM                           # institution
source_url: TODO_SOURCE_OFFICIELLE          # URL officielle ou TODO_SOURCE_OFFICIELLE
last_verified: TODO_DATE                     # date de dernière vérification (ISO) ou TODO_DATE
confidence: official | high | medium | low | to_verify
status: active | transitional | deprecated | to_verify
summary: >
  Résumé court et neutre de la règle.
agent_instruction: >
  Comment l'agent applique cette règle dans un outil Docbel (orientation, pas décision).
red_flags:
  - Situation où la règle ne suffit pas (référencer un rf_* de RED_FLAGS.md si possible).
related_forms:
  - C1
  - C4
related_topics:
  - reforme_2026
  - fin_de_droit
```

## Comment ajouter une règle

1. Choisir le **bon fichier** (par thème). Si le thème n'existe pas, en discuter avant de
   créer un nouveau fichier.
2. Écrire le bloc YAML **complet** (tous les champs ci-dessus).
3. Choisir un `rule_id` **stable et descriptif** (`<theme>_<sujet>[_<annee>]`). Ne jamais
   réutiliser un id pour une autre règle.
4. Référencer la règle dans [`../../agents/chomage/RULES_INDEX.md`](../../agents/chomage/RULES_INDEX.md),
   section du thème.
5. Ajouter ou compléter un cas dans
   [`../../agents/chomage/TEST_CASES.md`](../../agents/chomage/TEST_CASES.md) si la règle
   change une orientation.

## Comment sourcer une règle

- Source **officielle** d'abord, dans l'ordre de priorité :
  1. ONEM / RVA
  2. Sécurité sociale belge
  3. CAPAC / organisme de paiement / syndicat
  4. Actiris / Forem / VDAB / ADG
  5. Textes légaux belges (Moniteur belge) si nécessaire
- Renseigner `source_name` **et** `source_url`. Tenir à jour le
  [`../../agents/chomage/SOURCE_REGISTER.md`](../../agents/chomage/SOURCE_REGISTER.md).
- Mettre `last_verified` à la date où l'on a réellement consulté la source.

## Comment marquer une règle incertaine

- `source_url: TODO_SOURCE_OFFICIELLE` quand l'URL exacte manque.
- `last_verified: TODO_DATE` tant que la vérification n'a pas eu lieu.
- `confidence: to_verify` et `status: to_verify` tant que ce n'est pas confirmé.
- Une règle `to_verify` **ne peut pas** fonder une conclusion ferme : elle pousse le
  résultat de l'outil vers `a_verifier`.

## Comment relier une règle au RULES_INDEX

- Toute règle utilisée dans un outil/wizard **doit** apparaître dans `RULES_INDEX.md`.
- L'index liste : `rule_id`, fichier source, statut, résumé. Il sert de table d'aiguillage
  pour savoir quel fichier `knowledge/` ouvrir.

## Comment relier une règle aux tests

- Un cas de `TEST_CASES.md` cite les `rule_id` attendues. Si une règle change le résultat
  d'un cas, mettre le cas à jour en même temps que la règle.

## Comment éviter les règles obsolètes

- Vérifier `last_verified` : au-delà de ~6 mois, re-sourcer (prompt 4 de `PROMPTS.md`).
- Une règle remplacée passe en `status: deprecated` (on la garde pour l'historique) et une
  **nouvelle** règle (nouvel `rule_id`) prend le relais.
- Toujours distinguer **avant / après 01/03/2026** : ne jamais appliquer une règle d'avant
  la réforme à une situation postérieure (et inversement).
