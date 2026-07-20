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
