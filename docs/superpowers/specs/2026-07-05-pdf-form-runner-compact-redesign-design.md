# Spec — Refonte compacte du rendu des formulaires PDF (`PdfFormRunner`)

- **Date :** 2026-07-05
- **Statut :** design validé par Oraliks — à relire avant plan
- **Sujet :** remplacer le rendu actuel du formulaire de remplissage (dense,
  grille 2 colonnes, résumé détaillé final) par un parcours compact guidé
  (stepper visuel, panneau d'aide contextuelle, tooltips « i », accordéons,
  cartes de choix) — appliqué **partout** où un `PdfForm` est rempli par un
  citoyen (tous les dossiers, tous les formulaires compagnons), en une seule
  session, avec un filet de sécurité technique pour un retour arrière
  instantané si besoin.
- **Origine :** mockup + brief détaillé fourni par Oraliks (inspiré de 3
  concepts : stepper horizontal, aide contextuelle à droite, cartes
  séquentielles), affiné par échange (cf. §2).

---

## 1. Contexte & problème

`components/pdf-forms/pdf-form-runner.tsx` (545 lignes) est LE composant
générique qui rend n'importe quel `PdfForm` pour qu'un citoyen le remplisse —
utilisé par tous les dossiers (chômage temporaire/complet/frontalier,
prépension, allocations-insertion, changement-situation-personnelle) et tous
les formulaires compagnons (C1A/B/C, C46, C47, C1-Partenaire, C1-Regis, etc.).

Aujourd'hui : une étape = une section du formulaire (regroupement déjà
existant, cf. `lib/pdf-forms/section-labels.ts`), affichée en tabs
horizontaux ; chaque étape montre TOUS ses champs d'un coup dans une grille 2
colonnes ; l'étape finale liste la valeur de CHAQUE champ (`SummaryStep`).
Pour un formulaire comme le C1 (~12 sections, jusqu'à 149 champs une fois
enrichi), c'est dense, intimidant, et donne une impression « brute ».

## 2. Décisions validées (issues des échanges)

- **Périmètre : tous les formulaires PDF de l'app, en une session.** Pas de
  phasage par dossier — le nouveau rendu remplace l'ancien partout, en
  acceptant le risque (choix explicite d'Oraliks après mise en garde sur
  l'ampleur).
- **Un seul moteur, pas de composant parallèle.** `PdfFormRunner` est modifié
  EN PLACE. Pas de `C1ChangeSituationForm` séparé : le C1 reste rendu par le
  même composant générique que tout le reste, avec des champs qui s'habillent
  différemment via des propriétés de données (`renderAs`, `stepPriority`),
  pas via une bifurcation de code.
- **Étapes dynamiques selon pertinence** (pas un nombre fixe 2-3) : une
  section dont aucun champ n'est répondu ET dont les champs sont tous
  `stepPriority: "optional"` devient un bloc replié en fin de parcours plutôt
  qu'une étape obligatoire. Pour le C1, la plupart des utilisateurs ne
  verront réellement que 2-4 étapes ; le nombre total de sections (~12) ne
  change pas, mais leur MISE EN AVANT oui.
- **Filet de sécurité à coût réduit** : l'ancien rendu (grille dense +
  `SummaryStep`) est déplacé tel quel dans une fonction interne isolée, pas
  supprimé. Un env var **serveur** (jamais `NEXT_PUBLIC_*`, pour rester
  bascule-en-prod-sans-rebuild) contrôle laquelle des deux s'affiche.
- **Aucun changement de logique** : validation Zod, auto-save (debounce
  1500ms existant), génération PDF, signature numérique, consentement, mode
  de livraison (téléchargement/Doccle), prefill itsme, chargement de
  brouillon — tout ça reste identique. Seule la présentation change.
- **Écart assumé** : « Le changement concerne-t-il d'autres personnes ? »
  du mockup n'existe pas comme champ réel du C1 — non inventé. Couvert
  fonctionnellement par les champs `situation-familiale`/FAC existants dans
  leur propre étape.
