# Spec — Écran d'explication « parcours » avant le questionnaire de dossier

- **Date :** 2026-07-03
- **Statut :** design validé par Oraliks — à relire avant plan
- **Sujet :** remplacer l'arrivée directe sur le questionnaire de
  `/d/allocations-insertion` par un écran pédagogique (4 étapes + CTA), sans rien
  casser pour les autres dossiers. Conçu comme un **modèle réutilisable** pour
  n'importe quel dossier, activé uniquement sur `allocations-insertion` pour
  l'instant.
- **Origine :** Oraliks a soumis 5 mockups (infographies « Stage d'insertion
  professionnelle » / « Allocations d'insertion », parcours en 4 étapes) comme
  inspiration visuelle. Fait suite à la correction du bug « 310 jours » (cf.
  session du même jour) — les faits affichés doivent rester dérivés de
  `lib/dossiers/allocations-insertion/index.ts`, jamais dupliqués à la main.

---

## 1. Contexte & problème

`/d/allocations-insertion` (comme tous les dossiers) affiche aujourd'hui
directement le questionnaire d'orientation (`BundleRunner`) : 7 questions avant
la moindre explication. Pour un dossier destiné à un public qui découvre le
sujet (jeunes sortant des études), ça manque de pédagogie et donne l'impression
d'un mur de formulaires.

Objectif : un écran d'accueil qui explique le parcours en 4 étapes simples
(« après les études » → « pendant 156 jours » → « fin du stage » → « après
acceptation »), compréhensible par « Monsieur tout le monde », avec un bouton
« Créer ma demande sur base des études » qui démarre le questionnaire existant.

## 2. Décisions validées

- **Portée** : modèle générique réutilisable (nouveau champ optionnel sur
  `DossierDefinition`), mais seul `allocations-insertion` le fournit pour
  l'instant. Les autres dossiers (chômage complet/temporaire/frontalier,
  prépension) n'ont pas ce champ → comportement **strictement inchangé**
  (questionnaire direct, comme aujourd'hui).
- **Source du contenu** : nouveau champ structuré sur `DossierDefinition`
  (pas de contenu statique dupliqué dans le composant de page, pas de
  réutilisation forcée des sections `theory` existantes qui sont longues et
  réservées admin/partenaires).
- **Navigation du CTA** : même URL (`/d/allocations-insertion`), bascule
  d'affichage côté client (pas de nouvelle route).
- **Contenu additionnel** : la sidebar réutilise **telles quelles** les données
  déjà modélisées du dossier — `warnings` (ex. « avant 25 ans », « 156 jours »)
  et `documents` (ex. C1). **Connu et accepté** : `documents` ne contient
  aujourd'hui qu'1 entrée (C1) — la liste sera plus courte que sur les mockups
  (pas de « carte d'identité », « preuve de diplôme »... ce ne sont pas des
  `DossierDocument` modélisés). Pas de nouvelle liste inventée pour compenser ;
  la sidebar s'enrichira naturellement si/quand ces pièces sont ajoutées au
  dossier.
- **Composant** : wrapper dédié, **zéro modification de `BundleRunner`**
  (cf. §4).
- **Utilisateur qui reprend un dossier en cours** (`run` existant via cookie/
  code de reprise) : saute directement au questionnaire, ne revoit jamais
  l'écran d'explication.
- **Animation/interaction** : réutilisation stricte du vocabulaire de mouvement
  existant (`app/globals.css`), rien de nouveau à écrire (cf. §7).

## 3. Modèle de données

Nouveau, dans `lib/dossiers/types.ts` (à côté de `DossierTheorySection` /
`DossierProcedure`, mais **audience publique** — contrairement à ces deux-là) :

```ts
/// Identifiant d'icône pour une étape de parcours public. Jeu volontairement
/// restreint ; résolu vers un composant Lucide dans le composant de rendu
/// (pas de référence de composant directe = reste sérialisable server→client).
export type JourneyStepIcon = "user-check" | "calendar" | "file-check" | "wallet";

/// Une étape du parcours public affichée en écran d'explication, AVANT le
/// questionnaire. Contenu grand public (contrairement à `theory`/`procedures`
/// qui sont admin/partenaires) : 1-2 phrases courtes, pas de Markdown long.
export interface DossierJourneyStep {
  order: number;
  icon: JourneyStepIcon;
  title: string;
  /// Clé i18n (préférée si fournie). Namespace : `public.dossierContent.<slug>.journey.step<N>.title`.
  titleKey?: string;
  body: string;
  bodyKey?: string;
}
```

Sur `DossierDefinition` (`lib/dossiers/types.ts`) :

```ts
/// Écran d'explication en étapes, affiché avant le questionnaire pour un
/// nouveau visiteur. Optionnel : absent = comportement actuel inchangé
/// (questionnaire affiché directement).
journey?: DossierJourneyStep[];
/// Libellé du bouton qui démarre le questionnaire depuis l'écran
/// d'explication. Requis si `journey` est fourni (texte spécifique au
/// dossier, ex. "Créer ma demande sur base des études" — ne peut pas être
/// codé en dur dans la page partagée `app/d/[slug]/page.tsx`).
journeyCtaLabel?: string;
journeyCtaLabelKey?: string;
```

## 4. Architecture composants

Nouveau composant client `components/docbel/dossier-journey-intro.tsx` :

- **Props** : `journey: DossierJourneyStep[]`, `documents: DossierDocument[]`,
  `warnings: DossierWarning[]`, `ctaLabel: string` (+ tous les props actuels de
  `BundleRunner`, transmis tels quels).
- **État local** : `started: boolean` (défaut `false`).
  - `false` → rendu des 4 étapes (grille de cartes `.glass-surface`) + sidebar
    (warnings en encart critique/info + documents en liste courte) + bouton
    CTA.
  - `true` (après clic CTA) → rendu de `<BundleRunner {...bundleRunnerProps} />`
    strictement inchangé.
- **`BundleRunner` lui-même n'est pas modifié.**

Branchement dans `app/d/[slug]/page.tsx` (remplace la ligne `<BundleRunner
... />` actuelle) :

```tsx
{dossier?.journey && dossier.journeyCtaLabel && !run ? (
  <DossierJourneyIntro
    journey={dossier.journey}
    documents={selectedDocs ?? []}
    warnings={parseBundleWarnings(serializedBundle.warnings)}
    ctaLabel={dossier.journeyCtaLabel}
    {...bundleRunnerProps}
  />
) : (
  <BundleRunner {...bundleRunnerProps} />
)}
```

`run` (déjà calculé plus haut dans la page, cf. ligne ~79) sert de garde :
présence d'un run en cours = on saute l'explication.

## 5. Contenu — `allocations-insertion`

Ajout dans `lib/dossiers/allocations-insertion/index.ts` :

```ts
journeyCtaLabel: "Créer ma demande sur base des études",
journey: [
  {
    order: 1,
    icon: "user-check",
    title: "Après les études",
    body: "Inscris-toi comme demandeur d'emploi auprès du service régional compétent : Actiris, Forem, VDAB ou ADG.",
  },
  {
    order: 2,
    icon: "calendar",
    title: "Pendant 156 jours",
    body: "Le stage d'insertion démarre : cherche activement du travail et garde tes preuves. Suivi par le service régional de l'emploi.",
  },
  {
    order: 3,
    icon: "file-check",
    title: "Fin du stage",
    body: "Confirme ton inscription et introduis ta demande d'allocations d'insertion.",
  },
  {
    order: 4,
    icon: "wallet",
    title: "Après acceptation",
    body: "Paiement via ton organisme de paiement (CAPAC ou syndicat) + carte de contrôle mensuelle.",
  },
],
```

Chiffres et faits identiques à ceux déjà corrigés dans `questions`/`warnings`
(156 jours, organismes régionaux) — aucune nouvelle règle inventée.

## 6. i18n

Les 4 étapes (title + body) **et** `journeyCtaLabel` traduits dans les 12
langues déjà couvertes (fr/en/nl/de/es/it/pt/ar/tr/ru/mk/sq), namespace
`public.dossierContent.insertion.journey.step<N>.{title,body}` et
`public.dossierContent.insertion.journeyCtaLabel` — même traitement soigné que
la correction précédente (accord grammatical par langue vérifié, pas de
traduction mécanique approximative). `warnings`/`documents` réutilisés n'ont
besoin d'aucune nouvelle traduction (déjà couverts).

## 7. Style visuel & interaction

- **Étapes** : cartes `.glass-surface` en grille (2×2 desktop, 1 colonne
  mobile), icônes Lucide sobres (pas d'illustrations de personnages — jure avec
  le glass mauve du reste du site).
- **Entrée** : `.outils-rise` (existant, fadeInUp) par carte, décalage ~100ms
  entre chaque étape. Aucun nouveau CSS.
- **CTA** : `.glass-cta` standard (pas de variante `.animate-cta-shimmer` —
  trop voyant pour une page de lecture).
- **Cartes d'étapes** : pas de `.glass-interactive` (réservé aux surfaces
  cliquables ; les étapes ne le sont pas).
- **Ligne reliant les étapes** : trait CSS statique, pas d'animation de tracé.
- **Bascule explication → questionnaire** : fondu court (~200ms).
- Tout respecte `prefers-reduced-motion` via les classes existantes
  (automatique, rien à coder en plus).

## 8. Validation

- `pnpm build` (compile + typecheck) et `pnpm i18n:check` (ICU + couverture).
- Vérification live (preview) :
  - nouveau visiteur sur `/d/allocations-insertion` → écran d'explication.
  - clic CTA → questionnaire existant, inchangé.
  - visiteur avec un run en cours (reprise) → questionnaire direct, pas
    d'écran d'explication.
  - un autre dossier sans `journey` (ex. `chomage-complet`) → comportement
    identique à avant (aucune régression).
- Mobile + desktop (grille 2×2 → 1 colonne).

## Hors périmètre (explicitement)

- Pas de nouvelle route/URL.
- Pas de nouveau champ « documents à préparer » distinct de `documents[]`.
- Pas de généralisation immédiate à d'autres dossiers (le champ est
  réutilisable, mais seul `allocations-insertion` le remplit dans ce lot).
- Pas de modification de `BundleRunner`.
