# Spec — Sous-agent `verif-reglementation` (v1)

> **Statut :** design validé le 2026-07-20, prêt pour plan d'implémentation.
> **Objectif de session :** doter le projet d'un vérificateur réglementaire spécialisé,
> en **lecture seule** et **jamais bloquant**, invocable à la main ou en réflexe avant commit.

---

## 1. Contexte & problème

DocBel possède déjà une charte d'agent chômage complète et sourcée
([`docs/agents/chomage/`](../../agents/chomage/AGENT_CHOMAGE.md) + base de connaissances
[`docs/knowledge/chomage/`](../../knowledge/chomage/README.md)) : règle anti-invention,
raisonnement en 8 étapes, `RULES_INDEX.md`, `QUALITY_CHECKLIST.md`, `RED_FLAGS.md`,
et même le prompt d'audit `PROMPTS.md §6`.

**Le manque n'est pas la connaissance, c'est le câblage.** Cette charte ne s'applique
que si un humain pense à coller le prompt à la main. Rien ne garantit qu'un lot touchant
la réglementation soit vérifié. On veut rendre ce contrôle **systématique et reproductible**.

## 2. Décision

Option retenue : **spécialiser un sous-agent vérificateur** (plutôt que charger la charte
dans le contexte de l'agent principal à chaque session, ou imposer un hook par commit).

Raisons :
- Le sous-agent charge la charte **fraîche à chaque revue** → pas de coût de contexte sur les
  sessions sans rapport (CSS, i18n…).
- Un **regard indépendant** attrape plus qu'une auto-relecture par l'agent qui vient d'écrire
  la logique (mêmes biais, même contexte).
- Conforme à la règle projet **« informatif jamais bloquant »** : le vérificateur produit un
  rapport, il ne bloque ni ne modifie rien.

### Périmètre v1 (verrouillé)
- **Couvre :** logique + données structurées — `lib/calculators/**`, arbres de décision
  (Decision Builder / runtime d'orientation), `lib/pdf-forms/seed/**`, `docs/knowledge/chomage/**`.
- **Sources citées :** `source_name` / `source_url` déjà présents dans chaque `rule_id`
  de la base. (Brancher RioLex pour l'article AR/AM exact = **v2**.)
- **Domaine :** chômage uniquement (la base ne couvre que ça). CPAS/emploi → « non couvert ».

### Hors périmètre v1 (noté pour plus tard)
- v2 : citations RioLex de l'article AR/AM exact via [`lib/reglementation/`](../../../lib/reglementation/get-article.ts).
- v2 : audit des contenus rédactionnels (news/actualités, pages page-builder en prose libre).
- v2 : hook de rappel automatique par chemin modifié (zéro token, non bloquant), si la
  discipline manuelle ne suffit pas.
- Chantier séparé : bases de connaissances CPAS / emploi (Oraliks = expert du domaine).

## 3. Architecture — 3 fichiers créés + 1 édition

### 3.1 Le sous-agent — `.claude/agents/verif-reglementation.md`

Fichier de définition d'agent Claude Code (frontmatter + prompt système).

**Frontmatter :**
- `name: verif-reglementation`
- `description:` phrase qui explique quand l'utiliser (audit réglementaire d'un lot chômage,
  lecture seule) — sert au routage automatique.
- `tools: Read, Grep, Glob` — **volontairement restreint** : pas d'`Edit`/`Write`/`Bash`, donc
  la lecture seule est structurelle (impossible d'éditer ou de commiter), pas une simple consigne.
- `model:` hérite du modèle de session par défaut (audit de logique légale = tâche de
  raisonnement ; laisser l'appelant surclasser si besoin).

**Prompt système (corps du .md)** — dérivé et étendu de `PROMPTS.md §6`. Il impose :
1. **Lire d'abord** `docs/agents/chomage/AGENT_CHOMAGE.md`, `RULES_INDEX.md`,
   `QUALITY_CHECKLIST.md`, `RED_FLAGS.md`. Puis lire **uniquement** les fichiers
   `docs/knowledge/chomage/` nécessaires à la cible auditée.
2. **Auditer uniquement la logique réglementaire** de la cible — pas le style, pas l'archi,
   pas la perf.
3. Points de contrôle (v1) :
   - chaque `rule_id` cité **existe** dans `RULES_INDEX.md` et est **sourcé** ;
   - distinction **avant / après le 01/03/2026** respectée là où la réforme change l'issue ;
   - tout **red flag** (`RED_FLAGS.md`) force bien un `a_verifier` ;
   - **`legalWarning`** (phrase de prudence) présent partout, même en `recommande` ;
   - **aucun barème recopié** : les montants viennent de `lib/calculators/chomage.ts`, jamais
     dupliqués dans la doc/le code ;
   - **aucune phrase interdite** (cf. `AGENT_CHOMAGE.md §8`) ;
   - **pas de mélange** chômage complet / temporaire / AGR / allocations d'insertion dans un
     même verdict sans séparation explicite.
4. **Anti-invention appliquée au vérificateur lui-même** : si la base ne documente pas un point,
   il répond **« non couvert → à valider par Oraliks »**. Il n'invente jamais un verdict ni une
   règle pour « boucher un trou ».
5. **Ne modifie jamais de fichier, ne bloque jamais.** Sortie = un rapport, point final.

### 3.2 La commande — `.claude/commands/verif-reglementation.md`

Slash command `/verif-reglementation [cible]`.
- Corps = prompt qui **dispatche le sous-agent** `verif-reglementation` sur la cible.
- **Sans argument** : cible = le **diff git courant** (modifs non commitées + par rapport à
  `main`). L'appelant fournit la liste des fichiers changés au sous-agent.
- **Avec un argument** (`$ARGUMENTS`) : cible = ce fichier ou dossier.
- Le résultat rendu à l'utilisateur = le rapport du sous-agent (relayé, pas ré-audité).

### 3.3 Le déclencheur — édition de `AGENTS.md` (~5 lignes)

Ajouter une courte sous-section (sous « Règles critiques » ou « Façon de travailler ») :

> **Vérification réglementaire (chômage)** — Tout lot touchant `lib/calculators/**`, un arbre
> de décision / runtime d'orientation, `lib/pdf-forms/seed/**`, `docs/knowledge/chomage/**`,
> ou un contenu affirmant des conditions / montants / durées : lancer `/verif-reglementation`
> (ou dispatcher le sous-agent `verif-reglementation`) **avant commit**. Rapport informatif,
> **jamais bloquant**.

C'est cette ligne qui transforme le contrôle en réflexe : l'agent principal ne porte que le
*déclencheur*, le sous-agent porte la *connaissance*.

## 4. Contrat de sortie (rapport)

Format fixe, scannable. Par constat :
- `✅ CONFORME` — rien à signaler sur ce point.
- `⚠️ ÉCART` — `fichier:ligne` + `rule_id` concerné + **pourquoi** + **correction suggérée**.
- `❓ NON COUVERT` — la base n'a pas de règle applicable → **à valider par Oraliks**
  (le vérificateur n'invente pas de verdict).

Plus, en tête ou pied de rapport :
- une **ligne de synthèse** (nb conforme / écart / non couvert) ;
- un **rappel fraîcheur** : les `rule_id` réellement utilisés par la cible dont le
  `last_verified` est ancien ou manquant.

## 5. Validation

- **Aucun impact** build / test / lint : uniquement des fichiers de config d'agent (`.claude/`)
  et de la doc (`AGENTS.md`, cette spec). Zéro code applicatif touché.
- Pas de nouvelle dépendance.
- Aucun écran à vérifier (pas d'UI).
- Vérif fonctionnelle : lancer `/verif-reglementation lib/calculators/chomage.ts` et confirmer
  que le sous-agent lit bien la charte et rend un rapport au format ci-dessus.

## 6. Risques & mitigations

| Risque | Mitigation |
|--------|-----------|
| Faux positifs / bruit | Périmètre v1 = logique + données structurées (pas de prose libre). Le vérificateur signale, il ne bloque pas. |
| Le vérificateur « invente » un verdict | Anti-invention explicite dans son prompt : hors base → « non couvert ». Outils lecture seule. |
| Charte qui dérive de la base réelle | Le sous-agent relit la charte + `RULES_INDEX.md` à chaque run (jamais figée dans son prompt). |
| Fraîcheur vs ONEM en direct | v1 vérifie contre la base, pas le web. Le rapport remonte les `last_verified` anciens ; veille = process Oraliks. |
| Workdir partagé multi-agents | Création de fichiers isolés + `git add` de chemins explicites uniquement. |

## 7. Fichiers touchés (lot unique, ≤ 5)

1. `.claude/agents/verif-reglementation.md` (créé)
2. `.claude/commands/verif-reglementation.md` (créé)
3. `AGENTS.md` (édité, +~5 lignes)
4. `docs/superpowers/specs/2026-07-20-verif-reglementation-design.md` (cette spec)