- **« Enregistrer et quitter »** : pas un nouveau mécanisme — relié au code
  de reprise déjà existant (`ResumeCodeBanner`).

## 3. Architecture — vue d'ensemble

```
PdfFormRunner (modifié en place)
├── FormStepper           (nouveau — remplace la barre de tabs)
├── FormShell              (nouveau — layout 2 colonnes : formulaire | aide)
│   ├── [pour chaque étape "fields"]
│   │   ├── CompactAccordionSection[]  (nouveau — sous-groupes compacts)
│   │   │   └── QuestionRow[]          (nouveau — label + InfoTooltip + champ)
│   │   │       ├── InfoTooltip        (nouveau)
│   │   │       ├── OptionCard[]       (nouveau — SI field.renderAs === "chip")
│   │   │       ├── YesNoSegmentedControl  (nouveau — SI radio 2 options, auto)
│   │   │       └── PdfField           (existant — sinon, rendu inchangé)
│   │   └── AutoSaveNotice             (nouveau — surface l'auto-save existant)
│   └── ContextHelpPanel   (nouveau — contenu dérivé de l'étape active)
├── [étape finale "summary", ré-habillée]
│   └── carte confirmation compacte (remplace SummaryStep)
└── LegacyFieldsGrid + SummaryStep     (existant, déplacé, gated par env var)
```

Les fichiers `app/document/[slug]/page.tsx` et `app/d/[slug]/page.tsx` (server
components) lisent l'env var serveur et passent `legacyLayout: boolean` en
prop à `PdfFormRunner`.

## 4. Modèle de données — 2 propriétés optionnelles sur `PdfFormField`

Ajoutées à `lib/pdf-forms/types.ts` (interface `PdfFormField`), toutes deux
**optionnelles** → aucun formulaire existant n'est affecté tant qu'on ne les
définit pas explicitement dessus :

```ts
/// Habillage visuel spécifique d'un champ. Absent = rendu par défaut
/// (PdfField inchangé, ou YesNoSegmentedControl automatique si radio à 2
/// options). "chip" = rendu en carte de choix cliquable (OptionCard) —
/// réservé aux champs où un choix visuel fait sens (ex. motif C1, types de
/// modification). N'affecte ni la validation ni la valeur stockée.
renderAs?: "chip";

/// Priorité d'affichage de la SECTION à laquelle appartient ce champ (pas
/// du champ individuellement — tous les champs d'une section doivent
/// porter la même valeur, vérifié en dev). Absent = "core" (comportement
/// actuel inchangé : toujours une étape séquentielle). "optional" = la
/// section devient un bloc replié en fin de parcours, déplié automatiquement
/// si l'utilisateur y a déjà répondu (reprise de brouillon).
stepPriority?: "core" | "optional";
```

## 5. Algorithme de construction des étapes (remplace `steps` useMemo actuel)

1. Grouper les champs visibles par section (logique de regroupement globale
   déjà existante — inchangée).
2. Pour chaque groupe, lire `stepPriority` du premier champ (uniforme au sein
   d'un groupe — un avertissement dev `console.warn` si incohérence
   détectée, jamais un crash).
