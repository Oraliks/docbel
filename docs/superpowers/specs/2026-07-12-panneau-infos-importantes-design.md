# Panneau « Infos importantes » contextuel à gauche — Design

**Date** : 2026-07-12
**Objectif** : Sur la page de remplissage d'un formulaire (`/document/[slug]`, atteinte
depuis le parcours `/d/[slug]`), déplacer le panneau d'aide contextuelle de **droite → gauche**
et l'enrichir d'**infos importantes / obligations** qui **réagissent au choix de l'utilisateur**
(motif coché). Éditable en admin en Lot 2.

## Contexte actuel (état des lieux)

- `/d/[slug]` = parcours (liste de documents, `BundleRunner`). Chaque document ouvre
  `/document/[slug]?bundleRun=…&bundleSlug=…`.
- `/document/[slug]` → `document-page-layout.tsx` (**server**) → `PdfFormRunner` (**client**)
  → `FormShell` → `ContextHelpPanel`. C'est l'écran du mockup.
- `FormShell` : grille 2 colonnes desktop `[Card 1fr | aide 320px DROITE]`, 1 colonne mobile.
- `ContextHelpPanel` (« Conseils utiles ») : texte tiré de `lib/pdf-forms/section-help.ts`,
  clé = **section** (Motif, Identité…). Ne réagit **pas** au motif coché.
- La colonne « Détails » (date de changement) est un composant **séparé à droite dans la carte**
  (`MotifSituationPicker`) — **non concernée** par ce lot.
- Le C1 changement-situation utilise le rendu **macro-étapes** (`MacroRunnerBody`, 5 étapes).
  Il y a **deux sites de rendu** de `ContextHelpPanel` : `RunnerBody` (~ligne 682) et
  `MacroRunnerBody` (~ligne 1263). Les deux doivent recevoir les nouvelles props.
- Pattern CMS zéro-migration de référence : `lib/site-settings.ts` (pur, Zod + défauts) +
  `lib/site-settings.server.ts` (lecture cachée `AppSetting` mergée sur les défauts, écriture
  stricte, résilient cold-start Neon).

## Décisions validées (brainstorming)

1. **Granularité** : contextuel au **motif coché** (repli sur l'aide d'étape si rien ne matche).
2. **Stockage / édition** : **éditable en admin (CMS)**, via le pattern `AppSetting` JSON+Zod
   → **zéro migration**.
3. **Périmètre** : **layout gauche global** (tous les formulaires) ; **contenu C1 d'abord**,
   structure extensible.
4. **Phasage** : contenu C1 livré **d'abord en défauts dans le code** (Lot 1, visible tout de
   suite) ; **éditeur admin** en Lot 2 (override les défauts).
5. **Contenu du panneau** : garder **deux blocs** — une **checklist « À vérifier »** ET des
   **rappels importants** (obligations/avertissements).

## Modèle de données (pur + serveur)

### `lib/form-context-tips.ts` (PUR, client-safe — aucun prisma)

```ts
type LocalizedText = { fr: string; nl?: string; de?: string }; // = Locale des PDF (repli FR)

type TipCondition =
  | { type: "field-checked"; fieldId: string } // motif coché, ex. "modificationAdresse"
  | { type: "section"; sectionKey: string }     // étape, ex. "identite"
  | { type: "always" };                          // toujours sur ce formulaire

interface TipEntry {
  id: string;                    // id stable (clés React + édition admin)
  when: TipCondition;
  eyebrow?: LocalizedText;       // pastille "Adresse"
  title: LocalizedText;          // titre du bloc
  intro?: LocalizedText;         // phrase d'intro
  reminders: LocalizedText[];    // puces « infos importantes » (les exemples Oraliks)
  checklist?: LocalizedText[];   // puces « À vérifier / à préparer »
  link?: { label: LocalizedText; href: string }; // « En savoir plus » (masqué si href vide)
}

type FormContextTips = Record<string /* formSlug */, { entries: TipEntry[] }>;
```

