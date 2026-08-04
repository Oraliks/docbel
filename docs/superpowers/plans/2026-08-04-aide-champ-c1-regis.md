# Couverture de l'aide de champ — C1-Regis (Annexe Regis) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Traiter les 19 champs sans `help` de l'Annexe Regis — septième
document du chantier, avant-dernier. 9 champs reçoivent une vraie aide (les
7 colonnes « indication sur le C1 » de la grille, plus 2 champs
d'explication) ; 10 restent auto-explicatifs.

**Architecture:** Contenu sourcé, pas de code fonctionnel nouveau
(`docs/superpowers/specs/2026-08-04-couverture-aide-de-champ-design.md`). Ce
document a une **factory partagée** (`champsTableau`/`champExplication`,
`lib/pdf-forms/seed/c1-regis-fields.ts:180-246`) qui génère les 7 lignes de
la grille (nationalité, adresse, 5 personnes) — on l'étend plutôt que
d'éditer 9 sites séparés, pour rester DRY et cohérent avec le style déjà en
place (`ligne.aideRegistre` existe déjà sur ce même patron).

## Global Constraints

- **⚠️ Document le plus fragile du parc** (mémoire projet : « Annexe Regis —
  le pire du parc, 14 écarts géométriques avant réalignement du 2026-08-02,
  0 écart depuis »). On ne touche **QUE** la clé `help` — jamais
  `pdfFieldName`, `order`, `visibleIf`, `drawAt`, ni aucune autre propriété
  géométrique.
- **Réserve absolue sur les codes de la légende** (item #33 de
  `NEXT_ACTIONS.md` : « légende page 2 absente de `docs/knowledge/chomage/`,
  légende en main Oraliks »). On ne récite **jamais** le contenu des codes
  N1/N2, A1-A2 (+ sous-codes), FN1-FN5/FY1-FY5 — seul le **fait** que le PDF
  renvoie à cette légende (déjà dans le label existant, « voir légende page
  2 ») peut être complété par la phrase-cadre du PDF lui-même (« si aucun
  code ne correspond, donnez votre propre explication »), qui ne dévoile
  aucun contenu de code.
- Vérifié sur `private/pdfs/Annexe_Regis_FR.pdf` (extraction markitdown,
  2026-08-04).
- `git add` de chemin explicite uniquement.
- Commandes de validation : `pnpm vitest run lib/pdf-forms/seed/__tests__/c1-regis-fields.test.ts` · `pnpm build` · `pnpm lint`.

---

### Task 1: Étendre la factory — 7 aides sur la colonne « indication sur le C1 »

**Files:** Modify `lib/pdf-forms/seed/c1-regis-fields.ts`

**Constat** : le champ `<cle>C1` de chaque ligne (`nationaliteC1`, `adresseC1`,
`personne1C1`…`personne5C1`) n'a ni `inheritedFromDossier` ni `prefillFrom` —
le citoyen ressaisit manuellement une valeur qu'il a déjà donnée sur le C1
principal, sans que rien ne l'explique. Sourcé du titre même du formulaire
(« DECLARATION RELATIVE AUX DIFFERENCES ENTRE LES DONNEES… INDIQUÉES SUR LE
FORMULAIRE C1 ET CELLES REPRISES AU REGISTRE NATIONAL ») : ce champ existe
précisément pour comparer les deux sources, il faut donc y recopier
fidèlement le C1, pas fournir une nouvelle réponse.

- [ ] **Step 1: Localiser `champsTableau` et ajouter le `help` au champ `<cle>C1`**

Dans `lib/pdf-forms/seed/c1-regis-fields.ts`, fonction `champsTableau` :

```ts
    {
      id: `${ligne.cle}C1`,
      pdfFieldName: `${GRILLE1_C1_PREFIX}${ligne.suffixeTexte}`,
      type: "text",
      required: false,
      label: {
        fr:
          ligne.cle.startsWith("personne")
            ? `${ligne.label} — indication sur le C1 (nom, prénom)`
            : `${ligne.label} — indication sur le C1`,
      },
      visibleIf: suiteVisible,
      section: SECTION_GRILLE_DIFFERENCES,
      order: order + 1,
    },
```

devient (une seule ligne ajoutée, aucune propriété existante modifiée) :

```ts
    {
      id: `${ligne.cle}C1`,
      pdfFieldName: `${GRILLE1_C1_PREFIX}${ligne.suffixeTexte}`,
      type: "text",
      required: false,
      label: {
        fr:
          ligne.cle.startsWith("personne")
            ? `${ligne.label} — indication sur le C1 (nom, prénom)`
            : `${ligne.label} — indication sur le C1`,
      },
      // Recopie ce que le citoyen a déjà indiqué sur le C1 principal — ce
      // document sert précisément à comparer cette valeur aux registres
      // officiels, pas à recueillir une nouvelle réponse.
      help: {
        fr: "Recopiez ici exactement ce que vous avez indiqué sur le formulaire C1 — c'est cette valeur qui est comparée aux registres officiels.",
      },
      visibleIf: suiteVisible,
      section: SECTION_GRILLE_DIFFERENCES,
      order: order + 1,
    },
```

- [ ] **Step 2: Vérifier les tests de seed existants**

Run: `pnpm vitest run lib/pdf-forms/seed/__tests__/c1-regis-fields.test.ts`
Expected: PASS — en particulier les tests de géométrie (widget-geometry),
qui doivent rester à 0 écart.

- [ ] **Step 3: Commit**

```bash
git add lib/pdf-forms/seed/c1-regis-fields.ts
git commit -m "content(pdf-forms): couverture aide de champ C1-Regis (1/3) — 7 colonnes « indication sur le C1 »"
```

---

### Task 2: 2 aides sur les explications (nationalité, adresse)

**Files:** Modify `lib/pdf-forms/seed/c1-regis-fields.ts`

**Constat** : `champExplication` pose déjà `help: { fr: FN4_HELP }` pour les
5 lignes « personne » — mais rien pour `nationaliteExplication` et
`adresseExplication`. Le PDF officiel dit, mot pour mot, sous la GRILLE 2 :
« EN CAS DE DIFFERENCE, INDIQUEZ ICI UNE DES REPONSES POSSIBLES INDIQUEES AU
VERSO. SI AUCUNE DE CES REPONSES NE VOUS EST APPLICABLE, INDIQUEZ ALORS VOTRE
PROPRE EXPLICATION ET CE DE LA MANIERE LA PLUS DETAILLEE POSSIBLE. » —
recopié fidèlement, **sans** citer le contenu des codes N1/N2/A1/A2 eux-mêmes
(réserve de Global Constraints).

- [ ] **Step 1: Étendre `champExplication`**

```ts
function champExplication(ligne: Ligne, order: number): PdfFormField {
  return {
    id: `${ligne.cle}Explication`,
    pdfFieldName: ligne.suffixeTexte,
    type: "text",
    required: false,
    label: { fr: `${ligne.label} — explication (${ligne.aideExplication})` },
    ...(ligne.cle.startsWith("personne") ? { help: { fr: FN4_HELP } } : {}),
    visibleIf: { fieldId: `${ligne.cle}Difference`, op: "equals", value: "oui" },
    section: SECTION_GRILLE_DIFFERENCES,
    order,
  };
}
```

devient :

```ts
/// Texte-cadre du PDF officiel (bas de la GRILLE 2, recopié mot pour mot) —
/// dit QUE des codes existent au verso et QUE faire s'ils ne correspondent
/// pas, sans reproduire leur contenu (légende page 2, cf. NEXT_ACTIONS #33 —
/// à transcrire séparément, avec Oraliks).
const EXPLICATION_CADRE_HELP =
  "Indiquez l'une des réponses possibles indiquées au verso du formulaire officiel. Si aucune de ces réponses ne vous est applicable, indiquez alors votre propre explication, de la manière la plus détaillée possible.";

function champExplication(ligne: Ligne, order: number): PdfFormField {
  return {
    id: `${ligne.cle}Explication`,
    pdfFieldName: ligne.suffixeTexte,
    type: "text",
    required: false,
    label: { fr: `${ligne.label} — explication (${ligne.aideExplication})` },
    help: {
      fr: ligne.cle.startsWith("personne") ? FN4_HELP : EXPLICATION_CADRE_HELP,
    },
    visibleIf: { fieldId: `${ligne.cle}Difference`, op: "equals", value: "oui" },
    section: SECTION_GRILLE_DIFFERENCES,
    order,
  };
}
```

- [ ] **Step 2: Vérifier les tests de seed existants**

Run: `pnpm vitest run lib/pdf-forms/seed/__tests__/c1-regis-fields.test.ts`
Expected: PASS (les 5 lignes « personne » gardent EXACTEMENT `FN4_HELP`,
inchangé).

- [ ] **Step 3: Commit**

```bash
git add lib/pdf-forms/seed/c1-regis-fields.ts
git commit -m "content(pdf-forms): couverture aide de champ C1-Regis (2/3) — explications nationalité/adresse (texte-cadre du PDF, sans les codes)"
```

---

### Task 3: 10 champs déjà auto-explicatifs

**Files:** Modify `lib/pdf-forms/seed/c1-regis-fields.ts`

`nom`, `prenom`, `nombreAnnexesJointes` (identité/pied-de-page, triviaux) et
les 7 champs `<cle>Difference` de la grille (question binaire directe, « y a
-t-il une différence ? » déjà dans le label) restent sans `help`.

- [ ] **Step 1: `nom`** — ajouter après son `label` :
```ts
    // Pas de `help` : aucun texte imprimé propre à ce champ.
```
- [ ] **Step 2: `prenom`** — même geste.
- [ ] **Step 3: `nombreAnnexesJointes`** — même geste.

- [ ] **Step 4: Les 7 `<cle>Difference` — un seul point d'ajout dans la factory**

Dans `champsTableau`, le champ `diffId` :

```ts
    {
      id: diffId,
      pdfFieldName: cases,
      type: "radio",
      required: false,
      label: { fr: `${ligne.label} — y a-t-il une différence avec les registres ?` },
      options: YN,
      section: SECTION_GRILLE_DIFFERENCES,
      order,
    },
```
devient (un seul edit couvre les 7 lignes, la factory étant partagée) :
```ts
    {
      id: diffId,
      pdfFieldName: cases,
      type: "radio",
      required: false,
      label: { fr: `${ligne.label} — y a-t-il une différence avec les registres ?` },
      // Pas de `help` : le label EST déjà la question complète.
      options: YN,
      section: SECTION_GRILLE_DIFFERENCES,
      order,
    },
```

- [ ] **Step 5: Vérifier, commit, valider tout le lot**

Run: `pnpm vitest run lib/pdf-forms/seed/__tests__/c1-regis-fields.test.ts && pnpm build && pnpm lint`

```bash
git add lib/pdf-forms/seed/c1-regis-fields.ts
git commit -m "content(pdf-forms): couverture aide de champ C1-Regis (3/3) — identité et grille Difference documentés sans aide"
```

---

### Task 4: Audit réglementaire ciblé + push

- [ ] **Step 1: `/verif-reglementation` sur les 2 vrais ajouts de contenu**

Cibler les 9 champs avec un vrai nouveau texte (7× aide « indication sur le
C1 », identique ; `EXPLICATION_CADRE_HELP` sur 2 champs) — vérifier
spécifiquement qu'`EXPLICATION_CADRE_HELP` ne laisse rien deviner du contenu
des codes N/A/FN/FY (réserve de Global Constraints).

- [ ] **Step 2: Push**

```bash
git push
```

---

## Self-review

Les 19 champs de l'audit sont traités : 9 vraies aides (7 identiques sur la
colonne C1, 2 sur les explications nationalité/adresse — texte-cadre du PDF
recopié fidèlement), 10 documentés comme auto-explicatifs. La factory
partagée est étendue par une seule clé (`help`) sans toucher à la géométrie
durement acquise (0 écart depuis le réalignement S14). La réserve sur les
codes de la légende (item #33) est strictement respectée : aucun contenu de
code N/A/FN/FY n'est reproduit.
