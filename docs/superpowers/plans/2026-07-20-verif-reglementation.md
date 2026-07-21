# Sous-agent `verif-reglementation` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Doter DocBel d'un sous-agent vérificateur réglementaire chômage, en lecture seule et jamais bloquant, invocable à la main (`/verif-reglementation`) ou en réflexe avant commit.

**Architecture:** Trois artefacts de configuration Claude Code, indépendants entre eux : (1) une définition de sous-agent qui porte la charte chômage, (2) une commande slash qui le dispatche sur un fichier/dossier ou le diff courant, (3) une note de déclenchement dans `AGENTS.md`. Le sous-agent charge la charte fraîche à chaque run et rend un rapport `✅/⚠️/❓` ; il ne modifie ni ne bloque rien.

**Tech Stack:** Fichiers Markdown + frontmatter YAML dans `.claude/agents/` et `.claude/commands/`. Aucun code applicatif, aucune dépendance, aucun impact build/test/lint.

## Global Constraints

- **Workdir partagé multi-agents** : `git add` de chemins **explicites** uniquement — jamais `-A`, jamais large, jamais `--force` sur `main`. **Ne toucher aucun fichier d'une autre session.**
- **Commits séquentiels par l'orchestrateur** : les sous-agents d'implémentation **écrivent seulement** (aucune opération git). Tous les `git add` / `git commit` sont exécutés par l'orchestrateur **un lot après l'autre** (jamais en parallèle → évite le lock d'index git).
- **Ne pas commiter** la spec (`docs/superpowers/specs/2026-07-20-verif-reglementation-design.md`) ni ce plan — demande explicite d'Oraliks.
- **Sous-agent en lecture seule** : `tools: Read, Grep, Glob` (pas d'`Edit`/`Write`/`Bash`).
- **« Informatif jamais bloquant »** : le vérificateur produit un rapport, il ne bloque ni ne modifie rien.
- **Périmètre v1** : chômage uniquement ; logique + données structurées. RioLex (article AR/AM exact) et contenus rédactionnels = v2.
- **Charte de référence** (le sous-agent la relit à chaque run, ne pas la recopier) : `docs/agents/chomage/AGENT_CHOMAGE.md`, `RULES_INDEX.md`, `QUALITY_CHECKLIST.md`, `RED_FLAGS.md`.

---

## File Structure

| Fichier | Responsabilité |
|---------|----------------|
| `.claude/agents/verif-reglementation.md` (créé) | Définition du sous-agent : frontmatter (nom, description, outils lecture seule) + prompt système = la charte d'audit. |
| `.claude/commands/verif-reglementation.md` (créé) | Commande `/verif-reglementation [cible]` qui dispatche le sous-agent sur un chemin ou le diff courant. |
| `AGENTS.md` (édité, +~7 lignes) | Note de déclenchement : quels chemins imposent une vérif avant commit. |

Les tâches 1, 2, 3 sont **indépendantes** (fichiers distincts ; leur seule interface commune est la chaîne `verif-reglementation`). Elles peuvent être dispatchées **en parallèle**. La tâche 4 (vérification bout-en-bout) dépend des trois et s'exécute après, dans la session orchestratrice.

---

## Task 1: Définition du sous-agent (Lot A)

**Files:**
- Create: `.claude/agents/verif-reglementation.md`

**Interfaces:**
- Produces: un type de sous-agent nommé `verif-reglementation`, dispatchable via l'Agent tool (`subagent_type: "verif-reglementation"`). Consommé par la Task 2 et la Task 4.

- [ ] **Step 1: Écrire le fichier de définition (contenu intégral)**

Créer `.claude/agents/verif-reglementation.md` avec **exactement** ce contenu :

````markdown
---
name: verif-reglementation
description: >-
  Auditeur réglementaire chômage (belge), lecture seule et jamais bloquant.
  À utiliser AVANT commit sur tout lot touchant la logique ou les données
  réglementaires : lib/calculators, arbres de décision / runtime d'orientation,
  lib/pdf-forms/seed, docs/knowledge/chomage, ou tout contenu affirmant des
  conditions / montants / durées. Rend un rapport ✅/⚠️/❓ ; ne modifie ni ne bloque rien.
tools: Read, Grep, Glob
model: inherit
---

Tu es le **vérificateur réglementaire chômage** de DocBel. Ton unique livrable est un
**rapport d'audit**. Tu ne modifies aucun fichier, tu ne commites rien, tu ne bloques rien
(« informatif jamais bloquant »). Tu n'as accès qu'à Read / Grep / Glob.

## 0. Ordre de lecture obligatoire (à chaque run)

Avant toute analyse, lis dans cet ordre :
1. `docs/agents/chomage/AGENT_CHOMAGE.md`
2. `docs/agents/chomage/RULES_INDEX.md`
3. `docs/agents/chomage/QUALITY_CHECKLIST.md`
4. `docs/agents/chomage/RED_FLAGS.md`

Puis lis **uniquement** les fichiers `docs/knowledge/chomage/` nécessaires à la cible
auditée (ne lis pas toute la base). Utilise Grep sur `RULES_INDEX.md` pour vérifier
l'existence d'un `rule_id`.

## 1. Ce que tu audites

**Uniquement la logique réglementaire** de la cible fournie (fichiers ou diff) :
la conformité métier vis-à-vis de la base chômage. **Pas** le style, **pas** l'archi,
**pas** la perf, **pas** l'i18n — d'autres outils s'en chargent.

Cible typique (périmètre v1) : `lib/calculators/**`, arbres de décision / runtime
d'orientation, `lib/pdf-forms/seed/**`, `docs/knowledge/chomage/**`.

## 2. Points de contrôle (v1)

Pour chaque élément de logique de la cible, vérifie :

1. **`rule_id` existants + sourcés** — chaque `rule_id` cité existe dans `RULES_INDEX.md`
   et possède une source (`source_url` réel, ou explicitement `TODO_SOURCE_OFFICIELLE`
   + `confidence: to_verify`). Un `rule_id` inventé = écart grave.
2. **Avant / après le 01/03/2026** — là où la réforme change l'issue, la distinction est
   explicite. Une règle datée appliquée sans tenir compte de l'`effective_from` = écart.
3. **Red flags → `a_verifier`** — tout cas listé dans `RED_FLAGS.md` (fin de droit, sanction,
   exclusion, radiation, situation hybride, frontalier, catégorie familiale incertaine,
   contenu de lettre ONEM inconnu…) doit forcer un `a_verifier`, jamais une conclusion ferme.
4. **`legalWarning` présent partout** — la phrase de prudence obligatoire figure sur chaque
   résultat, même `recommande`.
5. **Aucun barème recopié** — les montants proviennent de `lib/calculators/chomage.ts`.
   Un montant / durée / seuil chiffré recopié en dur dans la doc ou le code = écart.
6. **Aucune phrase interdite** — cf. `AGENT_CHOMAGE.md §8` (« vous avez droit à »,
   « l'ONEM acceptera », « vous recevrez », « votre allocation sera de X € », etc.).
7. **Pas de mélange** — chômage complet / temporaire / AGR / allocations d'insertion ne
   sont pas fondus dans un même verdict sans séparation explicite.

## 3. Règle anti-invention (s'applique À TOI)

Tu es soumis à la même règle d'or que l'agent chômage : **tu n'inventes rien**.
- Si la base ne documente pas un point, tu ne fabriques **pas** de verdict pour « boucher
  le trou ». Tu le classes `❓ NON COUVERT`.
- Le domaine couvert est le **chômage uniquement**. CPAS / emploi / autre → `❓ NON COUVERT`.
- Tu ne « corriges » jamais un chiffre sans source officielle dans la base à l'appui.

## 4. Format du rapport (fixe)

Rends exactement cette structure :

### Synthèse
`X conforme · Y écart · Z non couvert` — verdict global en une ligne.

### Constats
Pour chaque point, une entrée :
- `✅ CONFORME — <ce qui est vérifié>` (bref, seulement si utile).
- `⚠️ ÉCART — <fichier>:<ligne>` · règle : `<rule_id ou "aucune">` · **Problème :** <pourquoi>
  · **Correction suggérée :** <quoi faire>.
- `❓ NON COUVERT — <fichier>:<ligne>` · <ce que la cible affirme> · **À valider par Oraliks**
  (aucune règle applicable dans la base).

### Fraîcheur
Liste les `rule_id` réellement utilisés par la cible dont le `last_verified` est ancien
(> 6 mois avant aujourd'hui) ou manquant. Si aucun : « RAS ».

## 5. Rappels

- Tu ne modifies **aucun** fichier et tu ne proposes pas de patch appliqué : tu **décris**
  la correction, l'humain décide.
- Un rapport avec des `⚠️` n'est **pas** un échec de build : c'est de l'information.
- En cas de doute sur un constat, préfère `❓ NON COUVERT` à une affirmation.
````

- [ ] **Step 2: Vérifier le frontmatter et l'encodage**

Relire le fichier créé et confirmer :
- le frontmatter YAML est valide (délimiteurs `---`, `tools:` en liste comma-séparée) ;
- `tools:` ne contient **que** `Read, Grep, Glob` (lecture seule structurelle) ;
- les émojis `✅ ⚠️ ❓` sont bien présents (UTF-8) ;
- aucune référence à un fichier de charte inexistant (les 4 chemins `docs/agents/chomage/*` existent).

Expected : les 4 chemins de charte existent, `tools` = lecture seule, YAML parsable.

- [ ] **Step 3: Commit du Lot A (orchestrateur, séquentiel)**

À exécuter par l'orchestrateur **après** retour du sous-agent, jamais en parallèle avec un autre commit :

```bash
git add .claude/agents/verif-reglementation.md
git commit -m "feat(agent): sous-agent verif-reglementation (audit chomage lecture seule)"
```

---

## Task 2: Commande slash (Lot B)

**Files:**
- Create: `.claude/commands/verif-reglementation.md`

**Interfaces:**
- Consumes: le type de sous-agent `verif-reglementation` (Task 1) via `subagent_type: "verif-reglementation"`.
- Produces: la commande `/verif-reglementation [cible]`.

- [ ] **Step 1: Écrire le fichier de commande (contenu intégral)**

Créer `.claude/commands/verif-reglementation.md` avec **exactement** ce contenu :

````markdown
---
description: Audite la logique réglementaire chômage d'un lot (lecture seule, non bloquant)
argument-hint: "[fichier|dossier] — vide = diff git courant"
---

Lance une vérification réglementaire chômage via le sous-agent `verif-reglementation`.

**Cible :**
- Si `$ARGUMENTS` est fourni : audite ce fichier / dossier.
- Sinon : audite le **diff git courant**. Calcule d'abord la liste des fichiers modifiés
  (`git status --short` + `git diff --name-only`, et vs `main` si pertinent), puis transmets
  cette liste et les extraits pertinents au sous-agent.

**Dispatch :**
Dispatche le sous-agent `verif-reglementation` (Agent tool, `subagent_type: "verif-reglementation"`)
en lui passant la cible (chemins + extraits/diff) et la consigne de suivre sa charte : lecture
des fichiers `docs/agents/chomage/`, points de contrôle v1, format de rapport `✅/⚠️/❓`.

**Restitution :**
Relaie le rapport du sous-agent **tel quel**. **Ne corrige rien automatiquement.** Le rapport
est informatif, jamais bloquant. Si l'utilisateur veut appliquer une correction suggérée,
c'est une action séparée qu'il demande explicitement.
````

- [ ] **Step 2: Vérifier la commande**

Relire le fichier et confirmer :
- frontmatter valide (`description`, `argument-hint`) ;
- le corps référence bien `subagent_type: "verif-reglementation"` (cohérent avec le `name` de la Task 1) ;
- `$ARGUMENTS` est présent pour le cas « cible fournie » ;
- la restitution est explicitement non bloquante et sans correction auto.

Expected : `subagent_type` = `verif-reglementation` (identique au `name` du Lot A), `$ARGUMENTS` présent.

- [ ] **Step 3: Commit du Lot B (orchestrateur, séquentiel)**

```bash
git add .claude/commands/verif-reglementation.md
git commit -m "feat(command): /verif-reglementation dispatche l'audit chomage"
```

---

## Task 3: Note de déclenchement dans AGENTS.md (Lot C)

**Files:**
- Modify: `AGENTS.md` (insertion en fin de section « Règles critiques », juste avant `## Modèle utilisateur (résumé)`)

**Interfaces:**
- Consumes: les noms `/verif-reglementation` et `verif-reglementation` (Tasks 1 & 2).
- Produces: le déclencheur documentaire qui rend la vérif réflexe.

- [ ] **Step 1: Insérer la note (Edit exact)**

Dans `AGENTS.md`, remplacer :

```
  `app/document/[...path]/page.tsx` redirige 308 slug → publicPath quand présent.

## Modèle utilisateur (résumé)
```

par :

```
  `app/document/[...path]/page.tsx` redirige 308 slug → publicPath quand présent.

**Vérification réglementaire (chômage)**
- Tout lot touchant `lib/calculators/**`, un arbre de décision / runtime d'orientation,
  `lib/pdf-forms/seed/**`, `docs/knowledge/chomage/**`, ou un contenu affirmant des
  conditions / montants / durées : lancer **`/verif-reglementation`** (ou dispatcher le
  sous-agent `verif-reglementation`) **avant commit**. Rapport informatif, **jamais bloquant**.
  Charte : [`docs/agents/chomage/AGENT_CHOMAGE.md`](docs/agents/chomage/AGENT_CHOMAGE.md).

## Modèle utilisateur (résumé)
```

- [ ] **Step 2: Vérifier l'insertion**

Confirmer que le bloc est inséré au bon endroit (fin de « Règles critiques », avant « Modèle utilisateur »), que le lien `docs/agents/chomage/AGENT_CHOMAGE.md` pointe vers un fichier existant, et qu'aucun autre contenu d'`AGENTS.md` n'a bougé.

Expected : diff = uniquement +7 lignes, section « Modèle utilisateur » intacte juste après.

- [ ] **Step 3: Commit du Lot C (orchestrateur, séquentiel)**

```bash
git add AGENTS.md
git commit -m "docs(agents): declencheur verif-reglementation avant commit (chomage)"
```

---

## Task 4: Vérification bout-en-bout (orchestrateur, après Lots A/B/C)

**Files:** aucun (vérification fonctionnelle).

**Interfaces:**
- Consumes: le sous-agent (Task 1), la commande (Task 2).

- [ ] **Step 1: Rendre le nouveau type de sous-agent disponible**

Un `.claude/agents/*.md` créé pendant la session n'est pas forcément enregistré dans le registre des `subagent_type` de la session courante. Deux voies :
- **(a)** recharger la session, puis utiliser `subagent_type: "verif-reglementation"` ;
- **(b)** sans recharger : dispatcher un agent `general-purpose` en **inlinant** le prompt système du Lot A + la cible, ce qui teste le contenu de la charte indépendamment de l'enregistrement.

Choisir (b) pour la vérification immédiate (aucun reload requis).

- [ ] **Step 2: Lancer un audit sur une cible réelle**

Cible de test : `lib/calculators/chomage.ts` (fichier de logique chômage réel).
Dispatcher le vérificateur (voie a ou b) sur ce fichier.

Expected : le rapport suit **exactement** le format `Synthèse / Constats (✅ ⚠️ ❓) / Fraîcheur`, cite des `rule_id` réels de `RULES_INDEX.md` (pas inventés), et ne propose **aucune** modification de fichier.

- [ ] **Step 3: Vérifier le comportement anti-invention**

Dispatcher le vérificateur sur une cible **hors domaine** (ex. un fichier CPAS ou emploi s'il existe, sinon décrire une règle CPAS fictive dans le prompt).

Expected : le rapport classe le point en `❓ NON COUVERT — À valider par Oraliks`, sans fabriquer de verdict.

- [ ] **Step 4: Confirmer l'absence d'effet de bord**

```bash
git status --short
```

Expected : seuls les 3 fichiers du lot apparaissent comme déjà commités (working tree propre côté verif-reglementation) ; aucun fichier d'une autre session modifié ; la spec et le plan **non commités**.

---

## Self-Review (rempli par l'auteur du plan)

**1. Spec coverage :**
- Sous-agent lecture seule + charte → Task 1 ✅
- Commande d'invocation → Task 2 ✅
- Déclencheur systématique dans AGENTS.md → Task 3 ✅
- Contrat de rapport (✅/⚠️/❓ + synthèse + fraîcheur) → Task 1 §4 ✅
- Points de contrôle v1 (rule_id sourcés, 01/03/2026, red flags, legalWarning, barèmes, phrases interdites, non-mélange) → Task 1 §2 ✅
- Anti-invention appliquée au vérificateur → Task 1 §3 + Task 4 Step 3 ✅
- Périmètre chômage / v2 noté → Global Constraints ✅
- Commits par lot, chemins explicites, workdir partagé → Global Constraints + Steps 3 de chaque tâche ✅

**2. Placeholder scan :** aucun « TBD/TODO » applicatif (le `TODO_SOURCE_OFFICIELLE` cité est un jeton réel de la base, pas un placeholder de plan). Contenus des 3 fichiers fournis intégralement.

**3. Type consistency :** le `name: verif-reglementation` (Task 1) = le `subagent_type: "verif-reglementation"` (Task 2) = le nom cité dans AGENTS.md (Task 3) = la cible dispatchée (Task 4). Cohérent.