- `FORM_CONTEXT_TIPS_DEFAULTS: FormContextTips` — contenu C1 initial (voir plus bas).
- `parseFormContextTips(raw): FormContextTips` — merge résilient sur défauts + `safeParse`
  (repli défauts si invalide), calqué sur `parseSiteSettings`.
- `resolveTips(entries, ctx: { sectionKey?: string; checkedFieldIds: string[] }): TipEntry[]`
  — pur : garde `always`, `field-checked` si l'id est coché, `section` si `sectionKey` matche.
  Ordre = ordre de déclaration. Empilable (plusieurs motifs cochés = plusieurs blocs).

### `lib/form-context-tips.server.ts` (SERVER, `server-only`)

- Clé `AppSetting` = `form_context_tips`. Cache `memo-cache` (TTL ~60 s), invalidé à l'écriture.
- `getFormContextTipsDict()` — dict complet mergé (DB sur défauts), résilient P1001.
- `getFormContextTips(formSlug): TipEntry[]` — entrées du formulaire (défauts si absent).
- `setFormContextTips(patch, updatedBy)` — écriture stricte Zod + `logActivity` (**utilisé Lot 2**).

## Rendu (Lot 1)

- **`form-shell.tsx`** : inverser la grille → `[aide ~320px GAUCHE | Card 1fr]`
  (`lg:grid-cols-[320px_1fr]`, ordre DOM aide→carte). Mobile inchangé (aide sous le formulaire).
- **`context-help-panel.tsx`** : nouvelles props `entries?: TipEntry[]`,
  `checkedFieldIds: string[]`, en plus de `sectionKey`/`locale`.
  - `const shown = resolveTips(entries ?? defaultsFor(formSlug), { sectionKey, checkedFieldIds })`.
    Si `entries` absent (rendu sans fetch serveur), repli sur les défauts purs importés →
    jamais de panneau vide.
  - **Si `shown.length > 0`** : rendre chaque bloc (pastille `eyebrow`, `title`, `intro`,
    liste `reminders`, bloc `checklist` sous label i18n « À vérifier », lien `link` si `href`).
  - **Sinon** : rendre l'aide générique actuelle (`getSectionHelp`) — comportement inchangé.
  - Le bloc « Besoin d'aide ? » (contact) reste en pied, toujours affiché.
- **`pdf-form-runner.tsx`** : nouvelle prop `contextTips?: TipEntry[]` sur `PdfFormRunner`,
  passée à `RunnerBody` et `MacroRunnerBody`. Aux deux sites `<ContextHelpPanel …>` :
  ajouter `entries={contextTips}` et `checkedFieldIds={Object.keys(values).filter(k => values[k] === true)}`.
- **`document-page-layout.tsx`** (server) : `const contextTips = await getFormContextTips(form.slug)`
  → passer `contextTips={contextTips}` à `<PdfFormRunner>`.
- **i18n** : ajouter `runnerHelpChecklistLabel` (« À vérifier ») sous `public.dossier`.
  `link.label` / titres / puces = contenu **localisé dans la donnée** (pas de clé i18n).
  Valider `pnpm i18n:check`.

## Contenu C1 par défaut (Lot 1)

Seed **uniquement le bloc adresse** ; les autres motifs (situation familiale, permis, compte,
transfert) et les sections **retombent sur `section-help.ts`** jusqu'à rédaction par Oraliks
(admin Lot 2 ou demande explicite). **Aucun contenu légal inventé.**

- Slug du formulaire C1 changement-situation : **à confirmer depuis la DB/seed** au moment de
  l'implémentation (grep, ne pas deviner).
