# Refonte guichet `/mon-dossier` — Design (spec)

**Date :** 2026-07-20 · **Statut :** validé (design + maquette) — prêt pour writing-plans.

## Contexte
Suite à la refonte « Mes démarches » (mergée + poussée `origin/main`), `/mon-dossier` (le guichet : assistant + catalogue) et `/mes-demarches` (l'espace transversal des démarches en cours) se **recouvrent** : `/mon-dossier` affiche un bloc « Dossier en cours » qui double `/mes-demarches`. Plus des redondances internes au guichet (triple en-tête empilé ; deux barres de recherche au placeholder identique « Rechercher un dossier » qui cherchent en fait des choses différentes — situations vs dossiers — + une 3ᵉ, le secours IA).

## Décisions produit actées (Oraliks, 2026-07-20)
1. **Deux rôles nets** : `/mon-dossier` = guichet PUR (démarrer / trouver le bon dossier) ; `/mes-demarches` = démarches en cours (reprendre / récupérer). On tue le miroir.
2. **Titre unique** + **une recherche universelle** (situations + dossiers fusionnés).
3. **h1 du guichet = « Qu'est-ce qui vous arrive ? »**. URL `/mon-dossier` inchangée (SEO). Validé sur maquette interactive (artifact 2026-07-20).

## Objectif
`/mon-dossier` = une seule porte d'entrée « démarrer », sans doublon avec `/mes-demarches` (vers laquelle elle pointe pour la reprise).

## État actuel (le problème)
`app/mon-dossier/mon-dossier-client.tsx` empile :
1. header : h1 `monDossierTitle` (« Mon dossier ») + intro + carte d'aide.
2. section `#dossier-en-cours` : h2 `ongoingDossier` + liste `ActiveRunCard` + compteur + lien « Toutes mes démarches → » (`/mes-demarches`). **← le miroir.**
3. guichet : h2 `guichetTitle` (« Qu'est-ce qui vous arrive ? ») + `<DossierWizard>` — qui a SON propre en-tête `wizardAssistantTitle` (« L'assistant dossier ») + un libellé `wizardSituationQuestion` + une barre de recherche de situations dans `StepSituation`.
4. catalogue : h2 `guichetBrowseAll` (« Parcourir tous les dossiers ») + barre de recherche de dossiers + tris + filtres + groupes.

## Design cible

### A. Le miroir → bandeau de reprise
- **Retirer** la section `#dossier-en-cours` (liste `ActiveRunCard` + compteur + lien).
- **Ajouter** un bandeau discret, rendu UNIQUEMENT si `activeRuns.length > 0`, sous le header (avant la recherche) : « **Vous avez {N} démarche(s) en cours** » + sous-ligne (noms des dossiers concernés, tronquée) + CTA « **Reprendre →** » vers `/mes-demarches`. `count = activeRuns.length` (`activeRuns` déjà passé au client). 0 → aucun bandeau.
- **Ancre `#dossier-en-cours`** : le HelpRow « Où en est ma demande ? » (Task 0.5) y pointait → le retargetter vers `/mes-demarches` (la réponse vit là maintenant).

### B. Titre unique + assistant sans en-tête
- **h1 = « Qu'est-ce qui vous arrive ? »** (accent italique via `t.rich`, cohérent avec les pages sœurs). Fusionne l'ancien h1 `monDossierTitle` + le h2 `guichetTitle`.
- **`<DossierWizard>` prop `hideHeader?: boolean`** (défaut `false`) : masque `wizardAssistantTitle` + sous-titre + `wizardSituationQuestion` quand l'assistant est dans le guichet. Défaut `false` → aucun impact sur l'autre usage (`components/decision-builder/simulation-panel.tsx`, `dryRun`).

### C. Recherche universelle (situations + dossiers)
Une **seule barre** en haut du guichet (sous le bandeau) qui remplace la barre de l'assistant ET celle du catalogue. La **propriété de la recherche vit dans le parent** `mon-dossier-client.tsx` (qui a déjà `situations` ET `catalog`) :
- state `query` ; `matchedSituations` = filtre `situations` sur label/description (logique actuelle de `StepSituation`, ~l.488-494) ; `matchedDossiers` = le scoring existant du catalogue (`searchResults`) piloté par `query`.

**Rendu sous la barre :**
- **`query` vide → vue par défaut** : « Par situation » (pills thématiques + tuiles de situation = contenu de `StepSituation`, SANS sa barre) ; puis « Parcourir tous les dossiers » (catalogue complet : tris/filtres/groupes existants, SANS sa propre barre).
- **`query` non vide → résultats fusionnés** : groupe « Situations » (`matchedSituations`) + groupe « Dossiers » (`matchedDossiers`), chacun masqué si vide, avec compteur.
  - **clic situation** → `setPresetSituation(value)` + vider `query` → l'assistant (revenu en vue par défaut) se remonte à l'étape 2 pour cette situation (**réutilise `presetSituation`/`initialSituation`/`key` de Task 0.6**).
  - **clic dossier** → `Link` vers `/d/{slug}` (démarrer).
  - **zéro résultat** → monter `IntentSearch` (secours IA « Décrivez votre situation avec vos mots », déjà autonome, Task 4.3 ; dégrade proprement IA OFF).
- **Interaction assistant** : les tuiles de la vue par défaut gardent le flux interne de l'assistant (clic tuile → étape 2) ; les résultats « Situations » passent par `presetSituation` (0.6) → même destination.

## Composants & interfaces
- **`app/mon-dossier/mon-dossier-client.tsx`** (gros du travail) : nouvelle structure (1 titre → bandeau conditionnel → recherche universelle → vue défaut/résultats) ; state `query` ; retrait de la section `#dossier-en-cours` ; le catalogue existant devient la « vue défaut dossiers » + le groupe « Dossiers » des résultats (piloté par `query`, sa barre retirée, tris/filtres conservés pour la vue défaut).
- **`components/docbel/onboarding/dossier-wizard.tsx`** : prop `hideHeader?: boolean` ; barre de recherche interne de `StepSituation` retirée (déplacée dans le parent — conditionnée par `hideHeader` pour ne pas toucher `simulation-panel`). Pills + tuiles conservés.
- **`app/mon-dossier/page.tsx`** : normalement inchangé (fournit déjà `situations`, `catalog`, `activeRuns`, `initialSituation`) — à vérifier.
- **`messages/fr.json`** (édition chirurgicale, CRLF + doublons) : nouvelles clés (bandeau reprise pluralisé ; placeholder recherche universelle ; libellés groupes « Situations » / « Dossiers ») ; h1 = « Qu'est-ce qui vous arrive ? » (réutiliser/renommer `guichetTitle` en h1, ne pas supprimer de clé).

## Logique pure & tests
Extraire le filtre fusionné en **fonction pure** `filterGuichet(query, situations, catalog) → { situations, dossiers }` (hors JSX, testable). Tests vitest : requête vide → tout ; « emploi » → situations + dossiers attendus ; requête sans match → deux listes vides (⇒ secours IA) ; insensibilité casse/accents.

## Cas limites
- `activeRuns.length === 0` → pas de bandeau.
- `?situation=` (Task 0.6) → continue de préremplir l'assistant à l'étape 2 (via `presetSituation`) — inchangé.
- Catalogue vide (aucun bundle publié) → vue « aucun dossier » (clés existantes) ; recherche → secours IA.
- IA OFF → `IntentSearch` dégrade proprement (Task 4.3 vérifié).
- Assistant réutilisé (`simulation-panel`, `dryRun`) → sans `hideHeader` : comportement inchangé.
- Ancre `#guichet` (Task 4.1, HelpRow « Trouver le bon dossier ») → conservée sur le conteneur du guichet.

## Hors périmètre
- `/mes-demarches` (inchangé — reste propriétaire de la liste en cours).
- Le flux multi-étapes interne de l'assistant (sous-question / raffinement) — inchangé.
- Pas de scoring IA en direct dans la barre (l'IA reste le secours zéro-résultat).
- Traductions non-FR des nouvelles clés (fallback FR ; signaler aux traducteurs).

## Validation
`pnpm build` + `pnpm test` (dont `filterGuichet`) + `pnpm i18n:check` + `pnpm lint` (pas de NOUVELLE erreur). QA visuelle (guichet vide/rempli, recherche, mobile) = Oraliks. La spec e2e `tests/e2e/mon-dossier/mon-dossier.spec.ts` devra être ré-adaptée à la nouvelle structure.
