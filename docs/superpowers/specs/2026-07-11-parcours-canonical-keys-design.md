# Vocabulaire de clés canoniques Orientation ↔ Pré-qualification (Lot 4) — Design

**Date :** 2026-07-11
**Statut :** approuvé (design validé par Oraliks)
**Contexte :** Lot 4 de l'unification « Parcours & dossiers ». Branche
`feat/parcours-canonical-keys` (base : `feat/parcours-dossiers-unification`).

## Problème

Le citoyen répond deux fois aux mêmes questions : d'abord dans le **wizard
d'orientation** (Decision Builder → arbre), puis dans la **pré-qualification**
d'un dossier (`EligibilityPrequalifier`, alimentée par
`DocumentBundle.eligibilityQuestions`). Les deux systèmes ne se parlent pas :

- Orientation → réponses dans `BundleRun.orientationAnswers` (`{situation, subOption, refine}`).
- Pré-qual → réponses dans `BundleRun.eligibilityAnswers` (`{questionId: value}`).
- Aucun lien entre une **option d'arbre** et une **question de pré-qual**.

Un pont existe déjà côté **formulaire** (`prefillFromOrientation`, seulement 2
dossiers codés), mais **rien** ne relie l'orientation à la **pré-qualification**.

## Décisions actées (avec Oraliks)

1. **Approche** : clés canoniques (registre + tags), pas de fusion des deux
   questionnaires ni de mapping ad-hoc par dossier.