- Entrée `adresse` — `when: { field-checked: "modificationAdresse" }` (id confirmé dans
  `motif-situation-picker.tsx`) :
  - eyebrow : « Adresse »
  - title : « Changement d'adresse »
  - intro : « Vous avez indiqué un changement d'adresse. À garder en tête : »
  - reminders (verbatim Oraliks) :
    - « Restez inscrit chez Actiris — c'est une obligation, même après votre déménagement. »
    - « Le changement prend effet dès que vous habitez réellement à la nouvelle adresse :
      n'attendez pas la validation de la commune, qui peut prendre plusieurs semaines. »
  - checklist : « Date effective du déménagement », « Nouvelle adresse complète »,
    « Commune / code postal », « Composition du ménage si elle a changé »
  - link : `href: ""` (masqué) — Oraliks fournira une URL réelle si besoin.
- NL/DE : repli FR (traductions natives ultérieures, cohérent avec le reste de l'i18n).

## Lot 2 — Éditeur admin (CMS) — IMPLÉMENTÉ (2026-07-12)

- Page `app/admin/pdf/conseils/page.tsx` (server, auth via `app/admin/layout.tsx`) : charge le
  dict (`getFormContextTipsDictUncached`), les formulaires publiés (dérive les champs *checkbox*
  + sections distinctes pour les menus de condition), et les métadonnées d'édition.
- Éditeur `conseils-client.tsx` : sélecteur de formulaire, CRUD des entrées (condition
  `field-checked`/`section`/`always`, pastille/titre/intro/rappels/checklist/lien), **édition par
  langue active** (bascule FR/NL/DE, FR obligatoire, repli FR), réordonnancement, barre de
  sauvegarde collante, validation client + toast. Clone du pattern `parametres-client.tsx`.
- Route API `app/api/admin/form-context-tips/route.ts` : GET (dict + défauts + meta), PUT
  (remplace le dict complet) — `requireAdminAuth` + `ensureWriteAllowed` + `setFormContextTips`.
- Lien nav ajouté dans `components/app-sidebar.tsx` (sous « Formulaires PDF » → « Conseils formulaires »).
- Métadonnées d'édition : `getFormContextTipsMeta` ajouté à `lib/form-context-tips.server.ts`.
- Panneau durci contre les textes CMS vides (pastille/puce/lien creux filtrés).
- Vérifié : 1451 tests verts (dont 14 sur le module), `tsc` 0 erreur dans ces fichiers, eslint 0
  erreur, route API renvoie 401 sans session (garde OK), page admin 404 sans session (comme les
  autres pages admin = `notFound()` du layout). Round-trip AUTHENTIFIÉ non rejouable en preview
  (pas de session admin) — couvert par le typecheck + le clone du stack site-settings prouvé.

## Fichiers touchés

**Lot 1** (~6) : `lib/form-context-tips.ts` (NEW), `lib/form-context-tips.server.ts` (NEW),
`components/pdf-forms/form-shell.tsx`, `components/pdf-forms/context-help-panel.tsx`,
`components/pdf-forms/pdf-form-runner.tsx`, `components/pdf-forms/document-page-layout.tsx`,
+ catalogue i18n (`runnerHelpChecklistLabel`).

**Lot 2** : page/onglet admin + route API de sauvegarde.

## Tests

- `lib/form-context-tips.ts` : `resolveTips` (always / field-checked / section / aucun match →
  vide), `parseFormContextTips` (JSON partiel/corrompu → défauts). Vitest, module pur.
- Validation : `pnpm test`, `pnpm build` (typecheck), `pnpm i18n:check`, `pnpm lint`
  (ne pas ajouter d'erreur au ~74 pré-existantes).

## Risques & garde-fous

- **DB partagée Neon** : aucune migration (AppSetting existe déjà). Jamais `db push`.
- **Layout global** : l'inversion `FormShell` touche tous les PDF forms — vérifier visuellement
  un formulaire simple + le C1 (desktop + mobile).
- **Deux sites de rendu** du panneau : ne pas en oublier un (RunnerBody + MacroRunnerBody).
- **Repli systématique** : panneau jamais vide (défauts purs → section-help → contact).
- **Workdir partagé multi-agents** : `git add` de chemins explicites uniquement.