3. Groupes `"core"` (ou sans `stepPriority`) → étapes séquentielles, ordre de
   première apparition (comme aujourd'hui).
4. Groupes `"optional"` → **un seul** bloc final "Autres informations à
   déclarer" avant l'étape résumé, avec un `CompactAccordionSection` par
   section optionnelle, **replié par défaut SAUF si** au moins un champ de
   cette section a déjà une valeur dans `values` (reprise de brouillon,
   prefill) → dans ce cas déplié automatiquement.
5. Étape `"summary"` toujours en dernier (inchangé).

## 6. Nouveaux composants — contrats

- **`FormStepper`** — props `{ steps: {id, label, icon, hasError, done}[], activeIndex, onSelect }`.
  Numéros/coches + ligne de connexion horizontale, style glass (tokens
  `--glass-accent-deep`, `--glass-pop-bg`). Remplace la barre de tabs
  (pdf-form-runner.tsx:337-369) à l'identique côté logique (clic = `setActive`).
- **`FormShell`** — layout CSS grid 2 colonnes desktop (`lg:grid-cols-[1fr_320px]`),
  1 colonne mobile (panneau d'aide en dessous, pas caché). Pas de `max-w-*`
  sur sa racine (règle DESIGN_RULES).
- **`QuestionRow`** — props `{ label, tooltip?, required, children }`. Rend le
  label court + `InfoTooltip` si `tooltip` fourni + le champ passé en enfant.
- **`InfoTooltip`** — props `{ text }`. Enrobe `components/ui/tooltip.tsx`
  (hover/focus desktop) ; ajoute un `onClick` qui bascule un état ouvert
  local pour le tap mobile (le Tooltip base-ui existant ne gère pas le tap
  nativement — vérifié dans l'exploration).
- **`ContextHelpPanel`** — props `{ title, body, examples?: string[] }`.
  Carte sticky (`lg:sticky lg:top-6`), contenu = `sectionLabel()` existant +
  un texte court par section (nouveau dictionnaire, cf. §7) + liste
  d'exemples optionnelle.
- **`OptionCard`** — props `{ label, selected, onToggle, icon? }`. Carte
  cliquable, anneau `--glass-accent-deep` si sélectionnée. Utilisé en grille
  `flex flex-wrap gap-2` pour les champs `renderAs: "chip"` — single-select
  si le champ est `type: "radio"`, multi-select (indépendant) si `type:
  "checkbox"`.
- **`YesNoSegmentedControl`** — props `{ value, onChange, options: [FieldOption, FieldOption] }`.
  Auto-appliqué (pas d'opt-in par champ) à tout champ `type: "radio"` à
  exactement 2 options qui n'a pas `renderAs: "chip"`. Générique, bénéficie à
  tous les formulaires immédiatement (beaucoup de radios oui/non dans le
  catalogue C1 : activité accessoire, administrateur société, pension...).
- **`CompactAccordionSection`** — enrobe `components/ui/accordion.tsx`
  existant, un item par section optionnelle ou sous-groupe.
- **`AutoSaveNotice`** — props `{ lastSavedAt: Date | null }`. Texte discret
  « Vos réponses sont enregistrées automatiquement » + horodatage si
  `lastSavedAt` défini ; lien vers le code de reprise (récupère
  `bundleRunId`/`resumeCode` déjà disponibles dans le flux dossier —
  n'affiche rien si le formulaire est rempli hors dossier, cf. §9).

`PdfField` (rendu bas-niveau des types de champ) n'est **pas** réécrit — il
reste le point d'entrée pour les types non couverts par `OptionCard`/
`YesNoSegmentedControl` (text, date, select, niss, iban, array, signature,
fullname...).

## 7. Contenu spécifique C1 (habillage, pas un moteur séparé)

Dans `lib/pdf-forms/seed/c1-fields-improvements.ts` :

- `motifIntroduction` + les 5 (ou 6, cf. session précédente) champs
  `modificationXxx` → `renderAs: "chip"`.
- `stepPriority: "optional"` sur les sections dont le contenu ne concerne pas
  tout le monde : activités (`mes-activites`), revenus (`mes-revenus`),
  cotisation syndicale, non-UE, divers, annexes. **À vérifier précisément
  section par section pendant l'implémentation** (relire le fichier complet
  — cette liste est une proposition, pas une certitude absolue sur
  l'exhaustivité des ~12 sections).
- `identite`, `demande`, `situation-familiale`, `mode-paiement`,
  `affirmations` restent `"core"` (toujours des étapes séquentielles).
- Nouveau petit dictionnaire de textes d'aide contextuelle par section (pour
  `ContextHelpPanel`), FR uniquement dans ce lot (même précédent que pour le
  dossier changement-situation-personnelle) : `lib/pdf-forms/section-help.ts`
  ou clés i18n dédiées — à trancher en plan selon le volume.

## 8. Filet de sécurité — détail technique

- Fonction interne `LegacyFieldsGrid` + `SummaryStep` : code actuel
  (pdf-form-runner.tsx:400-418 pour la grille, 504-544 pour `SummaryStep`)
  déplacé tel quel, pas réécrit.
- Env var serveur `PDF_FORM_LEGACY_LAYOUT=1` (absent/0 = nouveau rendu par
  défaut). Lu dans `app/document/[slug]/page.tsx` et `app/d/[slug]/page.tsx`
  via `process.env.PDF_FORM_LEGACY_LAYOUT === "1"`, passé en prop
  `legacyLayout` à `PdfFormRunner`.
- `PdfFormRunner` : `if (legacyLayout) return <LegacyRunnerBody ... />` tout
  en haut du rendu (après les hooks, jamais avant — règles des hooks React) ;
  sinon le nouveau rendu.

## 9. Ce qui ne bouge pas (garde-fous explicites)

- `defaultValues()`, `setValue()`/auto-save (debounce 1500ms, endpoint
  `/api/pdf/{slug}/draft`), `submit()`, validation Zod (`buildValidator`),
  résolution du signataire (`resolveSignerName`), flux itsme, chargement de
  brouillon au montage : **zéro changement de logique**, uniquement de
  présentation.
- Mode de livraison (téléchargement/Doccle), aperçu de signature numérique,
  checkbox de consentement : conservés dans l'étape finale ré-habillée, pas
  supprimés (seule la liste détaillée des valeurs disparaît).
- `PdfField` (types de champs bas niveau) : inchangé.

## 10. Style visuel

Tokens `--glass-*` existants uniquement (jamais de couleur en dur) :
`--glass-accent-deep` (#5B46E5, CTA/sélection), `--glass-pop-bg` (fond actif
léger), `--glass-surface`/`--glass-surface-strong` (cartes), `--glass-border`.
Jamais `bg-white`/`#FFFFFF` en dur (règle absolue DESIGN_RULES). Coins
12–24px, ombres diffuses, mouvement via classes existantes
(`.outils-rise`/`.glass-interactive`) — aucune nouvelle animation à écrire.

## 11. Tests / validation

- Tests unitaires ciblés sur la NOUVELLE logique pure (pas de re-test de ce
  qui ne bouge pas) : construction des étapes avec `stepPriority`
  (core/optional/absent → comportement actuel), sélection single vs
  multi-select dans `OptionCard` selon `type`, auto-dépliage d'une section
  optionnelle déjà répondue.
- Pas de nouveau test sur la validation/soumission/auto-save (logique
  inchangée, déjà couverte si des tests existent, sinon hors périmètre de ce
  lot).
- Validation manuelle (preview) sur au moins 3 formulaires représentatifs :
  C1 (changement-situation-personnelle — le cas dense), un formulaire court
  (ex. C46 ou C1B — 2-3 sections), et allocations-insertion (dossier
  multi-documents, pour confirmer que la liste de documents extérieure
  n'est pas affectée). Vérifier aussi le mode `legacyLayout` (bascule env
  var → ancien rendu identique à avant).
- `pnpm test`, `pnpm build`, `pnpm i18n:check`.

## Hors périmètre (explicitement)

- Pas de changement de `PdfField` (rendu bas-niveau des types de champs).
- Pas de nouveau mécanisme "enregistrer et quitter" — réutilise le code de
  reprise existant.
- Pas de traduction NL/DE du nouveau contenu d'aide contextuelle dans ce lot
  (précédent déjà établi : FR d'abord, suivi séparé).
- Pas de changement à la page "Documents du parcours" (liste extérieure des
  documents d'un dossier, `BundleRunner`) — uniquement le rendu INTÉRIEUR
  d'un document individuel change.
- Le classement exact "core" vs "optional" de chaque section C1 (§7) est une
  proposition à affiner en lisant le fichier complet pendant
  l'implémentation, pas une liste garantie exhaustive à ce stade.
