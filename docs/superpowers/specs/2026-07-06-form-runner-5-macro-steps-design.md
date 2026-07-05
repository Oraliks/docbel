# Spec — Form-runner en 5 macro-étapes (C1) + suppression du résumé

- **Date :** 2026-07-06
- **Statut :** validé par Oraliks — exécution inline
- **Suite de :** 2026-07-06-form-runner-visual-polish-design.md

## Demande

1. Supprimer l'étape « Résumé » (inutile) ; l'action d'envoi rejoint la
   dernière étape.
2. Regrouper le C1 en **exactement 5 macro-étapes** :
   1. **Motif** ← `demande`
   2. **Identité** (+ compte bancaire) ← `identite` + `adresse` + `banque` + `mode-paiement`
   3. **Activités & revenus** ← `mes-activites` + `mes-revenus`
   4. **Situation familiale** ← `situation-familiale`
   5. **Cotisation, nationalité & divers + envoi** ← `cotisation-syndicale`
      + `non-eee` + `divers` + `affirmations` + `annexes`, footer = envoi.
3. Soigner le rendu des champs texte (cartes, sous-titres, grille propre).

## Contrainte découverte

Le PdfForm C1 en base a **149 champs dont 65 sans section** (widgets inférés
bruts, majoritairement `visibleIf`-gated). Ils ne mappent proprement sur
aucun des 5 groupes → placés dans un accordéon **replié « Autres
informations »** en fin d'étape 5. Curation fine = passe de données
ultérieure, hors périmètre.

## Modèle de données

`PdfFormField.stepGroup?: string` (optionnel, sérialisé comme `stepPriority`).
Assigné dans `applyC1Improvements` via une table section→groupe (les formes
non-C1 ne le portent pas → comportement inchangé). Champs sans section →
pas de `stepGroup` → catch « Autres informations ».

## Moteur

`buildMacroSteps(fields, values)` (pur, `lib/pdf-forms/build-steps.ts`) :
- filtre `visibleIf` + `!isAutoField` (comme `buildSteps`) ;
- si aucun champ n'a `stepGroup` → renvoie `null` (le caller retombe sur
  `buildSteps` classique — rétrocompat totale) ;
- sinon groupe par `stepGroup` (ordre = première apparition), sous-groupe par
  `section` (sous-titres) ; les champs sans `stepGroup` → `advanced` rattaché
  à la **dernière** macro-étape ;
- **pas** d'optional-collapse, **pas** d'étape résumé en mode macro.

Types : `MacroStepSection { key, fields }`, `MacroStep { id, sections[],
advanced[] }`. Titres résolus côté runner (i18n `runnerGroup*`), sous-titres
via `sectionLabel` existant.

## Runner

Mode macro (si `buildMacroSteps` ≠ null) :
- stepper = les 5 macro-étapes ;
- contenu : chaque `section` rendue via `FieldsCluster` (chips/lignes/inputs),
  précédée d'un sous-titre si la macro-étape a >1 section ; `advanced` en
  `CompactAccordionSection` replié ;
- footer : dernière étape → flux d'envoi (consent + livraison + signature +
  générer) ; autres → « Continuer ». `StepProgress` partout ;
- `ContextHelpPanel` : clé = 1ʳᵉ section de la macro-étape active.

Mode non-macro (autres formes) : strictement inchangé (buildSteps + résumé +
optional-group + repli legacy).

## i18n

5 clés titres `runnerGroupMotif/Identite/ActivitesRevenus/Famille/Final` +
1 `runnerAdvancedSectionTitle`, en fr/nl/de.

## Validation

`pnpm test` (nouveaux tests `buildMacroSteps`), `pnpm build`,
`pnpm i18n:check`, re-seed `apply-c1-improvements` (propage `stepGroup` en
base), vérif navigateur sur `/document/c1-changement-situation` : 5 étapes,
pas de résumé, envoi en étape 5, sous-titres, accordéon « Autres
informations ».
