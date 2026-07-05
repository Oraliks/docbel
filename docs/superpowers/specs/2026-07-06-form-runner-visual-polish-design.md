# Spec — Polish visuel du form-runner (alignement mockups)

- **Date :** 2026-07-06
- **Statut :** validé par Oraliks (4 mockups fournis) — exécution inline
- **Périmètre :** présentation uniquement, **zéro logique**. La refonte
  précédente (spec 2026-07-05) a livré la bonne mécanique (stepper, aide
  contextuelle, tooltips, sections repliées) mais un habillage jugé trop
  brut. Ce lot applique le langage visuel des mockups.

## Direction (synthèse des 4 mockups)

- Grand titre d'étape en serif (`.glass-display`), sous-titre discret.
- Stepper pleine largeur : cercles size-9 (numéro → coche), connecteurs
  extensibles, connecteur violet une fois l'étape passée.
- Questions binaires (oui/non, cases) en **lignes compactes** — libellé +
  « i » à gauche, contrôle à droite — empilées dans un conteneur à
  séparateurs, au lieu de la grille 2 colonnes aérée.
- Cartes de choix : pastille radio à gauche, bordure/fond lilas à la
  sélection, grille alignée (2-3 colonnes).
- Pied d'étape : « Étape X sur Y » + barre de progression fine + % à
  gauche ; Précédent / Continuer en pilules à droite.
- Panneau d'aide : eyebrow, puce-icône, bloc Exemples encadré, bloc
  « Besoin d'aide ? » avec lien réel vers `/contact`.
- Oui/Non segmenté en pilule.

## Changements

| Fichier | Nature |
|---|---|
| `components/pdf-forms/form-stepper.tsx` | réécriture visuelle |
| `components/pdf-forms/context-help-panel.tsx` | réécriture (structure riche + i18n labels) |
| `components/ui/option-card.tsx` | réécriture visuelle (pastille radio) |
| `components/ui/yes-no-segmented.tsx` | pilule (retouche) |
| `components/pdf-forms/pdf-field.tsx` | prop opt-in `rowLayout` (checkbox + radio-2) |
| `components/pdf-forms/pdf-form-runner.tsx` | titre serif, split rows dans FieldsCluster, pied avec progression, carte confirmation avec icône |
| `messages/{fr,nl,de}.json` | 5 clés (`runnerStepCounter`, `runnerHelp*`) |

## Exclusions (décisions antérieures maintenues)

- Pas d'étape upload/justificatifs (les mockups IA l'ont hallucinée).
- Pas de questionnaire d'aiguillage.
- Pas de faux numéro de contact — lien vers `/contact` réel.
- Repli legacy (`PDF_FORM_LEGACY_LAYOUT`) : intact, `rowLayout` est opt-in
  (défaut false), le chemin legacy ne le passe jamais.

## Validation

`pnpm build`, `pnpm test`, `pnpm i18n:check`, vérification navigateur
réelle sur `/document/c1-changement-situation` (le code est sur le checkout
principal, le preview sert le bon code).