2. **Comportement runtime** : question de pré-qual déjà répondue par l'orientation
   → **pré-remplie mais modifiable** (badge « d'après vos réponses »). Jamais de
   saut, jamais de blocage (principe « informatif jamais bloquant »).
3. **Vocabulaire** : je sème un **starter à valider** ; Oraliks garde la vérité
   métier et étend.

## Contraintes

- **Zéro migration** : les tags vivent dans le JSON existant (contenu d'arbre,
  `eligibilityQuestions`).
- Additif et **désactivable** (si un tag est absent, comportement inchangé).
- Le registre de clés est **contrôlé** (code, typé). Ajouter une *clé* = un
  commit (rare) ; *taguer* avec une clé existante = en admin (fréquent).

## Architecture

### 1. Registre de clés canoniques — `lib/parcours/canonical-keys.ts` (pur)

Source de vérité du vocabulaire contrôlé. Starter semé (marqué « à valider ») :

```ts
interface CanonicalKeyDef {
  key: string;
  label: string;
  values: { value: string; label: string }[];
}
const CANONICAL_KEYS: CanonicalKeyDef[] = [
  { key: "age_bracket", label: "Tranche d'âge",
    values: [{ value: "under_25", label: "Moins de 25 ans" },
             { value: "25_plus",  label: "25 ans ou plus" }] },
  { key: "situation_familiale", label: "Situation familiale",
    values: [{ value: "isole", ... }, { value: "cohabitant", ... },
             { value: "chef_menage", ... }] },
  { key: "a_deja_travaille", label: "A déjà travaillé",
    values: [{ value: "oui", ... }, { value: "non", ... }] },
];
// helpers : getCanonicalKey(key), canonicalValues(key), isValidCanonicalPair(key, value)
```

### 2. Tags des deux côtés (JSON, zéro migration)

- **Option d'arbre** (`OptionNodeSchema`, `lib/decision-builder/schema.ts`) :
  champ optionnel `canonical?: { key: string; value: string }`. « Choisir cette
  réponse affirme `age_bracket=under_25` ».
- **Question de pré-qual** (`lib/bundles/eligibility.ts`) :
  - `EligibilityQuestionBase.canonicalKey?: string` — « cette question porte sur
    `age_bracket` ».
  - `EligibilityOption.canonicalValue?: string` (select) — « cette option = `under_25` ».
  - `EligibilityBooleanQuestion.canonicalTrue?/canonicalFalse?: string` (boolean) —
    valeurs canoniques pour oui/non.
  Parsers (`parseEligibilityQuestions`) étendus pour lire ces champs (tolérants).

### 3. Cœur pur — `lib/parcours/canonical-facts.ts`

```ts
type CanonicalFacts = Record<string, string>; // key → value

// Fusionne les tags des options choisies (validés contre le registre).
collectCanonicalFacts(taggedOptions: { canonical?: {key,value} }[]): CanonicalFacts

// Calcule les réponses de pré-qual pré-remplies depuis les faits.
// - select : option dont canonicalValue === facts[canonicalKey] → option.value
// - boolean : canonicalTrue/False === facts[key] → "true"/"false"
// - question sans canonicalKey, ou clé absente des faits → ignorée
prefillEligibilityAnswers(questions: EligibilityQuestion[], facts: CanonicalFacts): EligibilityAnswers
```

Pur, testable sans DB. Ne connaît ni prisma ni React.

### 4. Flux runtime

Résolution **côté serveur** dans `app/d/[slug]/page.tsx` (déjà server component,
lit déjà le cookie d'orientation) :

1. Lire les réponses d'orientation (cookie / `BundleRun.orientationAnswers`).
2. Charger l'arbre publié du segment, résoudre les options choisies → leurs tags
   `canonical` → `CanonicalFacts` via `collectCanonicalFacts`.
3. Passer `facts` à `<BundleRunner>` (nouvelle prop `orientationFacts`).
4. Le runner calcule `prefillEligibilityAnswers(questions, facts)` et l'utilise
   comme **base** des `eligibilityAnswers` (une saisie manuelle ultérieure prime).
   Chaque question pré-remplie affiche un badge « d'après vos réponses »,
   modifiable.

> **Détail de plan (non tranché ici) :** la correspondance exacte « réponse
> d'orientation → option d'arbre taguée » dépend de la façon dont
> `orientationAnswers` référence les options (ids/values via l'adaptateur
> arbre→wizard). Le plan d'implémentation validera la résolution ; repli sûr =
> aucun fait dérivé → pré-qual normale (jamais de régression).

### 5. Admin (tagging)

- **Inspecteur de nœud** (`components/decision-builder/node-inspector.tsx`,
  éditeur d'option) : `<Select>` clé + `<Select>` valeur (depuis le registre).
  Écrit `option.canonical`.
- **Éditeur de questions d'éligibilité**
  (`components/admin/documents/eligibility-questions-editor.tsx`) : `<Select>`
  clé sur la question + `<Select>` valeur par option (et oui/non pour boolean).

## Tests

- `lib/parcours/__tests__/canonical-keys.test.ts` : intégrité du registre (clés
  uniques, valeurs uniques par clé, helpers).
- `lib/parcours/__tests__/canonical-facts.test.ts` : `collectCanonicalFacts`
  (fusion, conflit, tag invalide ignoré) ; `prefillEligibilityAnswers` (match
  select, match boolean, question sans mapping ignorée, clé absente ignorée,
  n'écrase PAS une saisie manuelle existante).

## Phasage (lots ≤ 5 fichiers, commit entre chaque)

- **Lot A — Fondation pure** : `canonical-keys.ts` + `canonical-facts.ts` + tests.
  Aucun câblage. → tests verts.
- **Lot B — Tags data-model** : `OptionNode.canonical` (schema arbre) +
  `EligibilityQuestion.canonicalKey/Value` + parsers. Pas d'UI.
- **Lot C — Admin tagging** : node-inspector + eligibility-questions-editor.
- **Lot D — Runtime** : résolution serveur dans `app/d/[slug]/page.tsx` +
  pré-remplissage + badge dans `bundle-runner.tsx`.

Chaque lot est indépendamment vérifiable ; le repli (tags absents) garantit zéro
régression tant que Oraliks n'a pas tagué de contenu.

## Hors périmètre (YAGNI)

- **Clés gérées en admin** : le registre reste en code ; ajouter une clé = commit.
- **Tagging des options `config.ts`** (orientation codée héritée) : seules les
  options d'**arbre DB** portent des tags en v1 (config.ts est en voie de
  remplacement par le Decision Builder).
- **Saut de question** (masquage) : on fait uniquement pré-remplissage modifiable.
- **Backfill** des faits canoniques sur les runs existants.
- **Confiance** / masquage conditionnel : écarté (complexité).

## Le starter de vocabulaire est « à valider »

`age_bracket`, `situation_familiale`, `a_deja_travaille` sont un point de départ
raisonnable mais **non figé** : Oraliks corrige les valeurs (ex. seuils d'âge
21/25 selon les règles ONEM d'insertion) et étend le registre au fil des besoins.
