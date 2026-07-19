# Refonte parcours citoyen « Mes démarches » — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline, autonome) ou superpowers:subagent-driven-development pour implémenter ce plan tâche par tâche. Steps en syntaxe checkbox (`- [ ]`).

**Goal:** Un seul fil pour le citoyen, du premier clic au PDF signé : réparer les liens qui perdent le contexte, fixer le vocabulaire (« démarche », vouvoiement), donner un espace transversal `/mes-demarches`, poser un rail de progression permanent sur `/d/[slug]` + `/document`, et fusionner les 3 hubs d'entrée en un guichet.

**Architecture:** Zéro migration DB. `?bundleRun=<id>` reste le paramètre canonique (déjà threadé) — on répare les endroits qui le perdent. Le rail dérive son modèle de `computeItemStatuses` (la MÊME source que le verrou serveur 409). `/mes-demarches` réutilise `buildDemandeSummaries` + le pattern ownership de `/d/[slug]`. Le guichet réutilise l'arbre Decision Builder + le cookie `beldoc-orientation`.

**Tech Stack:** Next.js 16 (App Router, server components), React 19, Prisma 5, next-intl 4, vitest, Tailwind 4 + glass mauve public.

**Contexte :** diagnostic complet et maquettes des 3 concepts dans l'artifact
<https://claude.ai/code/artifact/1b2dba28-29d7-4c30-a3bd-5e0f05dd35f2> (plan graphique du 19/07/2026).

## Global Constraints

### Décisions produit actées (Oraliks, 19/07/2026) — non négociables
1. **Registre : « vous » partout côté public.** Plus aucun tutoiement dans le funnel citoyen.
2. **Téléchargement : tout-ou-rien CONSERVÉ.** Aucun PDF tant que tout le requis (compagnons déclenchés inclus) n'est pas complété — un dossier incomplet peut nuire aux revenus. En contrepartie, le verrou est **annoncé** dans l'UI (rail, étape 3 🔒), plus jamais découvert via un 409.
3. **Parcours citoyen 100 % anonyme.** La connexion sera interdite aux citoyens (les comptes restent pour partenaire/employeur/admin). Continuité = cookie `beldoc-bundle-session` (30 j) + code de reprise (30 j) + envoi email du code. Ne JAMAIS construire de dépendance à une session citoyen, ni proposer « connectez-vous pour sauvegarder ».
4. **Vocabulaire :** « **Dossier** » = le modèle du catalogue · « **Démarche** » = l'instance de l'utilisateur (BundleRun) — remplace « demande » comme nom d'objet UI (« Mes démarches », « Nouvelle démarche », « Démarche n°2 ») · « **Document** » = un PDF. « demande » ne subsiste que dans les intitulés officiels (« Demande d'allocations »). Header : « Démarches » (catalogue, URL `/mon-dossier` inchangée) + « Mes démarches » (`/mes-demarches`).

### Contraintes techniques
- Validation : `pnpm test` (vitest) · `pnpm build` (build+typecheck, PAS de `pnpm typecheck`) · `pnpm i18n:check` · `pnpm lint` (~74 erreurs PRÉ-EXISTANTES, ne pas en ajouter).
- Front glass mauve : jamais `bg-white`/`#FFFFFF` en dur ; `.glass-surface` / tokens `--glass-*` / helpers `lib/glass-classes.ts` ; pas de `max-w-*` sur la racine d'une page front.
- i18n : textes user-facing via `useTranslations` (namespaces `public.dossier`, `public.contenu`, `public.chrome`) ; `messages/fr.json` est en **CRLF avec doublons** → insertions/remplacements SURGICAUX (Edit ciblé, jamais réécrire le fichier). Clés absentes des autres locales = avertissement + fallback FR (signaler aux traducteurs : registre « u » attendu en NL).
- `git add` de chemins EXPLICITES uniquement (workdir partagé multi-agents) ; commit à chaque tâche ; **jamais push** (Oraliks pousse main).
- Aucune migration DB. Ownership partout : jamais lire/écrire le run d'un autre (sessionId cookie ; garde userId conservée pour le legacy).
- ESLint refuse `setState` synchrone dans un `useEffect` → privilégier l'init lazy de `useState`.
- Les numéros de ligne cités datent du 19/07/2026 : si un fichier a bougé, retrouver le bloc par son contenu (les extraits « avant » sont exacts).

### Ordre d'exécution
**Lot 0 → Lot 1 → Lot 3 → Lot 2 → Lot 4.** Le Lot 3 (`/mes-demarches`) passe AVANT le Lot 2 (rail) parce que le rail contient un lien « Mes démarches » qui doit exister. Chaque lot = une série de commits indépendante ; s'arrêter en fin de lot est toujours un état livrable.

---

# Lot 0 — Quick wins : réparer les fils cassés (sans refonte)

### Task 0.1: Le code de reprise ouvre la démarche du code, pas « la plus récente »

**Files:**
- Modify: `components/docbel/onboarding/resume-form.tsx` (l.58-61)

**Interfaces:**
- Consumes: `POST /api/bundles/resume` renvoie déjà `runId` (vérifié `app/api/bundles/resume/route.ts` l.136).
- Produces: navigation `/d/{slug}?bundleRun={runId}&demarrer=1` (même forme que la bande de reprise home).

- [ ] **Step 1 — Corriger le typage de la réponse et l'URL.** Avant (l.58-61) :
```ts
      const data = (await res.json()) as { bundleSlug: string; bundleName: string };
      toast.success(t("resumeSuccess", { name: data.bundleName }));
      // Reprise par code → ouverture directe du formulaire actif (`?demarrer=1`).
      router.push(`/d/${data.bundleSlug}?demarrer=1`);
```
Après :
```ts
      const data = (await res.json()) as { runId: string; bundleSlug: string; bundleName: string };
      toast.success(t("resumeSuccess", { name: data.bundleName }));
      // Reprise par code → ouverture directe de LA démarche du code (`bundleRun`),
      // pas de la plus récente : en multi-démarche, /d/[slug] ouvrirait sinon
      // runsWithProgress[0].
      router.push(
        `/d/${data.bundleSlug}?bundleRun=${encodeURIComponent(data.runId)}&demarrer=1`,
      );
```
- [ ] **Step 2 — Validation** : `pnpm build` → exit 0. Écran : `/reprendre`, saisir un code valide d'un dossier qui a 2 démarches → on atterrit sur la démarche DU code (vérifier `?bundleRun=` dans l'URL).
- [ ] **Step 3 — Commit** : `git add components/docbel/onboarding/resume-form.tsx` → `fix(dossier): la reprise par code cible la demarche du code (bundleRun)`

---

### Task 0.2: Les retours du formulaire conservent la démarche (`bundleRun`)

**Files:**
- Modify: `components/pdf-forms/pdf-form-runner.tsx` (l.629 et l.733)

**Interfaces:**
- Consumes: `bundleRunId` et `bundleSlug`, déjà en scope dans `PdfFormRunner` (props, l.145).

- [ ] **Step 1 — Retour après sauvegarde.** Avant (l.629) :
```ts
          if (bundleSlug) router.push(`/d/${bundleSlug}`);
```
Après :
```ts
          if (bundleSlug)
            router.push(
              bundleRunId
                ? `/d/${bundleSlug}?bundleRun=${encodeURIComponent(bundleRunId)}`
                : `/d/${bundleSlug}`,
            );
```
- [ ] **Step 2 — Boutons de la carte de continuation.** Avant (l.733) :
```ts
    const goDossier = () => { if (bundleSlug) router.push(`/d/${bundleSlug}`); };
```
Après :
```ts
    const goDossier = () => {
      if (!bundleSlug) return;
      router.push(
        bundleRunId
          ? `/d/${bundleSlug}?bundleRun=${encodeURIComponent(bundleRunId)}`
          : `/d/${bundleSlug}`,
      );
    };
```
- [ ] **Step 3 — Validation** : `pnpm build` → exit 0. Écran : dossier avec 2 démarches → valider un document → « Revenir à mon dossier » ramène sur LA démarche en cours (liste de SES documents), pas sur l'écran « Mes demandes ».
- [ ] **Step 4 — Commit** : `git add components/pdf-forms/pdf-form-runner.tsx` → `fix(dossier): les retours du runner conservent bundleRun (multi-demarche)`

---

### Task 0.3: Le lien de repli de l'auto-ouverture conserve la démarche

**Files:**
- Modify: `components/docbel/bundle-runner.tsx` (l.352-362, placeholder `canAutoForward`)

- [ ] **Step 1 — Corriger le href.** Avant (l.358) :
```tsx
        <a
          href={`/d/${bundle.slug}`}
```
Après :
```tsx
        <a
          href={
            runId
              ? `/d/${bundle.slug}?bundleRun=${encodeURIComponent(runId)}`
              : `/d/${bundle.slug}`
          }
```
(`runId` est une prop de `BundleRunner`, déjà utilisée l.427.)
- [ ] **Step 2 — Validation** : `pnpm build` → exit 0.
- [ ] **Step 3 — Commit** : `git add components/docbel/bundle-runner.tsx` → `fix(dossier): le repli d'auto-ouverture conserve bundleRun`

---

### Task 0.4: Le header s'allume sur tout le funnel

**Files:**
- Modify: `components/docbel/landing/header.tsx` (fonction `resolveActiveNav`, l.89-100)

- [ ] **Step 1 — Ajouter les alias de routes du funnel.** Avant (l.89-99) :
```ts
function resolveActiveNav(
  pathname: string,
): (typeof NAV_ITEMS)[number]["id"] | null {
  const match = [...NAV_ITEMS]
    .filter((item) => {
      if (item.href === "#") return false;
      if (item.href === "/") return pathname === "/";
      return pathname.startsWith(item.href);
    })
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.id ?? null;
}
```
Après :
```ts
/// Routes du funnel dossier qui n'ont pas d'item de nav propre : elles
/// allument « Démarches » (id "mon-dossier") pour garder le repère
/// « où suis-je » pendant tout le parcours.
const DOSSIER_FUNNEL_PREFIXES = [
  "/d/",
  "/d",
  "/document/",
  "/reprendre",
  "/creer-ma-demande",
  "/mes-demarches",
] as const;

function resolveActiveNav(
  pathname: string,
): (typeof NAV_ITEMS)[number]["id"] | null {
  if (
    DOSSIER_FUNNEL_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(p.endsWith("/") ? p : `${p}/`) || pathname === p.replace(/\/$/, ""),
    )
  ) {
    return "mon-dossier";
  }
  const match = [...NAV_ITEMS]
    .filter((item) => {
      if (item.href === "#") return false;
      if (item.href === "/") return pathname === "/";
      return pathname.startsWith(item.href);
    })
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.id ?? null;
}
```
- [ ] **Step 2 — Validation** : `pnpm build` → exit 0. Écrans : sur `/d/allocations-insertion`, `/document/onem/c1`, `/reprendre` → l'entrée « Mon dossier » (bientôt « Démarches ») est surlignée dans le header desktop ET la sheet mobile.
- [ ] **Step 3 — Commit** : `git add components/docbel/landing/header.tsx` → `fix(nav): etat actif du header sur tout le funnel dossier`

---

### Task 0.5: « Où en est ma demande ? » répond sur place

**Files:**
- Modify: `app/mon-dossier/mon-dossier-client.tsx` (l.628 + section « Dossier en cours »)

- [ ] **Step 1 — Poser une ancre sur la section « Dossier en cours ».** Localiser la section qui rend les `ActiveRunCard` (titre `t("activeRunsTitle")` ou équivalent — grep `ActiveRunCard` dans le fichier) et ajouter `id="dossier-en-cours"` sur son élément `<section>`.
- [ ] **Step 2 — Recibler la help-row.** Avant (l.628) :
```tsx
        <HelpRow icon={RotateCcw} label={t("helpWhereIsRequest")} href="/reprendre" />
```
Après :
```tsx
        <HelpRow icon={RotateCcw} label={t("helpWhereIsRequest")} href="#dossier-en-cours" />
```
(La réponse — la liste des démarches en cours — est déjà affichée en haut de la même page ; `/reprendre` reste accessible pour le cross-device via le Lot 3.)
- [ ] **Step 3 — Validation** : `pnpm build` → exit 0. Écran : `/mon-dossier`, clic sur « Où en est ma demande ? » → scroll vers la section du haut.
- [ ] **Step 4 — Commit** : `git add app/mon-dossier/mon-dossier-client.tsx` → `fix(dossier): "Ou en est ma demande" scrolle vers les demarches en cours`

---

### Task 0.6: Cliquer une situation la présélectionne vraiment (`?situation=`)

**Files:**
- Modify: `components/docbel/landing/wizard-teaser.tsx` (l.99-105, tuiles situations)
- Modify: `app/mon-dossier/page.tsx` (l.143-150, rendu `MonDossierClient`)
- Modify: `app/mon-dossier/mon-dossier-client.tsx` (Props l.60, l.285-291, raccourcis « L'assistant dossier »)
- Modify: `components/docbel/onboarding/dossier-wizard.tsx` (Props l.143-146, init l.171-187)

**Interfaces:**
- Produces: `DossierWizard` accepte `initialSituation?: string` (valeur `WizardSituation.value`) ; `MonDossierClient` accepte `initialSituation?: string | null` ; les tuiles home émettent `/mon-dossier?situation=<value>`.

- [ ] **Step 1 — Tuiles home.** Dans `wizard-teaser.tsx` (l.101), remplacer `href="/mon-dossier"` de la carte situation par :
```tsx
              href={`/mon-dossier?situation=${encodeURIComponent(situation.value)}`}
```
(la 8ᵉ tuile « Commencer le guide » l.128 reste `/mon-dossier`). Mettre à jour le commentaire d'en-tête du fichier (l.3-9) qui documente l'absence de présélection.
- [ ] **Step 2 — `page.tsx` : lire le searchParam.** La page est un server component Next 16 : ajouter `searchParams` à la signature (`{ searchParams }: { searchParams: Promise<{ situation?: string }> }`), `const { situation } = await searchParams;` puis passer `initialSituation={situation ?? null}` à `<MonDossierClient …/>`.
- [ ] **Step 3 — `mon-dossier-client.tsx` : ouvrir le guide présélectionné.** Ajouter `initialSituation?: string | null` à `Props` (l.60). Dans le composant (l.285-291), initialiser en lazy (PAS de setState dans un effect — ESLint) :
```ts
  const validInitialSituation =
    initialSituation && situations.some((s) => s.value === initialSituation)
      ? initialSituation
      : null;
  const [guideStarted, setGuideStarted] = useState(Boolean(validInitialSituation));
```
(`mode` garde son init actuelle — seul `guideStarted` démarre à `true` quand une situation est présélectionnée.)
```ts
```
(conserver la valeur par défaut existante de `mode` si elle diffère — seul `guideStarted` doit passer à `true`). Passer `initialSituation={validInitialSituation ?? undefined}` au `<DossierWizard …/>`. Les 4 raccourcis « L'assistant dossier » (onClick `setMode("guide"); setGuideStarted(true)`) doivent en plus mémoriser la situation cliquée : ajouter un state `const [presetSituation, setPresetSituation] = useState<string | null>(validInitialSituation);` consommé par le wizard (`initialSituation={presetSituation ?? undefined}`), et chaque raccourci fait `setPresetSituation(s.value)` avant d'ouvrir le guide. ⚠ Pour que le wizard re-monte avec la nouvelle présélection, lui donner `key={presetSituation ?? "none"}`.
- [ ] **Step 4 — `dossier-wizard.tsx` : consommer la présélection.** Ajouter `initialSituation?: string;` à `Props` (l.143-146) et à la destructuration (l.171). Initialiser en lazy :
```ts
  const preset = initialSituation
    ? situations.find((s) => s.value === initialSituation) ?? null
    : null;
  const [selectedSituation, setSelectedSituation] = useState<string | null>(
    preset ? preset.value : null,
  );
  const [currentStep, setCurrentStep] = useState<StepNumber>(preset ? 2 : 1);
```
⚠ Adapter à la forme réelle des states existants (l.174 : `currentStep` existe déjà ; `selectedSituation` est déclaré plus bas — déplacer/fusionner sans dupliquer). Si la situation présélectionnée n'a PAS de `subQuestion`, démarrer à l'étape du résultat comme le fait `handleSituationSelect` (l.203-224 — reprendre sa logique de saut, sans l'appel analytics `wizard_started` doublé).
- [ ] **Step 5 — Validation** : `pnpm build` → exit 0 ; `pnpm test` → verts. Écrans : home → clic « J'ai perdu mon emploi » → `/mon-dossier?situation=…`, le wizard est OUVERT à l'étape 2 avec la situation déjà choisie (plus de « Quelle est votre situation ? » redondant) ; `/mon-dossier` nu → comportement inchangé ; raccourci « L'assistant dossier » → idem présélection.
- [ ] **Step 6 — Commit** : `git add components/docbel/landing/wizard-teaser.tsx app/mon-dossier/page.tsx app/mon-dossier/mon-dossier-client.tsx components/docbel/onboarding/dossier-wizard.tsx` → `feat(dossier): preselection de la situation cliquee (home + raccourcis) dans le wizard`

---

### Task 0.7: Abandonner / Recommencer — messages honnêtes et cohérents

**Files:**
- Modify: `components/docbel/demande-list.tsx` (l.53, l.59)
- Modify: `messages/fr.json` (namespace `public.dossier`, zone l.4779-4790)

- [ ] **Step 1 — Nouvelle clé d'erreur d'abandon** (Edit surgical fr.json) : après la ligne exacte `      "demandeNewError": "Impossible de créer une nouvelle demande.",` insérer :
```json
      "demandeAbandonError": "Impossible d'abandonner cette démarche. Réessayez.",
```
- [ ] **Step 2 — L'utiliser.** Dans `demande-list.tsx`, remplacer les DEUX `toast.error(t("demandeNewError"));` (l.53 et l.59) par `toast.error(t("demandeAbandonError"));` (l'échec d'une suppression n'affiche plus une erreur de création).
- [ ] **Step 3 — Textes cohérents avec la réalité (soft-delete, données conservées 60 j).** Remplacements exacts fr.json :
  - `"demandeAbandonConfirm": "Abandonner cette demande ? Elle disparaîtra de ta liste (les données sont conservées).",` → `"demandeAbandonConfirm": "Abandonner cette démarche ? Elle disparaîtra de votre liste. Vos données restent conservées 60 jours après votre dernière activité, puis sont anonymisées.",`
  - Localiser la clé du confirm « Recommencer » du BundleRunner (grep `runnerRestart` / `Recommencer` dans `bundle-runner.tsx` puis la clé dans fr.json) : si son texte affirme « Votre progression actuelle sera effacée » (ou tutoie), le remplacer par un texte alignant la même réalité : `"…": "Recommencer ce dossier ? Cette démarche sera abandonnée et une nouvelle liste de documents vierge vous sera proposée. Vos données restent conservées 60 jours, puis sont anonymisées."`
- [ ] **Step 4 — Validation** : `pnpm build` + `pnpm i18n:check` → exit 0. Écran : « Mes demandes » → Abandonner → confirm au nouveau texte ; couper le réseau → toast « Impossible d'abandonner… ».
- [ ] **Step 5 — Commit** : `git add components/docbel/demande-list.tsx messages/fr.json` → `fix(dossier): messages abandon/recommencer honnetes + erreur d'abandon dediee`

---

### Task 0.8: Un seul compteur de progression (items visibles partout)

**Files:**
- Modify: `app/d/[slug]/page.tsx` (les 2 appels `buildDemandeSummaries(…, bundle.items.length)`)

**Interfaces:**
- Consumes: `computeItemStatuses` (`@/components/docbel/bundle-runner/compute`) — le même calcul que le runner ; les intrants par run (`completedTemplateIds`, `payloads`, `applicableSlugs`) sont déjà chargés par la page.

- [ ] **Step 1 — Comprendre l'écart.** `buildDemandeSummaries(runs, total)` reçoit aujourd'hui `total = bundle.items.length` (tous les items, y compris masqués « non requis pour votre situation »), alors que le runner affiche « X sur N » avec N = items VISIBLES → la même démarche peut afficher 2/6 dans la liste et « 2 sur 3 » une fois ouverte.
- [ ] **Step 2 — Calculer un total par run.** Dans `app/d/[slug]/page.tsx`, pour chaque endroit qui construit des `DemandeSummary` (bloc `DemandeList` + `runnerProps.demandes` si le Lot 2 est passé), remplacer le `total` global par un total par run :
```ts
import { computeItemStatuses } from "@/components/docbel/bundle-runner/compute";

/// Total = documents remplissables VISIBLES pour CE run (même périmètre que
/// le compteur du runner) — pas bundle.items.length.
function visibleTotalForRun(run: {
  completedTemplateIds: string[];
  payloads: unknown;
}): number {
  const { visibleItems } = computeItemStatuses(
    serializedItems, // les items déjà sérialisés pour BundleRunner dans cette page
    run.completedTemplateIds,
    (run.payloads ?? {}) as Parameters<typeof computeItemStatuses>[2],
    applicableSlugs, // même dérivation que celle passée à runnerProps — la réutiliser
  );
  return visibleItems.filter((s) => s.item.pdfForm).length;
}
```
⚠ `buildDemandeSummaries` prend un total UNIQUE : soit le faire évoluer en `total: number | ((runId: string) => number)`, soit (plus simple, recommandé) appeler `buildDemandeSummaries` une fois par run avec son total et concaténer en préservant `index` (l'index est dérivé de l'ordre de création GLOBAL — le calculer d'abord sur la liste complète, puis mapper). Lire `lib/bundles/demande-summary.ts` (55 lignes) avant de choisir ; adapter le test existant `lib/bundles/__tests__/demande-summary.test.ts` s'il existe (grep).
- [ ] **Step 3 — Validation** : `pnpm test` → verts ; `pnpm build` → exit 0. Écran : dossier avec items conditionnels (allocations-insertion) et 2 démarches → le x/y de « Mes demandes » = le « X sur N » du runner pour chaque démarche.
- [ ] **Step 4 — Commit** : `git add "app/d/[slug]/page.tsx" lib/bundles/demande-summary.ts` (+ test modifié) → `fix(dossier): compteur de progression aligne sur les documents visibles`

---

### Task 0.9: L'écran de continuation dit TOUT ce qui reste

**Files:**
- Modify: `components/pdf-forms/pdf-form-runner.tsx` (carte de continuation, l.722-771)
- Modify: `messages/fr.json` (namespace du runner, zone `runnerContinuation*`)

- [ ] **Step 1 — Nouvelle clé** (insertion surgicale à côté des clés `runnerContinuation*` existantes — les localiser par grep `runnerContinuation` dans fr.json) :
```json
      "runnerContinuationRemainingCount": "Votre dossier nécessite encore {count, plural, one {1 document} other {# documents}} :",
```
- [ ] **Step 2 — Afficher le compte + la liste courte.** Dans la carte de continuation (l.722+), `continuation.missing` est la liste ORDONNÉE des manquants (`missing[0]` = prochain). Remplacer le texte qui n'affiche que `missing[0]` par : le libellé `runnerContinuationRemainingCount` avec `count: continuation.missing.length`, suivi des titres des 3 premiers manquants (`continuation.missing.slice(0, 3).map(m => m.title)` — vérifier la forme réelle des éléments de `missing` dans le state `continuation`, l.175-180) et « +N » au-delà. Le CTA « Continuer avec {titre} » (missing[0]) reste inchangé.
- [ ] **Step 3 — Validation** : `pnpm build` + `pnpm i18n:check` → exit 0. Écran : valider le 1er document d'un dossier à 3 documents → « Votre dossier nécessite encore 2 documents : … » avec les deux titres.
- [ ] **Step 4 — Commit** : `git add components/pdf-forms/pdf-form-runner.tsx messages/fr.json` → `feat(dossier): l'ecran de continuation liste tous les documents restants`

---

### Task 0.10: Liens fragiles — `/aidez-moi`, domaines en dur

**Files:**
- Modify: `app/document/[...path]/disabled-form-view.tsx` (l.49, l.59)
- Modify: `app/outils/bundles/[slug]/page.tsx` (l.12)
- Modify: `app/api/bundles/runs/[runId]/email-code/route.ts` (l.117)

- [ ] **Step 1 — `/aidez-moi` → `/contact`.** Les deux `<Link href="/aidez-moi">` (l.49 et l.59) → `href="/contact"` (`/aidez-moi` n'existe pas comme route `app/` — elle dépend d'une page page-builder en DB non garantie ; un utilisateur déjà bloqué ne doit pas tomber sur un 404).
- [ ] **Step 2 — Redirect relatif.** Dans `app/outils/bundles/[slug]/page.tsx` : `redirect("https://www.docbel.be/mon-dossier");` → `redirect("/mon-dossier");` (le domaine en dur casse staging/local).
- [ ] **Step 3 — Email du code : URL dérivée.** Dans `email-code/route.ts` (l.117), remplacer `` `https://beldoc.be/reprendre` `` par une base dérivée : chercher d'abord un helper/env existant (grep `NEXT_PUBLIC_APP_URL\|APP_URL\|baseUrl` dans `lib/` et les autres routes email, ex. `app/api/bundles/runs/[runId]/email/route.ts`) et réutiliser le même mécanisme ; à défaut :
```ts
const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.docbel.be";
// … `${baseUrl}/reprendre`
```
(⚠ ne pas committer de `.env` ; si la variable n'existe pas, la documenter dans README à côté des autres env.)
- [ ] **Step 4 — Validation** : `pnpm build` → exit 0. Écrans : formulaire désactivé → les 2 liens mènent à `/contact` ; `/outils/bundles/<slug>` en local → redirige vers le `/mon-dossier` local.
- [ ] **Step 5 — Commit** : `git add "app/document/[...path]/disabled-form-view.tsx" "app/outils/bundles/[slug]/page.tsx" "app/api/bundles/runs/[runId]/email-code/route.ts"` → `fix(dossier): liens aidez-moi -> contact, redirects et email sans domaine en dur`

---

### Task 0.11: Fin du double brouillon en contexte dossier

**Files:**
- Modify: `components/pdf-forms/pdf-form-runner.tsx` (bloc GET draft au montage, l.250-278)

- [ ] **Step 1 — Ne plus fusionner le brouillon autonome par-dessus celui du dossier.** Le runner fait au montage un `fetch(\`/api/pdf/${form.slug}/draft\`)` (l.252) qui restaure le brouillon AUTONOME (`PdfFormDraft`, réservé aux connectés) PAR-DESSUS les `draftValues` du dossier injectées côté serveur — un vieux brouillon personnel peut écraser silencieusement les réponses du dossier. Le parcours citoyen étant anonyme (décision n°3), ce chemin est mort pour les citoyens et dangereux pour un compte de test : encapsuler tout le bloc dans un garde :
```ts
    // Brouillon autonome (PdfFormDraft, connectés) : UNIQUEMENT hors dossier.
    // En contexte dossier, la vérité est BundleRun.draftPayloads, déjà
    // restaurée côté serveur (draftValues) — ne jamais fusionner par-dessus.
    if (bundleRunId) return;
```
placé en tête de l'effect/du callback qui fait ce fetch (adapter à la forme réelle du bloc l.250-278 : si c'est un `useEffect`, early-return avant le fetch ; conserver le comportement autonome inchangé).
- [ ] **Step 2 — Validation** : `pnpm build` → exit 0 ; `pnpm test` → verts. Écran : ouvrir un document DANS un dossier après avoir laissé un brouillon autonome du même formulaire (compte admin) → les réponses du dossier ne sont plus écrasées, plus de toast « Brouillon restauré » en contexte dossier.
- [ ] **Step 3 — Commit** : `git add components/pdf-forms/pdf-form-runner.tsx` → `fix(pdf-forms): pas de fusion du brouillon autonome en contexte dossier`

---

# Lot 1 — Vocabulaire, registre « vous », navigation

### Task 1.1: Sweep fr.json — vouvoiement + « demande » → « démarche » (funnel)

**Files:**
- Modify: `messages/fr.json` (namespaces `public.dossier` + zones runner de `public.contenu` — remplacements surgicaux un par un)

**Interfaces:**
- Produces: registre « vous » + vocabulaire « démarche » sur toutes les clés du funnel. ⚠ Les Lots 2/3/4 citent certains anciens textes en `old_string` : ce lot passe AVANT — leurs steps « déjà traité au Lot 1 » le signalent.

- [ ] **Step 1 — Régénérer la liste exacte.** Lancer :
```bash
grep -n -E '"[^"]*": "[^"]*\b(tu|tes|ton|ta|toi|Tu |Reprends|démarres|Précise|Pense )\b' messages/fr.json
```
et traiter UNIQUEMENT les clés des namespaces publics du funnel (`public.dossier`, `public.contenu` zone runner, `public.chrome` si touché). Les zones admin (`admin.*`, back-office IA l.1291-2427) sont HORS périmètre. La zone bureaux/organismes (l.5612-6778, tutoiement massif) est traitée à part en Task 1.4.
- [ ] **Step 2 — Remplacements vérifiés au 19/07 (valeurs exactes, Edit surgical un par un) :**
  - l.4779 `"demandesSubtitle": "Reprends une demande existante ou démarres-en une nouvelle.",` → `"demandesSubtitle": "Reprenez une démarche existante ou démarrez-en une nouvelle.",`
  - l.4786 `demandeAbandonConfirm` — déjà traité en Task 0.7 (vérifier).
  - l.4789 `"demandeTooMany": "Tu as trop de demandes ouvertes pour ce dossier.",` → `"demandeTooMany": "Vous avez trop de démarches ouvertes pour ce dossier.",`
  - l.4790 `"demandeClonedNotice": "Cette demande reprend les infos de ta demande du {date}. Vérifie et modifie seulement ce qui a changé.",` → `"demandeClonedNotice": "Cette démarche reprend les informations de votre démarche du {date}. Vérifiez et modifiez uniquement ce qui a changé.",`
  - l.4938 `"runnerTriggeredBadge": "Suite à tes réponses",` → `"runnerTriggeredBadge": "Suite à vos réponses",`
  - l.4943 `"runnerExternalDocsNote": "Ces pièces sont obligatoires au dossier mais tu ne peux pas les remplir toi-même. Pense à les réclamer dès que possible.",` → `"runnerExternalDocsNote": "Ces pièces sont obligatoires au dossier mais vous ne pouvez pas les remplir vous-même. Pensez à les réclamer dès que possible.",`
  - l.5138 `"runnerGroupMotifDesc": "Précise l'objet de ta demande.",` → `"runnerGroupMotifDesc": "Précisez l'objet de votre demande."` (« demande » reste : c'est la demande officielle ONEM)
  - l.5140 `"runnerGroupActivitesRevenusDesc": "Détails sur tes ressources.",` → `"…": "Détails sur vos ressources.",`
  - l.5141 `"runnerGroupFamilleDesc": "Informations sur ton foyer.",` → `"…": "Informations sur votre foyer.",`
  - l.5189 `"runnerResetDesc": "Toutes tes réponses seront effacées et le brouillon supprimé. Cette action est irréversible.",` → `"…": "Toutes vos réponses seront effacées et le brouillon supprimé. Cette action est irréversible.",`
  - l.4668 `"formDisabledReportLead": "Tu pensais pouvoir finir ta démarche maintenant ?",` → `"…": "Vous pensiez pouvoir finir votre démarche maintenant ?",`
  - l.3544 `"suggestionsLabel": "Tu cherchais peut-être",` → `"…": "Vous cherchiez peut-être",`
  - l.3549 `"tagline": "Si tu viens de perdre ton emploi ou que tu y émarges"` → `"tagline": "Si vous venez de perdre votre emploi ou que vous y émargez"`
  - Objet « demande » → « démarche » : `"demandeNew": "Nouvelle demande",` → `"Nouvelle démarche"` · `"demandeNewError"` → `"Impossible de créer une nouvelle démarche."` · clé de titre `"demandesTitle": "Mes demandes"` → `"Mes démarches"` · clé `"demandeLabel"`/« Demande n°{index} » → « Démarche n°{index} » (grep `Demande n°` pour le nom exact) · toute autre clé `demande*` de `public.dossier` affichant le MOT « demande » comme objet UI (grep `"demande` dans le namespace).
  - clé `"demandeDuplicate"` : `"Aucune différence avec une demande existante — on t'y redirige."` → `"Aucune différence avec une démarche existante — nous vous y redirigeons."` (le grep du Step 1 ne l'attrape pas : « t'y »)
  - Deux clés de reset dupliquées avec titres différents (« Recommencer ce parcours ? » ~l.4925 vs « Réinitialiser le formulaire ? » ~l.5186) : unifier les DEUX titres sur `"Recommencer ce formulaire ?"` et vérifier quels composants consomment chacune (grep les noms de clés) — ne supprimer AUCUNE clé (fallback des autres locales).
- [ ] **Step 3 — Validation** : `pnpm i18n:check` → exit 0 (ICU valide) ; `pnpm build` → exit 0 ; relancer le grep du Step 1 → plus aucune occurrence dans les namespaces du funnel. Noter dans le commit les clés changées de SENS (pour les traducteurs NL : registre « u »).
- [ ] **Step 4 — Commit** : `git add messages/fr.json` → `feat(i18n): vouvoiement + vocabulaire demarche sur le funnel dossier (FR)`

---

### Task 1.2: `AutoSaveNotice` — plus de français en dur

**Files:**
- Modify: `components/pdf-forms/auto-save-notice.tsx` (fichier court — textes en dur)
- Modify: `messages/fr.json` (nouvelles clés `public.contenu`)

- [ ] **Step 1 — Lire le composant** (il n'utilise PAS `useTranslations` aujourd'hui) et inventorier ses chaînes : « Vos réponses sont enregistrées automatiquement… (dernier enregistrement à HH:MM) — retrouvez votre code de reprise sur la page du dossier » et la variante anonyme autonome « Vos réponses restent sur cet appareil pendant la saisie et ne sont pas encore enregistrées ». ⚠ Décision n°3 : la variante anonyme ne doit PAS proposer de se connecter.
- [ ] **Step 2 — Clés** (insertion surgicale dans `public.contenu`, à côté des clés `runner*`) :
```json
      "autoSaveSaved": "Vos réponses sont enregistrées automatiquement{time, select, none {} other { (dernier enregistrement à {time})}}.",
      "autoSaveBundleHint": "Retrouvez votre code de reprise sur la page de votre démarche.",
      "autoSaveLocalOnly": "Vos réponses restent sur cet appareil pendant la saisie et ne sont pas encore enregistrées.",
```
(adapter le param `time` à la forme réelle du composant — s'il formate déjà l'heure, passer la chaîne formatée.)
- [ ] **Step 3 — Brancher `useTranslations("public.contenu")`** dans le composant, supprimer les littéraux.
- [ ] **Step 4 — Validation** : `pnpm build` + `pnpm i18n:check` → exit 0. Écran : formulaire en dossier → notice traduite (et passage NL : fallback FR sans crash ICU).
- [ ] **Step 5 — Commit** : `git add components/pdf-forms/auto-save-notice.tsx messages/fr.json` → `fix(i18n): AutoSaveNotice via next-intl (plus de FR en dur)`

---

### Task 1.3: Header « Démarches » + breadcrumbs cohérents

**Files:**
- Modify: `messages/fr.json` (`public.chrome.navMyDossier` + clés breadcrumb)

- [ ] **Step 1 — Renommer l'entrée de nav.** Remplacement exact : la valeur de `"navMyDossier"` (namespace `public.chrome`) passe de `"Mon dossier"` à `"Démarches"` (l'URL `/mon-dossier` ne change PAS — zéro churn SEO ; l'id d'item `"mon-dossier"` du header non plus).
- [ ] **Step 2 — Breadcrumbs.** `/d/[slug]` et `/document` affichent un segment « Mon dossier » pointant vers `/mon-dossier` (catalogue) : grep la/les clés (`breadcrumb` dans `app/d/[slug]/page.tsx` et `components/pdf-forms/document-page-layout.tsx`, puis fr.json) et aligner leur valeur sur `"Démarches"`. Ne PAS toucher à la cible du lien ici (le breadcrumb de `/document` en contexte dossier pointe déjà vers `/d/{bundleSlug}` — correct).
- [ ] **Step 3 — Validation** : `pnpm build` + `pnpm i18n:check` → exit 0. Écrans : header desktop/mobile (« Démarches »), breadcrumb de `/d/…` et `/document/…`.
- [ ] **Step 4 — Commit** : `git add messages/fr.json` → `feat(nav): l'entree catalogue devient "Demarches" (URL inchangee)`

---

### Task 1.4: Zone bureaux/organismes — vouvoiement (public, hors funnel)

**Files:**
- Modify: `messages/fr.json` (zone l.5612-6778 : `bureauxIntro`, `geoloc*`, `loader*`, `oph*`, `htEmpty*`, `bcDistanceFromYou`, `infoBandWhyBody`…)

- [ ] **Step 1 — Sweep dédié.** Même méthode que Task 1.1 Step 1, restreinte à cette zone (≈ 25 clés tutoyées vérifiées au grep du 19/07). Exemples de conversion : `"bureauxIntro": "Indique ton code postal — on te dit immédiatement…"` → `"Indiquez votre code postal — on vous dit immédiatement…"` ; `"ophUnknownTitle": "Tu ne sais pas si tu es déjà affilié ?"` → `"Vous ne savez pas si vous êtes déjà affilié ?"` ; garder le ton chaleureux, seulement changer le registre.
- [ ] **Step 2 — Validation** : `pnpm i18n:check` + `pnpm build` → exit 0 ; re-grep → zéro tutoiement restant dans la zone.
- [ ] **Step 3 — Commit** : `git add messages/fr.json` → `feat(i18n): vouvoiement zone bureaux/organismes (FR)`

---

### Task 1.5: Anonyme only — retirer le nudge « Complète ton profil » du runner

**Files:**
- Modify: `app/document/[...path]/page.tsx` OU le composant qui rend la bannière (grep `profileNudge` dans `app/` et `components/`)

- [ ] **Step 1 — Localiser et retirer.** La bannière « Complète ton profil — pour préremplir tes documents automatiquement » (clés `profileNudgeTitle`/`profileNudgeText`, fr.json l.4661-4662) ne s'affiche que pour un utilisateur CONNECTÉ au profil incomplet. Décision n°3 : les citoyens ne se connectent plus → la bannière ne sert que les comptes pro/admin qui testent, et les pousse vers `/profil` en pleine saisie (risque de perte). Retirer le rendu de la bannière du parcours `/document` (garder les clés fr.json — ne jamais supprimer de clés).
- [ ] **Step 2 — Validation** : `pnpm build` → exit 0. Écran : `/document/onem/c1` connecté avec profil vide → plus de bannière.
- [ ] **Step 3 — Commit** : `git add <fichier(s) localisés>` → `chore(dossier): retrait du nudge profil (parcours citoyen anonyme)`

---

# Lot 3 — `/mes-demarches` : l'espace personnel transversal (anonyme)

> Exécuté AVANT le Lot 2 : le rail du Lot 2 pointe vers `/mes-demarches`.

### Task 3.1: Loader serveur `loadMesDemarches` (pur + requête)

**Files:**
- Create: `lib/bundles/mes-demarches.ts`
- Test: `lib/bundles/__tests__/mes-demarches.test.ts`

**Interfaces:**
- Consumes: `prisma` (`@/lib/prisma` — vérifier le chemin d'import utilisé par `lib/bundles/completion.ts`), `EDITABLE_BUNDLE_RUN_STATUSES` + `deriveBundleRunLifecycle` (`@/lib/bundles/run-lifecycle`), `bundleRunHasProgress` (`@/lib/bundles/run-progress`), `buildDemandeSummaries` (`@/lib/bundles/demande-summary`).
- Produces:
```ts
export interface MesDemarchesGroup {
  bundle: { id: string; slug: string; name: string; icon: string | null; color: string | null };
  demarches: DemandeSummary[]; // du plus récent au plus ancien
}
export function groupRunsForMesDemarches(runs: MesDemarchesRunInput[]): MesDemarchesGroup[]; // PURE, testée
export async function loadMesDemarches(owner: { userId: string | null; sessionId: string | null }): Promise<MesDemarchesGroup[]>;
```

- [ ] **Step 1 — Test de la fonction PURE `groupRunsForMesDemarches`** : runs de 2 bundles mélangés → 2 groupes ordonnés par activité récente (`updatedAt` max du groupe), runs sans progression exclus (`bundleRunHasProgress`), summaries via `buildDemandeSummaries` par bundle (total par run si la Task 0.8 a fait évoluer la signature — reprendre la même forme). Écrire le test AVANT (modèle : `lib/bundles/__tests__/run-progress.test.ts`).
- [ ] **Step 2 — Implémentation.** `loadMesDemarches` : si `userId` ET `sessionId` sont null → `[]`. Sinon `prisma.bundleRun.findMany({ where: { status: { in: EDITABLE_BUNDLE_RUN_STATUSES }, OR: [ userId ? { userId } : undefined, sessionId ? { sessionId } : undefined ].filter(Boolean) }, include: { bundle: { select: { id, slug, name, icon, color, active } } }, orderBy: { updatedAt: "desc" }, take: 100 })` — ⚠ reprendre la résolution d'ownership EXACTE de `app/d/[slug]/page.tsx` (l.101-110 : userId-first) et exclure les bundles `active: false`. Puis `groupRunsForMesDemarches`.
- [ ] **Step 3 — Run** : `pnpm vitest run lib/bundles/__tests__/mes-demarches.test.ts` → PASS.
- [ ] **Step 4 — Commit** : `git add lib/bundles/mes-demarches.ts lib/bundles/__tests__/mes-demarches.test.ts` → `feat(bundles): loader transversal loadMesDemarches (anonyme, cross-dossier)`

---

### Task 3.2: La page `/mes-demarches` (glass, force-dynamic)

**Files:**
- Create: `app/mes-demarches/page.tsx` (server component)
- Create: `components/docbel/mes-demarches-client.tsx` (client)
- Modify: `messages/fr.json` (nouvelles clés `public.dossier`)

**Interfaces:**
- Consumes: `loadMesDemarches` (Task 3.1) ; la résolution session/cookie de `/d/[slug]` (reprendre le même code : `auth.api.getSession` + cookie `beldoc-bundle-session` — copier le bloc l.90-110 de `app/d/[slug]/page.tsx`) ; `ResumeForm` (`components/docbel/onboarding/resume-form.tsx`) réutilisé tel quel pour le bloc « Sur un autre appareil ? ».
- Produces: la route `/mes-demarches` (cible du header, du rail Lot 2, des teasers Task 3.3).

- [ ] **Step 1 — `page.tsx`.** `export const dynamic = "force-dynamic";` ; résoudre `{ userId, sessionId }` comme `/d/[slug]` ; `const groups = await loadMesDemarches({ userId, sessionId });` ; rendre `<MesDemarchesClient groups={…} />` avec les groupes sérialisés. `generateMetadata` : titre « Mes démarches » (clés i18n, modèle `app/mon-dossier/page.tsx` l.19-24).
- [ ] **Step 2 — `mes-demarches-client.tsx`.** Racine `<section className="flex w-full flex-col gap-6">` (patron `/mon-dossier`, PAS de max-w). Contenu :
  - En-tête : h1 « Mes démarches » (style `glass-display`, accent italique) + sous-titre « Tout ce que vous avez commencé, sur une seule page. » + bouton « Nouvelle démarche » → `/mon-dossier`.
  - Par groupe : carte `.glass-surface` avec nom du dossier, puis chaque démarche sur une ligne (réutiliser la grammaire visuelle de `components/docbel/demande-list.tsx` — l'IMPORTER/factoriser si simple, sinon dupliquer la ligne en composant local `DemarcheRow`) : « Démarche n°{index} · démarrée le {date} », barre + « {completed}/{total} documents », pill d'état (`lifecycle === "completed_editable"` → « Complète », sinon « En cours »), actions : **Reprendre/Revoir** → `/d/{slug}?bundleRun={runId}&demarrer=1`, **Récupérer mes documents** (si complète) → `/d/{slug}?bundleRun={runId}#recuperer-envoyer`, **Abandonner** (poubelle, même confirm + DELETE que `demande-list.tsx`).
  - Bloc « Sur un autre appareil ? » : carte glass avec le `ResumeForm` (saisie de code) + rappel « Votre code de reprise vous a été montré à la création de la démarche — il reste valable 30 jours. ».
  - Mention rétention (petit texte) : « Vos réponses sont conservées 60 jours après votre dernière activité, puis anonymisées. » (valeurs à re-vérifier dans `lib/bundles/retention.ts` : draft 7 j / anonymisation 60 j / suppression 180 j).
  - Empty state : « Vous n'avez aucune démarche en cours. » + CTA « Trouver le bon dossier » → `/mon-dossier`.
- [ ] **Step 3 — Clés i18n FR** (insertion surgicale `public.dossier`, vouvoiement) :
```json
      "mesDemarchesTitle": "Mes démarches",
      "mesDemarchesMetaTitle": "Mes démarches — Docbel",
      "mesDemarchesSubtitle": "Tout ce que vous avez commencé, sur une seule page — reprendre, vérifier, récupérer.",
      "mesDemarchesRetrieve": "Récupérer mes documents",
      "mesDemarchesOtherDevice": "Sur un autre appareil ?",
      "mesDemarchesCodeHint": "Votre code de reprise vous a été montré à la création de la démarche — il reste valable 30 jours.",
      "mesDemarchesRetention": "Vos réponses sont conservées 60 jours après votre dernière activité, puis anonymisées.",
      "mesDemarchesEmpty": "Vous n'avez aucune démarche en cours.",
      "mesDemarchesEmptyCta": "Trouver le bon dossier",
```
- [ ] **Step 4 — Validation** : `pnpm build` + `pnpm i18n:check` → exit 0 ; `pnpm test` → verts. Écrans : `/mes-demarches` avec 2 démarches sur 2 dossiers différents (cookie anonyme) → 2 groupes, actions correctes ; navigation privée → empty state ; mobile → rien de collé aux bords.
- [ ] **Step 5 — Commit** : `git add app/mes-demarches/page.tsx components/docbel/mes-demarches-client.tsx messages/fr.json` → `feat(dossier): espace transversal /mes-demarches (anonyme)`

---

### Task 3.3: Câbler les entrées — header, palette, teasers, `/d`

**Files:**
- Modify: `components/docbel/landing/header.tsx` (NAV_ITEMS l.67-70)
- Modify: `components/docbel/landing/command-palette.tsx` (raccourcis)
- Modify: `app/mon-dossier/mon-dossier-client.tsx` (section « Dossier en cours »)
- Modify: `components/docbel/landing/resume-strip.tsx` (lien secondaire)
- Modify: `app/d/page.tsx` (redirect)
- Modify: `messages/fr.json` (`public.chrome` : nouvelle clé nav)

- [ ] **Step 1 — Header.** Dans `NAV_ITEMS` (l.67-70), insérer après l'item `mon-dossier` :
```ts
  { id: "mes-demarches", tKey: "navMesDemarches", href: "/mes-demarches" },
```
+ clé fr.json `public.chrome` : `"navMesDemarches": "Mes démarches",`. ⚠ Retirer `"/mes-demarches"` de `DOSSIER_FUNNEL_PREFIXES` (Task 0.4) : la route a maintenant son item propre. Reporter le même item dans la sheet mobile si elle a sa propre liste (vérifier dans le fichier).
- [ ] **Step 2 — Palette ⌘K.** Dans `command-palette.tsx`, ajouter deux entrées à la liste des raccourcis de navigation (suivre la forme des entrées existantes « Mon dossier »/« Outils ») : « Mes démarches » → `/mes-demarches` et « Reprendre une démarche (code) » → `/reprendre` (clés i18n dans le namespace utilisé par la palette — le vérifier par grep).
- [ ] **Step 3 — Teasers.** Dans la section « Dossier en cours » de `/mon-dossier` (sous la liste des `ActiveRunCard`), ajouter un lien « Toutes mes démarches → » vers `/mes-demarches` ; dans `resume-strip.tsx` (bande home), ajouter le même lien discret sous le CTA « Reprendre ».
- [ ] **Step 4 — `/d`.** `app/d/page.tsx` : `redirect("/mon-dossier")` → `redirect("/mes-demarches")` (`/d` = « mes affaires », pas le catalogue).
- [ ] **Step 5 — Validation** : `pnpm build` + `pnpm i18n:check` → exit 0. Écrans : header (« Démarches » + « Mes démarches », états actifs corrects sur chacun), ⌘K, `/mon-dossier` (lien sous la section), home (bande), `/d` → `/mes-demarches`.
- [ ] **Step 6 — Commit** : `git add components/docbel/landing/header.tsx components/docbel/landing/command-palette.tsx app/mon-dossier/mon-dossier-client.tsx components/docbel/landing/resume-strip.tsx app/d/page.tsx messages/fr.json` → `feat(nav): entrees Mes demarches (header, palette, teasers, /d)`

---

# Lot 2 — Le rail de démarche partagé (`/d/[slug]` + `/document`)

> Rédigé sur lecture ligne à ligne du code le 19/07/2026. Prérequis : Lots 0, 1, 3 passés.
> Coordination fr.json : les clés `demandeNew`, `demandeNewError`, `demandeTooMany`,
> `demandeClonedNotice`, `runnerTriggeredBadge`, `runnerExternalDocsNote` sont DÉJÀ au bon
> registre/vocabulaire depuis le Lot 1 — les steps ci-dessous qui les mentionnent deviennent
> de simples vérifications.
> Décisions d'assemblage sur les questions ouvertes du rédacteur : le lien « Mes démarches »
> pointe `/mes-demarches` (existe depuis le Lot 3) ; le code de reprise reste affichable
> uniquement dans la session de création (pas de backend nouveau) ; le bouton « Recommencer »
> RESTE dans la colonne principale ; la double lecture `loadDossierState` sur `/document`
> est assumée (optimisation plus tard) ; le compteur DemandeSummary est déjà aligné (Task 0.8).

### Task 2.1: Modèle pur du rail de démarche (`lib/bundles/rail-model.ts`) + tests vitest

**Files:**
- Create `lib/bundles/rail-model.ts`
- Create `lib/bundles/__tests__/rail-model.test.ts`

**Interfaces:**
- Consumes : `computeItemStatuses`, `type BundleItem` (`@/components/docbel/bundle-runner/compute`) — même sens de dépendance que `lib/bundles/completion.ts` qui importe déjà ce module ; `type CollectedPayloads` (`@/lib/bundles/conditions`).
- Produces : `buildDemarcheRailModel(input: DemarcheRailInput): DemarcheRailModel` + types exportés `RailDoc`, `RailDocState`, `RailStepState`, `DemarcheRailModel`, `DemarcheRailInput`.

- [ ] **Step 1 — Créer `lib/bundles/rail-model.ts`** (fichier complet) :
```ts
/// Modèle PUR du rail de démarche (refonte parcours citoyen, Lot 2).
/// Dérive, depuis les mêmes données que le BundleRunner, les 3 grandes étapes
/// du rail (Ma situation / Les documents / Récupérer & envoyer) et la
/// sous-liste des documents avec leur état. Aucune dépendance React/DB.
///
/// IMPORTANT : `allRequiredDone` vient de `computeItemStatuses`, le MÊME calcul
/// que le verrou serveur 409 `dossier_incomplete` (cf. lib/bundles/completion.ts)
/// — le rail annonce donc exactement le verrou que l'API applique.

import {
  computeItemStatuses,
  type BundleItem,
} from "@/components/docbel/bundle-runner/compute";
import type { CollectedPayloads } from "@/lib/bundles/conditions";

export type RailDocState = "done" | "todo" | "pending";

export interface RailDoc {
  /// Clé stable d'affichage (item.id ; les compagnons déclenchés sont `triggered-<pdfFormId>`).
  key: string;
  slug: string;
  pdfFormId: string;
  title: string;
  state: RailDocState;
  required: boolean;
  triggered: boolean;
}

export type RailStepState = "done" | "current" | "upcoming" | "locked";

export interface DemarcheRailModel {
  /// Étape 1 — « Ma situation » (pré-qualification).
  situation: { state: RailStepState; hasQuestions: boolean };
  /// Étape 2 — « Les documents » : sous-liste + compteur (items VISIBLES
  /// remplissables par le citoyen, pdfForm non nul — même périmètre que le
  /// compteur du runner, PAS bundle.items.length comme DemandeList).
  documents: {
    state: RailStepState;
    docs: RailDoc[];
    completedCount: number;
    totalCount: number;
  };
  /// Étape 3 — « Récupérer & envoyer » : verrouillée tant que tout le requis
  /// (compagnons déclenchés inclus) n'est pas complété.
  retrieve: {
    state: RailStepState;
    /// N de l'annonce « vos PDF se déverrouillent quand les N documents… ».
    requiredCount: number;
    remainingCount: number;
  };
  allRequiredDone: boolean;
}

export interface DemarcheRailInput {
  items: BundleItem[];
  completedTemplateIds: string[];
  payloads: CollectedPayloads;
  applicableSlugs: string[] | null | undefined;
  hasEligibilityQuestions: boolean;
  eligibilityCompleted: boolean;
}

export function buildDemarcheRailModel(input: DemarcheRailInput): DemarcheRailModel {
  const { visibleItems, requiredVisible, allRequiredDone } = computeItemStatuses(
    input.items,
    input.completedTemplateIds,
    input.payloads,
    input.applicableSlugs,
  );

  const docs: RailDoc[] = visibleItems.flatMap((s) =>
    s.item.pdfForm
      ? [
          {
            key: s.item.id,
            slug: s.item.pdfForm.slug,
            pdfFormId: s.item.pdfForm.id,
            title: s.item.pdfForm.title,
            state: (s.completed
              ? "done"
              : s.eligibility === "pending"
                ? "pending"
                : "todo") as RailDocState,
            required: s.item.required,
            triggered: s.item.triggered === true,
          },
        ]
      : [],
  );

  const completedCount = docs.filter((d) => d.state === "done").length;
  const requiredCount = requiredVisible.length;
  const remainingCount = requiredVisible.filter((s) => !s.completed).length;

  const situationState: RailStepState = input.hasEligibilityQuestions
    ? input.eligibilityCompleted
      ? "done"
      : "current"
    : "done";
  const documentsState: RailStepState = allRequiredDone
    ? "done"
    : situationState === "done"
      ? "current"
      : "upcoming";
  const retrieveState: RailStepState = allRequiredDone ? "current" : "locked";

  return {
    situation: { state: situationState, hasQuestions: input.hasEligibilityQuestions },
    documents: { state: documentsState, docs, completedCount, totalCount: docs.length },
    retrieve: { state: retrieveState, requiredCount, remainingCount },
    allRequiredDone,
  };
}
```
- [ ] **Step 2 — Créer `lib/bundles/__tests__/rail-model.test.ts`** en réutilisant le style du helper `item()` de `components/docbel/bundle-runner/__tests__/compute.test.ts` :
```ts
import { describe, it, expect } from "vitest";
import { buildDemarcheRailModel } from "../rail-model";
import type { BundleItem } from "@/components/docbel/bundle-runner/compute";

function item(p: { id: string; slug: string; required?: boolean; triggered?: boolean }): BundleItem {
  return {
    id: p.id,
    templateId: null,
    pdfFormId: p.id,
    order: 0,
    required: p.required ?? true,
    condition: null as unknown as BundleItem["condition"],
    template: null,
    triggered: p.triggered,
    pdfForm: { id: p.id, slug: p.slug, title: p.slug, description: null, issuer: null },
  };
}

const base = {
  payloads: {},
  applicableSlugs: null,
  hasEligibilityQuestions: true,
  eligibilityCompleted: true,
};

describe("buildDemarcheRailModel", () => {
  const items = [item({ id: "a", slug: "doc-a" }), item({ id: "b", slug: "doc-b", required: false })];

  it("étape 1 'current' tant que la pré-qualification n'est pas complète", () => {
    const m = buildDemarcheRailModel({ ...base, items, completedTemplateIds: [], eligibilityCompleted: false });
    expect(m.situation.state).toBe("current");
    expect(m.documents.state).toBe("upcoming");
    expect(m.retrieve.state).toBe("locked");
  });

  it("sans questions d'éligibilité, l'étape 1 est directement 'done'", () => {
    const m = buildDemarcheRailModel({ ...base, items, completedTemplateIds: [], hasEligibilityQuestions: false, eligibilityCompleted: false });
    expect(m.situation.state).toBe("done");
    expect(m.documents.state).toBe("current");
  });

  it("compteur = documents remplissables visibles, états done/todo", () => {
    const m = buildDemarcheRailModel({ ...base, items, completedTemplateIds: ["a"] });
    expect(m.documents.totalCount).toBe(2);
    expect(m.documents.completedCount).toBe(1);
    expect(m.documents.docs.map((d) => d.state)).toEqual(["done", "todo"]);
  });

  it("verrou : requiredCount/remainingCount comptent le requis, l'optionnel ne bloque pas", () => {
    const m = buildDemarcheRailModel({ ...base, items, completedTemplateIds: ["a"] });
    expect(m.retrieve.requiredCount).toBe(1);
    expect(m.retrieve.remainingCount).toBe(0);
    expect(m.retrieve.state).toBe("current");
    expect(m.allRequiredDone).toBe(true);
  });

  it("un compagnon déclenché non complété maintient le verrou (parité 409)", () => {
    const withCompanion = [...items, item({ id: "triggered-c", slug: "doc-c", triggered: true })];
    const m = buildDemarcheRailModel({ ...base, items: withCompanion, completedTemplateIds: ["a"] });
    expect(m.retrieve.state).toBe("locked");
    expect(m.retrieve.requiredCount).toBe(2);
    expect(m.retrieve.remainingCount).toBe(1);
    expect(m.documents.docs.find((d) => d.key === "triggered-c")?.triggered).toBe(true);
  });

  it("applicableSlugs masque les documents hors dossier", () => {
    const m = buildDemarcheRailModel({ ...base, items, completedTemplateIds: [], applicableSlugs: ["doc-a"] });
    expect(m.documents.docs.map((d) => d.slug)).toEqual(["doc-a"]);
  });
});
```
- [ ] **Step 3 — Validation** : `pnpm test` → tous les tests verts (1685+ existants + 6 nouveaux `rail-model`), 0 échec.
- [ ] **Step 4 — Commit** :
```bash
git add lib/bundles/rail-model.ts lib/bundles/__tests__/rail-model.test.ts
git commit -m "feat(dossier): modele pur du rail de demarche (lib/bundles/rail-model)"
```

---

### Task 2.2: Composant `DemarcheRail` (client, glass) + variante mobile repliable + clés i18n

**Files:**
- Create `components/docbel/demarche-rail.tsx`
- Modify `messages/fr.json` (namespace `public.dossier`, insertion surgicale après la clé `"demandeDuplicate"` ligne ~4791 — fichier CRLF avec doublons : Edit ciblé, JAMAIS de réécriture du fichier)

**Interfaces:**
- Consumes : `DemarcheRailModel`, `RailDoc`, `RailStepState` (`@/lib/bundles/rail-model` — Task 1) ; `type DemandeSummary` (`@/lib/bundles/demande-summary`) ; `GLASS_INPUT` (`@/lib/glass-classes`) ; clés i18n `public.dossier` (existantes : `optional` ; nouvelles : `rail*`).
- Produces : `DemarcheRail(props: DemarcheRailProps)` (export) + `export interface DemarcheRailData { bundleName: string; bundleSlug: string; runId: string; model: DemarcheRailModel }` (données sérialisables construites côté serveur pour /document).

- [ ] **Step 1 — Créer `components/docbel/demarche-rail.tsx`** (squelette complet, glass mauve — aucun `bg-white` en dur, tokens `--glass-*` comme `context-help-panel.tsx`) :
```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Clock,
  FolderOpen,
  Lock,
} from "lucide-react";
import { GLASS_INPUT } from "@/lib/glass-classes";
import type { DemandeSummary } from "@/lib/bundles/demande-summary";
import type { DemarcheRailModel, RailDoc, RailStepState } from "@/lib/bundles/rail-model";

/// Données sérialisables du rail quand il est construit côté SERVEUR
/// (page /document) puis passé au client à travers DocumentPageLayout.
export interface DemarcheRailData {
  bundleName: string;
  bundleSlug: string;
  runId: string;
  model: DemarcheRailModel;
}

interface DemarcheRailProps {
  bundleName: string;
  bundleSlug: string;
  runId: string | null;
  model: DemarcheRailModel;
  /// Démarches du même dossier — sélecteur affiché si ≥ 2 (et runId connu).
  demandes?: DemandeSummary[];
  /// Slug du document actuellement ouvert (/document) : surligné, non cliquable.
  activeDocSlug?: string | null;
  /// Cible du lien « Mes démarches » (décision produit : /mes-demarches).
  demarchesHref?: string;
  /// Bannière code de reprise (connue uniquement dans la session de création — /d).
  resumeSlot?: React.ReactNode;
  /// Bouton « Nouvelle démarche » (NouvelleDemandeButton — /d uniquement).
  newDemarcheSlot?: React.ReactNode;
  /// Conseils contextuels embarqués (/document : ContextHelpPanel embedded).
  helpSlot?: React.ReactNode;
}

/// Rail latéral permanent de la démarche : nom du dossier, sélecteur de
/// démarche, 3 grandes étapes (situation / documents / récupérer & envoyer),
/// annonce du verrou tout-ou-rien, code de reprise, lien « Mes démarches ».
/// Desktop : colonne sticky à gauche. Mobile : barre repliable en haut
/// (« 2/3 documents · Voir le détail »).
export function DemarcheRail(props: DemarcheRailProps) {
  const t = useTranslations("public.dossier");
  const [mobileOpen, setMobileOpen] = useState(false);
  const { completedCount, totalCount } = props.model.documents;

  return (
    <div className="min-w-0">
      {/* ---- Mobile : barre repliable ---- */}
      <div className="lg:hidden">
        <button
          type="button"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((o) => !o)}
          className="glass-surface flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left"
        >
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-[color:var(--glass-ink)]">
              {props.bundleName}
            </span>
            <span className="block text-xs text-[color:var(--glass-ink-soft)]">
              {t("railDocsProgress", { completed: completedCount, total: totalCount })}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1 text-[13px] font-semibold text-[color:var(--glass-accent-deep)]">
            {mobileOpen ? t("railMobileHide") : t("railMobileShow")}
            {mobileOpen ? <ChevronUp className="size-4" aria-hidden /> : <ChevronDown className="size-4" aria-hidden />}
          </span>
        </button>
        {mobileOpen && (
          <div className="mt-2 rounded-3xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface-strong)] p-4">
            <RailBody {...props} showName={false} />
          </div>
        )}
      </div>

      {/* ---- Desktop : rail permanent sticky ---- */}
      <aside
        aria-label={t("railAriaLabel")}
        className="hidden flex-col gap-4 rounded-3xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface-strong)] p-4 lg:flex lg:sticky lg:top-6"
      >
        <RailBody {...props} showName />
      </aside>
    </div>
  );
}

function RailBody({
  bundleName,
  bundleSlug,
  runId,
  model,
  demandes,
  activeDocSlug,
  demarchesHref = "/mes-demarches",
  resumeSlot,
  newDemarcheSlot,
  helpSlot,
  showName,
}: DemarcheRailProps & { showName: boolean }) {
  const t = useTranslations("public.dossier");
  const router = useRouter();

  return (
    <div className="flex flex-col gap-4">
      {showName && (
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--glass-pop-bg)] text-[color:var(--glass-accent-deep)]"
          >
            <FolderOpen className="size-4" />
          </span>
          <p className="min-w-0 truncate text-sm font-bold text-[color:var(--glass-ink)]">{bundleName}</p>
        </div>
      )}

      {/* Sélecteur de démarche — natif (cf. gotcha Select base-ui « _none ») */}
      {runId && (demandes?.length ?? 0) >= 2 && (
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[color:var(--glass-ink-soft)]">
            {t("railDemarcheSelectorLabel")}
          </span>
          <select
            className={`${GLASS_INPUT} h-9 w-full border px-2 text-sm`}
            value={runId}
            onChange={(e) =>
              router.push(
                `/d/${encodeURIComponent(bundleSlug)}?bundleRun=${encodeURIComponent(e.target.value)}`,
              )
            }
          >
            {demandes!.map((d) => (
              <option key={d.runId} value={d.runId}>
                {t("railDemarcheOption", { index: d.index, completed: d.completed, total: d.total })}
              </option>
            ))}
          </select>
        </label>
      )}

      {/* Les 3 grandes étapes */}
      <ol className="flex flex-col gap-3">
        <RailStep index={1} state={model.situation.state} title={t("railStepSituation")} />
        <RailStep
          index={2}
          state={model.documents.state}
          title={t("railStepDocuments")}
          meta={t("railDocsProgress", {
            completed: model.documents.completedCount,
            total: model.documents.totalCount,
          })}
        >
          <ul className="mt-1.5 flex flex-col gap-0.5">
            {model.documents.docs.map((doc) => (
              <RailDocRow
                key={doc.key}
                doc={doc}
                active={doc.slug === activeDocSlug}
                href={
                  runId && doc.state !== "pending" && doc.slug !== activeDocSlug
                    ? `/document/${doc.slug}?bundleRun=${encodeURIComponent(runId)}&bundleSlug=${encodeURIComponent(bundleSlug)}`
                    : null
                }
              />
            ))}
          </ul>
        </RailStep>
        <RailStep index={3} state={model.retrieve.state} title={t("railStepRetrieve")}>
          {model.retrieve.state === "locked" ? (
            <p className="mt-1 flex items-start gap-1.5 text-xs leading-relaxed text-[color:var(--glass-ink-soft)]">
              <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>{t("railLockAnnouncement", { count: model.retrieve.requiredCount })}</span>
            </p>
          ) : runId ? (
            <Link
              href={`/d/${encodeURIComponent(bundleSlug)}?bundleRun=${encodeURIComponent(runId)}#recuperer-envoyer`}
              className="mt-1 inline-flex text-[13px] font-semibold text-[color:var(--glass-accent-deep)] hover:underline"
            >
              {t("railUnlockedCta")}
            </Link>
          ) : null}
        </RailStep>
      </ol>

      {resumeSlot}
      {newDemarcheSlot && <div className="flex">{newDemarcheSlot}</div>}

      {helpSlot && (
        <div className="border-t border-[color:var(--glass-border)] pt-3.5">{helpSlot}</div>
      )}

      <div className="border-t border-[color:var(--glass-border)] pt-3.5">
        <Link
          href={demarchesHref}
          className="text-[13px] font-semibold text-[color:var(--glass-accent-deep)] hover:underline"
        >
          {t("railMyDemarches")}
        </Link>
      </div>
    </div>
  );
}

function RailStep({
  index,
  state,
  title,
  meta,
  children,
}: {
  index: number;
  state: RailStepState;
  title: string;
  meta?: string;
  children?: React.ReactNode;
}) {
  const t = useTranslations("public.dossier");
  const badge =
    state === "done" ? (
      <CheckCircle2 className="size-5 shrink-0 text-emerald-600" aria-hidden />
    ) : state === "locked" ? (
      <Lock className="size-4 shrink-0 text-[color:var(--glass-ink-faint)]" aria-hidden />
    ) : (
      <span
        aria-hidden
        className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
          state === "current"
            ? "bg-[color:var(--glass-accent-deep)] text-white"
            : "bg-[color:var(--glass-pop-bg)] text-[color:var(--glass-accent-deep)]"
        }`}
      >
        {index}
      </span>
    );
  const srState =
    state === "done"
      ? t("railStepStateDone")
      : state === "current"
        ? t("railStepStateCurrent")
        : state === "locked"
          ? t("railStepStateLocked")
          : t("railStepStateUpcoming");
  return (
    <li aria-current={state === "current" ? "step" : undefined}>
      <div className="flex items-center gap-2">
        {badge}
        <span
          className={`text-sm ${
            state === "current"
              ? "font-bold text-[color:var(--glass-ink)]"
              : "font-semibold text-[color:var(--glass-ink-soft)]"
          }`}
        >
          {title}
        </span>
        {meta && <span className="ml-auto text-xs text-[color:var(--glass-ink-soft)]">{meta}</span>}
        <span className="sr-only">{srState}</span>
      </div>
      {children && <div className="pl-7">{children}</div>}
    </li>
  );
}

function RailDocRow({ doc, href, active }: { doc: RailDoc; href: string | null; active: boolean }) {
  const t = useTranslations("public.dossier");
  const icon =
    doc.state === "done" ? (
      <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" aria-hidden />
    ) : doc.state === "pending" ? (
      <Clock className="size-3.5 shrink-0 text-[color:var(--glass-ink-faint)]" aria-hidden />
    ) : (
      <Circle className="size-3.5 shrink-0 text-[color:var(--glass-ink-faint)]" aria-hidden />
    );
  const content = (
    <>
      {icon}
      <span
        className={`min-w-0 flex-1 truncate text-[13px] ${
          active
            ? "font-semibold text-[color:var(--glass-accent-deep)]"
            : "text-[color:var(--glass-ink-soft)]"
        }`}
      >
        {doc.title}
      </span>
      {doc.state === "pending" && (
        <span className="shrink-0 text-[10px] italic text-[color:var(--glass-ink-faint)]">
          {t("railDocPending")}
        </span>
      )}
      {!doc.required && (
        <span className="shrink-0 text-[10px] text-[color:var(--glass-ink-faint)]">{t("optional")}</span>
      )}
    </>
  );
  if (href) {
    return (
      <li>
        <Link
          href={href}
          className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-[color:var(--glass-pop-bg)]/40"
        >
          {content}
        </Link>
      </li>
    );
  }
  return (
    <li>
      <span
        className="flex items-center gap-2 px-1.5 py-1"
        aria-current={active ? "page" : undefined}
      >
        {content}
      </span>
    </li>
  );
}
```
- [ ] **Step 2 — Clés i18n FR (vouvoiement)** — Edit surgical dans `messages/fr.json`, `old_string` = la ligne de la clé `"demandeDuplicate"` (valeur passée au vouvoiement par le Lot 1 — reprendre la ligne telle qu'elle est) et `new_string` = cette même ligne suivie du bloc :
```json
      "railAriaLabel": "Progression de votre démarche",
      "railDemarcheSelectorLabel": "Votre démarche",
      "railDemarcheOption": "Démarche n°{index} · {completed}/{total}",
      "railStepSituation": "Ma situation",
      "railStepDocuments": "Les documents",
      "railStepRetrieve": "Récupérer & envoyer",
      "railDocsProgress": "{completed}/{total} {total, plural, one {document} other {documents}}",
      "railLockAnnouncement": "Vos PDF se déverrouillent quand {count, plural, one {le document requis est complété} other {les # documents requis sont complétés}}.",
      "railUnlockedCta": "Récupérer mes documents",
      "railDocPending": "En attente",
      "railMyDemarches": "Mes démarches",
      "railMobileShow": "Voir le détail",
      "railMobileHide": "Réduire",
      "railStepStateDone": "Étape complétée",
      "railStepStateCurrent": "Étape en cours",
      "railStepStateUpcoming": "Étape à venir",
      "railStepStateLocked": "Étape verrouillée",
```
(FR uniquement : `scripts/i18n-validate.ts` traite les clés manquantes des autres locales en avertissement + fallback FR. Signaler aux traducteurs : tout le bloc est en vouvoiement — registre « u » attendu en NL.)
- [ ] **Step 3 — Validation** : `pnpm i18n:check` → exit 0 (ICU valide ; avertissements de couverture attendus) ; `pnpm build` → exit 0 (le composant compile, pas encore monté) ; `pnpm lint` → aucune erreur NOUVELLE (~74 pré-existantes).
- [ ] **Step 4 — Commit** :
```bash
git add components/docbel/demarche-rail.tsx messages/fr.json
git commit -m "feat(dossier): composant DemarcheRail glass (desktop sticky + mobile repliable) + cles i18n rail"
```

---

### Task 2.3: Intégration du rail dans `/d/[slug]` — le rail remplace le compteur, la bannière code et le bouton Nouvelle demande

**Files:**
- Modify `components/docbel/bundle-runner.tsx` (imports, props, bloc en-tête l.383-410, bloc ResumeCodeBanner l.427-435, bloc NouvelleDemandeButton l.488-493, racine du `return`)
- Modify `app/d/[slug]/page.tsx` (bloc `runnerProps` l.379-396)
- Modify `messages/fr.json` (3 valeurs existantes, vocabulaire « démarche » + vouvoiement)

**Interfaces:**
- Consumes : `DemarcheRail` (Task 2), `buildDemarcheRailModel` (Task 1), `buildDemandeSummaries` (déjà importé dans la page), `ResumeCodeBanner`, `NouvelleDemandeButton` (déjà importés dans bundle-runner).
- Produces : `BundleRunnerProps` gagne `demandes?: DemandeSummary[]` (défaut `[]`) — flowe automatiquement à travers `DossierJourneyIntro` (`ComponentProps<typeof BundleRunner>`, spread `{...runnerProps}` : aucun changement dans ce fichier).

- [ ] **Step 1 — `bundle-runner.tsx` : imports + prop.** Ajouter aux imports :
```ts
import { DemarcheRail } from "./demarche-rail";
import { buildDemarcheRailModel } from "@/lib/bundles/rail-model";
import type { DemandeSummary } from "@/lib/bundles/demande-summary";
```
Dans `BundleRunnerProps`, ajouter :
```ts
  /// Résumés des démarches du même dossier (sélecteur du rail si ≥ 2).
  demandes?: DemandeSummary[];
```
et dans la destructuration de `BundleRunner(...)` : `demandes = [],`.
- [ ] **Step 2 — Retirer le compteur de l'en-tête.** Dans le bloc en-tête (l.391-399), supprimer UNIQUEMENT le paragraphe compteur — avant :
```tsx
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{bundle.name}</h1>
            <p className="text-sm text-muted-foreground">
              {t("runnerCompletedCount", {
                completed: completedCount,
                count: visibleItems.length,
              })}
            </p>
          </div>
```
après :
```tsx
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{bundle.name}</h1>
          </div>
```
(le h1 + la description + le bouton « Recommencer » restent dans la colonne principale).
- [ ] **Step 3 — Retirer la bannière code et le bouton Nouvelle demande du flux principal.** Supprimer intégralement le bloc (l.427-435) :
```tsx
      {/* Banner code de reprise — visible une fois le run créé */}
      {runId && resumeCode && (
        <ResumeCodeBanner
          runId={runId}
          resumeCode={resumeCode}
          resumeCodeExpiresAt={resumeCodeExpiresAt}
          initialResumeEmail={resumeEmail}
        />
      )}
```
et le bloc (l.488-493) :
```tsx
          {/* Créer une AUTRE demande dissociée pour ce dossier (multi-demande). */}
          {runId && (
            <div className="flex justify-end">
              <NouvelleDemandeButton bundleId={bundle.id} slug={bundle.slug} variant="ghost" />
            </div>
          )}
```
(les imports `ResumeCodeBanner` / `NouvelleDemandeButton` RESTENT : réutilisés dans les slots du rail au Step 4).
- [ ] **Step 4 — Grille 2 colonnes rail + contenu.** Juste avant le `return (` principal (après le early-return `canAutoForward`, qui reste inchangé), calculer le modèle :
```ts
  // Modèle du rail — mêmes intrants que computeItemStatuses ci-dessus.
  const railModel = buildDemarcheRailModel({
    items: bundle.items,
    completedTemplateIds,
    payloads,
    applicableSlugs,
    hasEligibilityQuestions,
    eligibilityCompleted,
  });
```
Puis remplacer la racine `<div className="space-y-6">` … `</div>` par :
```tsx
  return (
    <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
      <DemarcheRail
        bundleName={bundle.name}
        bundleSlug={bundle.slug}
        runId={runId}
        model={railModel}
        demandes={demandes}
        resumeSlot={
          runId && resumeCode ? (
            <ResumeCodeBanner
              runId={runId}
              resumeCode={resumeCode}
              resumeCodeExpiresAt={resumeCodeExpiresAt}
              initialResumeEmail={resumeEmail}
            />
          ) : undefined
        }
        newDemarcheSlot={
          runId ? (
            <NouvelleDemandeButton bundleId={bundle.id} slug={bundle.slug} variant="ghost" />
          ) : undefined
        }
      />
      <div className="min-w-0 space-y-6">
        {/* … TOUT le contenu existant (alerte clonedFromDate, en-tête, warnings,
            gate pré-qualif, bouton Modifier mes réponses, BundleRoadmap, carte
            Documents du parcours, docs tiers, docs masqués) — inchangé hormis
            les retraits des Steps 2-3 … */}
      </div>
    </div>
  );
```
- [ ] **Step 5 — `app/d/[slug]/page.tsx` : passer les résumés de démarches.** Dans l'objet `runnerProps` (l.379-396), ajouter après `clonedFromDate,` :
```ts
          demandes: buildDemandeSummaries(
            runsWithProgress.map((r) => ({
              id: r.id,
              startedAt: r.startedAt,
              completedTemplateIds: r.completedTemplateIds,
              status: r.status,
              completedAt: r.completedAt,
              anonymizedAt: r.anonymizedAt,
            })),
            bundle.items.length,
          ),
```
(`buildDemandeSummaries` est déjà importé ligne 27 ; même mapping que le bloc `DemandeList` plus haut dans le fichier.)
⚠ La Task 0.8 a aligné le `total` sur les documents VISIBLES par run : reprendre ici la MÊME construction que le bloc `DemandeList` mis à jour — ne PAS repasser `bundle.items.length`.
- [ ] **Step 6 — Vérification vocabulaire (normalement déjà appliqué au Lot 1, Task 1.1)** — si l'une de ces valeurs n'est pas encore à jour, l'appliquer :
  - `"demandeNew": "Nouvelle demande",` → `"demandeNew": "Nouvelle démarche",`
  - `"demandeNewError": "Impossible de créer une nouvelle demande.",` → `"demandeNewError": "Impossible de créer une nouvelle démarche.",`
  - `"demandeTooMany": "Tu as trop de demandes ouvertes pour ce dossier.",` → `"demandeTooMany": "Vous avez trop de démarches ouvertes pour ce dossier.",`
  (ces clés sont aussi consommées par `demande-list.tsx` — même objet, même sens, pas de casse.)
- [ ] **Step 7 — Validation** : `pnpm build` → exit 0 ; `pnpm test` → verts ; `pnpm i18n:check` → exit 0. Écrans à vérifier (`pnpm dev` lancé depuis PowerShell, cf. quirk ANTHROPIC_API_KEY) :
  - `/d/allocations-insertion?demarrer=1` puis retour liste : rail à gauche (nom du dossier, étapes 1 ✓/○, 2 avec sous-liste, 3 🔒 + annonce verrou), bannière ambre code DANS le rail, bouton « Nouvelle démarche » DANS le rail ; plus de compteur sous le h1.
  - Même page avec 2 démarches en cours + `?bundleRun=<id>` : le sélecteur « Votre démarche » liste « Démarche n°1 / n°2 » et bascule l'URL.
  - Mobile (≤ lg) : barre repliable en haut « {nom} · 2/3 documents · Voir le détail ».
- [ ] **Step 8 — Commit** :
```bash
git add components/docbel/bundle-runner.tsx "app/d/[slug]/page.tsx" messages/fr.json
git commit -m "feat(dossier): rail de demarche sur /d/[slug] (compteur, code de reprise et nouvelle demarche migres dans le rail)"
```

---

### Task 2.4: Préparer /document — `FormShell` ordre mobile, `ContextHelpPanel` embarquable, `loadDossierState` enrichi

**Files:**
- Modify `components/pdf-forms/form-shell.tsx` (fichier entier, 19 lignes)
- Modify `components/pdf-forms/context-help-panel.tsx` (props + balise racine `<aside>` l.65)
- Modify `lib/bundles/completion.ts` (interface `DossierState` + fin de `loadDossierState`)

**Interfaces:**
- Consumes : `parseEligibilityQuestions` (`@/lib/bundles/eligibility`), `dossierQuestionsToEligibility` (`@/lib/dossiers/types`) — nouveaux imports dans completion.ts.
- Produces : `FormShellProps.helpFirstOnMobile?: boolean` ; `ContextHelpPanelProps.embedded?: boolean` ; `DossierState.run` devient `{ id: string; bundleSlug: string; bundleName: string }` et `DossierState` gagne `hasEligibilityQuestions: boolean` + `eligibilityCompleted: boolean` (champs ADDITIFS — les consommateurs existants `generate`/`download-all`/`download/[pdfFormId]`/`email` ne lisent que `allRequiredDone`/`missing`/`run.id` : aucun impact).

- [ ] **Step 1 — `form-shell.tsx`** (remplacement complet) :
```tsx
interface FormShellProps {
  children: React.ReactNode;
  helpPanel: React.ReactNode;
  /// true = colonne d'aide EN PREMIER dans le DOM : sur mobile elle apparaît
  /// AU-DESSUS du formulaire (cas du rail de démarche, replié par défaut).
  /// false (défaut) = comportement historique : aide sous le formulaire sur
  /// mobile, repositionnée à gauche sur desktop via lg:order-*.
  helpFirstOnMobile?: boolean;
}

/// Layout 2 colonnes desktop (aide/rail À GAUCHE | formulaire), 1 colonne
/// mobile. Pas de max-w-*/mx-auto sur la racine (cf. DESIGN_RULES) — le
/// conteneur parent gère la largeur.
export function FormShell({ children, helpPanel, helpFirstOnMobile = false }: FormShellProps) {
  if (helpFirstOnMobile) {
    return (
      <div className="grid w-full grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
        <div className="min-w-0">{helpPanel}</div>
        <div className="min-w-0">{children}</div>
      </div>
    );
  }
  return (
    <div className="grid w-full grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
      <div className="min-w-0 lg:order-2">{children}</div>
      <div className="lg:order-1">{helpPanel}</div>
    </div>
  );
}
```
(seul consommateur : `pdf-form-runner.tsx` — vérifié par grep.)
- [ ] **Step 2 — `context-help-panel.tsx` : mode embarqué.** Ajouter à `ContextHelpPanelProps` :
```ts
  /// true = rendu SANS chrome propre (bordure/fond/sticky) : le panneau est
  /// embarqué dans le rail de démarche qui porte déjà la surface glass.
  embedded?: boolean;
```
Ajouter `embedded = false` à la destructuration, puis remplacer la balise racine — avant :
```tsx
    <aside className="flex flex-col gap-3.5 rounded-3xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface-strong)] p-4 lg:sticky lg:top-6">
```
après :
```tsx
    <aside
      className={
        embedded
          ? "flex flex-col gap-3.5"
          : "flex flex-col gap-3.5 rounded-3xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface-strong)] p-4 lg:sticky lg:top-6"
      }
    >
```
(tout le contenu interne — eyebrow « Conseils utiles », aide de champ, tips, checklist, bloc contact — inchangé : il devient la section « Conseils » du rail.)
- [ ] **Step 3 — `lib/bundles/completion.ts` : enrichir `DossierState`.** Ajouter aux imports existants :
```ts
import { parseEligibilityAnswers, parseEligibilityQuestions } from "@/lib/bundles/eligibility";
import { selectDocuments, dossierQuestionsToEligibility, type DossierAnswers } from "@/lib/dossiers/types";
```
(remplace les deux lignes d'import actuelles de ces modules). Dans `interface DossierState`, remplacer `run: { id: string; bundleSlug: string };` par :
```ts
  run: { id: string; bundleSlug: string; bundleName: string };
  /// Pré-qualification (rail de démarche — étape « Ma situation »).
  hasEligibilityQuestions: boolean;
  eligibilityCompleted: boolean;
```
Dans `loadDossierState`, après la ligne `const eligibilityAnswers = parseEligibilityAnswers(run.eligibilityAnswers);`, ajouter :
```ts
  // Questions de pré-qualification : le module de code prime sur la DB
  // (même logique que app/d/[slug]/page.tsx, eligibilityQuestionsSerialized).
  const eligibilityQuestions = parseEligibilityQuestions(
    dossier ? dossierQuestionsToEligibility(dossier.questions) : run.bundle.eligibilityQuestions,
  );
  const hasEligibilityQuestions = eligibilityQuestions.length > 0;
  const eligibilityCompleted =
    !hasEligibilityQuestions ||
    eligibilityQuestions.every(
      (q) => eligibilityAnswers[q.id] !== undefined && eligibilityAnswers[q.id] !== "",
    );
```
⚠ `dossier` est déclaré APRÈS dans le fichier actuel (`const dossier = getDossier(run.bundle.slug);` l.170) : déplacer cette déclaration AVANT le bloc ci-dessus. Enfin, dans le `return`, remplacer `run: { id: run.id, bundleSlug: run.bundle.slug },` par :
```ts
    run: { id: run.id, bundleSlug: run.bundle.slug, bundleName: run.bundle.name },
```
et ajouter `hasEligibilityQuestions,` + `eligibilityCompleted,` à l'objet retourné.
- [ ] **Step 4 — Validation** : `pnpm test` → verts (dont `lib/bundles/__tests__/completion.test.ts` inchangé : `deriveMissingDocs` non touché) ; `pnpm build` → exit 0 (le typecheck confirme que les routes download/email/generate compilent avec le `DossierState` étendu).
- [ ] **Step 5 — Commit** :
```bash
git add components/pdf-forms/form-shell.tsx components/pdf-forms/context-help-panel.tsx lib/bundles/completion.ts
git commit -m "feat(dossier): FormShell ordre mobile + ContextHelpPanel embarquable + DossierState enrichi (nom bundle, pre-qualif)"
```

---

### Task 2.5: Câbler le rail sur `/document/[...path]` — le rail remplace l'emplacement du ContextHelpPanel, conseils dedans

**Files:**
- Modify `app/document/[...path]/page.tsx` (bloc `if (bundleRun)` l.287-330 + rendu final)
- Modify `components/pdf-forms/document-page-layout.tsx` (Props + passage au runner)
- Modify `components/pdf-forms/pdf-form-runner.tsx` (Props, 2 call-sites `FormShell` l.889-901 et l.1474-1486, props `MacroRunnerBody`)

**Interfaces:**
- Consumes : `loadDossierState` (`@/lib/bundles/completion`, enrichi Task 4), `buildDemarcheRailModel` (Task 1), `DemarcheRail` + `type DemarcheRailData` (Task 2), `FormShell.helpFirstOnMobile` + `ContextHelpPanel.embedded` (Task 4).
- Produces : prop `rail?: DemarcheRailData` sur `DocumentPageLayout` et `PdfFormRunner` (et `MacroRunnerBodyProps`). L'URL reste `/document/{slug}?bundleRun=<id>&bundleSlug=<slug>` — aucun nouveau param.

- [ ] **Step 1 — `page.tsx` : construire `rail` côté serveur.** Imports à ajouter :
```ts
import { loadDossierState } from "@/lib/bundles/completion";
import { buildDemarcheRailModel } from "@/lib/bundles/rail-model";
import type { DemarcheRailData } from "@/components/docbel/demarche-rail";
```
Dans `PdfFormPage`, déclarer `let rail: DemarcheRailData | undefined;` à côté de `let validBundleRunId…`, puis DANS le bloc `if (bundleRun) { … }`, après le `if (runValid) { … }` existant (la variable `sessionId` y est déjà en scope) :
```ts
    // Rail de démarche : état complet du dossier (items + déclenchés + verrou),
    // MÊME source que le 409 dossier_incomplete. Ownership re-vérifiée dedans.
    if (runValid && bundleSlug) {
      const dossierState = await loadDossierState(bundleRun, {
        userId: userId ?? null,
        sessionId,
      });
      if (dossierState && dossierState.run.bundleSlug === bundleSlug) {
        rail = {
          bundleName: dossierState.run.bundleName,
          bundleSlug: dossierState.run.bundleSlug,
          runId: dossierState.run.id,
          model: buildDemarcheRailModel({
            items: dossierState.items,
            completedTemplateIds: dossierState.completedTemplateIds,
            payloads: dossierState.payloads,
            applicableSlugs: dossierState.applicableSlugs,
            hasEligibilityQuestions: dossierState.hasEligibilityQuestions,
            eligibilityCompleted: dossierState.eligibilityCompleted,
          }),
        };
      }
    }
```
Puis passer `rail={rail}` à `<DocumentPageLayout … />`.
- [ ] **Step 2 — `document-page-layout.tsx` : thread.** Ajouter à `Props` :
```ts
  /// Rail de démarche (contexte dossier uniquement) — construit côté serveur.
  rail?: DemarcheRailData;
```
avec l'import `import type { DemarcheRailData } from "@/components/docbel/demarche-rail";`, ajouter `rail` à la destructuration et passer `rail={rail}` au `<PdfFormRunner … />`.
- [ ] **Step 3 — `pdf-form-runner.tsx` : le rail prend l'emplacement du panneau, conseils embarqués.** (a) Imports : `import { DemarcheRail, type DemarcheRailData } from "@/components/docbel/demarche-rail";`. (b) `PdfFormRunnerProps` + destructuration : ajouter `rail?: DemarcheRailData;`. (c) `MacroRunnerBodyProps` : ajouter `rail?: DemarcheRailData;` et le passer à l'appel `<MacroRunnerBody … rail={rail} …/>` (l.820-842). (d) Call-site CLASSIQUE — avant (l.889-901) :
```tsx
      <FormShell
        helpPanel={
          <ContextHelpPanel
            formSlug={form.slug}
            sectionKeys={activeSectionKey ? [activeSectionKey] : []}
            checkedFieldIds={checkedFieldIds}
            entries={contextTips}
            activeFieldId={activeFieldId}
            fields={form.fields}
            locale={locale}
          />
        }
      >
```
après :
```tsx
      <FormShell
        helpFirstOnMobile={Boolean(rail)}
        helpPanel={(() => {
          const help = (
            <ContextHelpPanel
              formSlug={form.slug}
              sectionKeys={activeSectionKey ? [activeSectionKey] : []}
              checkedFieldIds={checkedFieldIds}
              entries={contextTips}
              activeFieldId={activeFieldId}
              fields={form.fields}
              locale={locale}
              embedded={Boolean(rail)}
            />
          );
          return rail ? (
            <DemarcheRail
              bundleName={rail.bundleName}
              bundleSlug={rail.bundleSlug}
              runId={rail.runId}
              model={rail.model}
              activeDocSlug={form.slug}
              helpSlot={help}
            />
          ) : (
            help
          );
        })()}
      >
```
(e) Call-site MACRO (l.1474-1486) : transformation IDENTIQUE (mêmes 9 props du `ContextHelpPanel` macro existant — `sectionKeys={current.sections.map((s) => s.key).filter((k): k is string => !!k)}` etc. — enveloppées dans le même IIFE `rail ? <DemarcheRail …activeDocSlug={form.slug} helpSlot={help}/> : help` + `helpFirstOnMobile={Boolean(rail)}`).
- [ ] **Step 4 — Validation** : `pnpm build` → exit 0 ; `pnpm test` → verts. Écrans :
  - Depuis `/d/allocations-insertion`, cliquer « Compléter » sur le 1er document → sur `/document/...?bundleRun=…&bundleSlug=allocations-insertion` : rail à gauche À LA PLACE du panneau « Conseils utiles », document courant surligné non cliquable dans la sous-liste, les AUTRES documents cliquables, étape 3 🔒 avec l'annonce du verrou, conseils contextuels DANS le rail sous les étapes (section « Conseils utiles » + « À propos de ce champ » au focus), lien « Mes démarches » en pied.
  - Mobile : barre repliable AU-DESSUS du formulaire (« {dossier} · 0/3 documents · Voir le détail »).
  - Formulaire AUTONOME (ouvert depuis `/outils`, sans `bundleRun`) : panneau « Conseils utiles » historique inchangé (chrome propre, sous le formulaire sur mobile).
  - Formulaire macro (C1) en contexte dossier : rail présent aussi.
- [ ] **Step 5 — Commit** :
```bash
git add "app/document/[...path]/page.tsx" components/pdf-forms/document-page-layout.tsx components/pdf-forms/pdf-form-runner.tsx
git commit -m "feat(dossier): rail de demarche sur /document (remplace l'emplacement du panneau conseils, conseils embarques)"
```

---

### Task 2.6: Harmonisation glass mauve du BundleRunner + registre « vous » des clés du runner

**Files:**
- Modify `components/docbel/bundle-runner.tsx` (cartes `Card`/`Alert` → surfaces glass ; zones : carte « Documents du parcours » l.495-586, carte docs tiers l.588-659, carte docs masqués l.661-688, `Alert` clonedFromDate l.370-382, `Alert` runnerStartHint l.455-463, en-tête l.383-410)
- Modify `messages/fr.json` (4 valeurs, tutoiement → vouvoiement)

**Interfaces:**
- Consumes : tokens glass (`--glass-border`, `--glass-surface`, `--glass-surface-strong`, `--glass-ink`, `--glass-ink-soft`, `--glass-pop-bg`, `--glass-accent-deep`), classe `.glass-surface` (globals.css l.437). `Button`/`Badge` shadcn restent (déjà utilisés sur le front glass, cf. document-page-layout).
- Produces : aucun changement d'API — restyle pur + copies.

- [ ] **Step 1 — Carte « Documents du parcours ».** Remplacer `<Card><CardHeader><CardTitle …>{t("runnerFlowDocuments")}</CardTitle></CardHeader><CardContent className="space-y-2">…</CardContent></Card>` par :
```tsx
          <section className="glass-surface flex flex-col gap-2 rounded-3xl p-4 sm:p-5">
            <h2 className="text-base font-semibold text-[color:var(--glass-ink)]">
              {t("runnerFlowDocuments")}
            </h2>
            {/* …les lignes visibleItems.map inchangées… */}
          </section>
```
et, sur chaque ligne d'item, remplacer la classe du conteneur — avant :
```tsx
className={`flex items-start gap-3 p-3 border rounded-md transition-colors ${
  completed ? "bg-emerald-500/10 border-emerald-500/20"
    : isPending ? "bg-white/[0.06] border-dashed opacity-70"
      : "hover:bg-white/10"
}`}
```
après :
```tsx
className={`flex items-start gap-3 rounded-2xl border p-3 transition-colors ${
  completed
    ? "border-emerald-500/25 bg-emerald-500/10"
    : isPending
      ? "border-dashed border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] opacity-70"
      : "border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] hover:bg-[color:var(--glass-pop-bg)]/40"
}`}
```
Remplacer aussi dans ces lignes `text-muted-foreground` par `text-[color:var(--glass-ink-soft)]` (icônes Circle/Clock, description, condition) et `font-medium` du titre par `font-medium text-[color:var(--glass-ink)]`.
- [ ] **Step 2 — Carte « Documents à fournir par un tiers ».** `<Card className="border-amber-500/30 bg-amber-500/5">…` → `<section className="glass-surface flex flex-col gap-2 rounded-3xl border border-amber-500/25 p-4 sm:p-5">` avec `<h2 className="flex items-center gap-2 text-base font-semibold text-[color:var(--glass-ink)]">` (icône Inbox conservée) et `<p className="text-xs text-[color:var(--glass-ink-soft)]">` pour la note ; lignes internes : `bg-white/[0.04]` → `bg-[color:var(--glass-surface)]`, `rounded-md` → `rounded-2xl`.
- [ ] **Step 3 — Carte « Documents non requis » + alertes.** `<Card className="border-dashed bg-white/5">` → `<section className="flex flex-col gap-1.5 rounded-3xl border border-dashed border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-4">` (titre en `<h2 className="flex items-center gap-2 text-sm font-semibold text-[color:var(--glass-ink-soft)]">`). Les deux `<Alert><AlertDescription>…</AlertDescription></Alert>` (clonedFromDate et runnerStartHint) → :
```tsx
        <div className="rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-3 text-sm text-[color:var(--glass-ink-soft)]">
          …contenu identique…
        </div>
```
puis retirer les imports devenus inutiles (`Card, CardContent, CardHeader, CardTitle`, `Alert, AlertDescription`) — vérifier qu'aucun autre usage ne reste dans le fichier avant suppression. En-tête : `<h1 className="text-2xl font-bold">` → `<h1 className="glass-display text-2xl font-semibold text-[color:var(--glass-ink)]">` et la description `text-muted-foreground` → `text-[color:var(--glass-ink-soft)]`.
- [ ] **Step 4 — Vérification registre « vous » (normalement déjà appliqué au Lot 1, Task 1.1)** — si l'une de ces valeurs n'est pas encore à jour, l'appliquer :
  - `"runnerTriggeredBadge": "Suite à tes réponses",` → `"runnerTriggeredBadge": "Suite à vos réponses",`
  - `"runnerExternalDocsNote": "Ces pièces sont obligatoires au dossier mais tu ne peux pas les remplir toi-même. Pense à les réclamer dès que possible.",` → `"runnerExternalDocsNote": "Ces pièces sont obligatoires au dossier mais vous ne pouvez pas les remplir vous-même. Pensez à les réclamer dès que possible.",`
  - `"runnerLetterSuccess": "Courrier généré — pense à le compléter, le signer et l'envoyer.",` → `"runnerLetterSuccess": "Courrier généré — pensez à le compléter, le signer et l'envoyer.",`
  - `"demandeClonedNotice": "Cette demande reprend les infos de ta demande du {date}. Vérifie et modifie seulement ce qui a changé.",` → `"demandeClonedNotice": "Cette démarche reprend les informations de votre démarche du {date}. Vérifiez et modifiez uniquement ce qui a changé.",`
- [ ] **Step 5 — Validation** : `pnpm build` → exit 0 ; `pnpm lint` → aucune erreur nouvelle ; `pnpm i18n:check` → exit 0. Écran : `/d/allocations-insertion?bundleRun=<id>` — plus aucune carte blanche shadcn « admin » dans la colonne principale (surfaces translucides mauves, cohérentes avec la DemandeList et le rail), badge compagnon « Suite à vos réponses ».
- [ ] **Step 6 — Commit** :
```bash
git add components/docbel/bundle-runner.tsx messages/fr.json
git commit -m "feat(dossier): harmonisation glass mauve du BundleRunner + registre vous"
```

---

### Task 2.7: `BundleRoadmap` restylé glass = écran « Récupérer & envoyer » (étape 3 du rail)

**Files:**
- Modify `components/docbel/bundle-roadmap.tsx` (wrapper `Card` l.269-318 + imports)
- Modify `messages/fr.json` (2 valeurs : `roadmapTitle`, `roadmapIntro`)

**Interfaces:**
- Consumes : classe `.glass-surface`, tokens glass ; ancre `#recuperer-envoyer` (cible du lien `railUnlockedCta` posé en Task 2 : `/d/{slug}?bundleRun={id}#recuperer-envoyer`).
- Produces : aucun changement d'API (`BundleRoadmapProps` inchangé) — restyle + retitrage.

- [ ] **Step 1 — Wrapper glass + ancre.** Avant (l.269-292) :
```tsx
    <Card className="border-emerald-500/30 bg-emerald-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-green-600" />
              {t("roadmapTitle")}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {t("roadmapIntro")}
            </p>
          </div>
          …bouton Imprimer…
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
```
Après :
```tsx
    <section
      id="recuperer-envoyer"
      className="glass-surface flex flex-col gap-4 rounded-3xl border border-emerald-500/25 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-[color:var(--glass-ink)]">
            <ListChecks className="w-5 h-5 text-emerald-600" />
            {t("roadmapTitle")}
          </h2>
          <p className="mt-1 text-sm text-[color:var(--glass-ink-soft)]">
            {t("roadmapIntro")}
          </p>
        </div>
        …bouton Imprimer inchangé…
      </div>
      <div className="space-y-4">
```
Fermer avec `</div></section>` (à la place de `</CardContent></Card>`), remplacer dans les étapes `text-muted-foreground` → `text-[color:var(--glass-ink-soft)]` (corps d'étape l.303-307 et disclaimer l.313 ; le disclaimer garde `border-t` → `border-t border-[color:var(--glass-border)]`), puis retirer l'import `Card, CardContent, CardHeader, CardTitle` (plus utilisé dans ce fichier après ce step — vérifier).
- [ ] **Step 2 — Retitrage (Edit surgical fr.json)** — ⚠ changement de SENS de clé, à signaler aux traducteurs (clés absentes des autres locales aujourd'hui : fallback FR) :
  - `"roadmapTitle": "Votre feuille de route",` → `"roadmapTitle": "Récupérer & envoyer vos documents",`
  - `"roadmapIntro": "Tous les documents obligatoires sont complétés. Voici quoi faire maintenant, étape par étape.",` → `"roadmapIntro": "Tous les documents obligatoires sont complétés : vos PDF sont déverrouillés. Voici comment les récupérer et les envoyer, étape par étape.",`
- [ ] **Step 3 — Validation** : `pnpm build` → exit 0 ; `pnpm i18n:check` → exit 0. Écrans :
  - `/d/allocations-insertion?bundleRun=<id>` avec tout le requis complété : carte verte glass « Récupérer & envoyer vos documents » ; dans le rail, l'étape 3 passe de 🔒 à « en cours » (pastille) et les 3 étapes racontent la même histoire.
  - Depuis `/document/…` (dossier complet), le lien « Récupérer mes documents » du rail atterrit sur l'ancre `#recuperer-envoyer` de `/d/{slug}?bundleRun=<id>`.
  - Vérifier `window.print()` (bouton « Imprimer ») : le contenu reste lisible (les classes `print:hidden` existantes sont conservées).
- [ ] **Step 4 — Commit** :
```bash
git add components/docbel/bundle-roadmap.tsx messages/fr.json
git commit -m "feat(dossier): BundleRoadmap restyle glass en ecran Recuperer & envoyer (etape 3 du rail)"
```

---

# Lot 4 — Le guichet unique d'entrée (`/mon-dossier`)

### Task 4.1: Un seul écran — guichet en haut, catalogue en dessous

**Files:**
- Modify: `app/mon-dossier/mon-dossier-client.tsx` (structure principale : toggle l.~600, raccourcis « L'assistant dossier », tabpanel)
- Modify: `messages/fr.json` (`public.dossier` : titres du guichet)

**Interfaces:**
- Consumes: `DossierWizard` avec `initialSituation` (Task 0.6).
- Produces: `/mon-dossier` = 1 page verticale : Dossier en cours (teaser) → GUICHET (wizard toujours ouvert) → « Parcourir tous les dossiers » (l'actuel accès direct) → aide. Plus de toggle 2 modes, plus de tabpanel vide au premier chargement.

- [ ] **Step 1 — Lire le fichier en entier** (structure des sections, states `mode`/`guideStarted`) avant toute édition.
- [ ] **Step 2 — Supprimer le toggle et les raccourcis redondants.** Retirer : les 2 gros boutons « Je me laisse guider » / « J'accède directement » (state `mode`), le bloc « L'assistant dossier » (4 raccourcis — la présélection vit désormais dans les tuiles du guichet lui-même), et la condition `guideStarted` (le wizard est TOUJOURS rendu : l'écran vide au premier chargement disparaît). Conserver les states nécessaires à la présélection (Task 0.6) : `presetSituation` pilote seulement `initialSituation`/`key` du wizard.
- [ ] **Step 3 — Le guichet.** Le `DossierWizard` devient la section principale sous le header, précédé d'un titre : h2 « Qu'est-ce qui vous arrive ? » + sous-titre « Répondez en deux clics — on vous amène directement au bon dossier. » (clés `guichetTitle`/`guichetSubtitle` à insérer dans `public.dossier`). L'étape 1 du wizard (recherche + pills thématiques + situations) fait office de tuiles du guichet — pas de duplication.
- [ ] **Step 4 — Le catalogue dessous.** L'actuel mode « direct » (recherche scoring, tris, groupes par catégorie) est rendu SYSTÉMATIQUEMENT sous le guichet, sous un titre « Parcourir tous les dossiers » (clé `guichetBrowseAll`) — c'est une section, plus un mode exclusif.
- [ ] **Step 5 — Validation** : `pnpm build` + `pnpm i18n:check` → exit 0 ; `pnpm test` → verts (adapter les tests existants de la page s'il y en a — grep `mon-dossier` dans les `__tests__`). Écrans : `/mon-dossier` nu → guichet ouvert étape 1 + catalogue dessous (plus de zone vide) ; `?situation=…` → étape 2 directe ; mobile.
- [ ] **Step 6 — Commit** : `git add app/mon-dossier/mon-dossier-client.tsx messages/fr.json` → `feat(dossier): guichet unique sur /mon-dossier (fin du toggle 2 modes)`

---

### Task 4.2: La pré-qualification fusionne dans le guichet (plus de double interrogatoire)

**Files:**
- Modify: `components/docbel/onboarding/dossier-wizard.tsx` (écran résultat, pose du cookie `beldoc-orientation`)
- Modify: `app/api/documents/bundles/[id]/run/route.ts` (lecture du cookie — zone existante)
- Modify: `components/docbel/onboarding/eligibility-prequalifier.tsx` (auto-skip quand tout est prérempli)

**Interfaces:**
- Consumes: le mécanisme EXISTANT : au résultat, le wizard pose le cookie `beldoc-orientation` (10 min) ; `POST /api/documents/bundles/[id]/run` le relit et persiste `orientationAnswers` sur le run ; `EligibilityPrequalifier` préremplit déjà ses selects depuis l'orientation (badge « d'après vos réponses »). Lire ces trois zones AVANT d'éditer.
- Produces: quand TOUTES les questions d'éligibilité du bundle sont couvertes par les réponses du wizard, le gate est sauté (les réponses sont posées sur `eligibilityAnswers` du run) ; « Modifier mes réponses préliminaires » reste disponible dans le runner pour rouvrir le gate. Le gate COMPLET reste pour l'entrée par le catalogue (sans wizard).

- [ ] **Step 1 — Cartographier le mapping.** Lister les questions d'éligibilité des bundles actifs (`DocumentBundle.eligibilityQuestions` + modules `lib/dossiers/*`) et les réponses produites par l'arbre wizard (Decision Builder) : construire la table de correspondance `wizardAnswerId → eligibilityQuestionId` DANS le code du dossier concerné (pattern existant : le prefill orientation de `eligibility-prequalifier.tsx` — étendre sa table, ne pas créer un 2ᵉ mécanisme).
- [ ] **Step 2 — Auto-skip.** Dans `EligibilityPrequalifier` : si, au montage, TOUTES les questions ont une valeur préremplie valide (orientation), soumettre automatiquement (même chemin que le bouton « Démarrer le parcours » — POST run) au lieu d'afficher le gate ; afficher à la place un bandeau discret « Vos réponses du guide ont été reprises — <bouton>les modifier</bouton> ». ⚠ ESLint : pas de setState synchrone dans un effect — déclencher la soumission dans un handler async lancé par l'effect (pattern autorisé : cf. auto-forward de `bundle-runner.tsx` l.334-348).
- [ ] **Step 3 — Validation** : `pnpm build` → exit 0 ; `pnpm test` → verts. Écrans : wizard → « Démarrer la démarche » → `/d/{slug}?demarrer=1` n'affiche PLUS les mêmes questions (va direct au formulaire) ; entrée par le catalogue (sans wizard) → le gate complet s'affiche comme avant ; « Modifier mes réponses préliminaires » rouvre le gate.
- [ ] **Step 4 — Commit** : `git add components/docbel/onboarding/dossier-wizard.tsx components/docbel/onboarding/eligibility-prequalifier.tsx "app/api/documents/bundles/[id]/run/route.ts"` → `feat(dossier): la pre-qualification reprend les reponses du guichet (zero double question)`

---

### Task 4.3: `/creer-ma-demande` fusionne dans le guichet

**Files:**
- Modify: `app/creer-ma-demande/page.tsx` (devient un redirect)
- Modify: `app/mon-dossier/mon-dossier-client.tsx` (fallback IA du champ de recherche)
- Modify: `app/outils/outils-catalog-client.tsx` (2 liens vers `/creer-ma-demande`)

**Interfaces:**
- Consumes: `IntentSearch` (`components/docbel/onboarding/intent-search.tsx`, POST `/api/intent-detect`) — réutilisé, pas dupliqué.

- [ ] **Step 1 — Redirect.** `app/creer-ma-demande/page.tsx` : remplacer tout le rendu par `redirect("/mon-dossier");` (imports nettoyés). Les composants qu'elle était seule à monter (`LifeEventCard`…) restent en place (morts = OK, nettoyage éventuel dans CLEANUP_QUEUE — ne pas supprimer dans ce lot).
- [ ] **Step 2 — Fallback IA.** Dans le guichet (`mon-dossier-client.tsx`), quand la recherche locale de l'étape 1 du wizard ou du catalogue ne retourne RIEN : afficher sous l'état vide un bloc « Décrivez votre situation avec vos mots » qui monte `IntentSearch` (déjà autonome : champ + suggestions → `/d/{slug}`). Vérifier que `IntentSearch` dégrade proprement quand l'IA est OFF (cf. NEXT_ACTIONS #10) — si non, le wrapper dans un try/état d'erreur silencieux.
- [ ] **Step 3 — Rebrancher les entrées.** Dans `/outils` (`outils-catalog-client.tsx`), les 2 liens vers `/creer-ma-demande` (pill « Documents » + carte d'aide) → `/mon-dossier`.
- [ ] **Step 4 — Validation** : `pnpm build` → exit 0. Écrans : `/creer-ma-demande` → redirige ; recherche guichet sans résultat → bloc IA ; `/outils` → liens corrects.
- [ ] **Step 5 — Commit** : `git add app/creer-ma-demande/page.tsx app/mon-dossier/mon-dossier-client.tsx app/outils/outils-catalog-client.tsx` → `feat(dossier): fusion de /creer-ma-demande dans le guichet (redirect + fallback IA)`

---

## Après chaque lot

- `pnpm test` + `pnpm build` + `pnpm i18n:check` verts, `pnpm lint` sans NOUVELLE erreur.
- Vérifier au navigateur (desktop + mobile) les écrans listés par les tâches du lot.
- Fin de lot = état livrable : Oraliks pousse main quand il veut.

## Hors périmètre (assumé, ne pas « améliorer » en passant)

- Ré-affichage du code de reprise après la session de création (hash seul en DB — backend nouveau).
- Téléchargement partiel d'un document complété (décision produit : NON, tout-ou-rien).
- Date imprimée sur les PDF re-téléchargés (= date du jour, pas celle de la validation).
- Récupération des démarches abandonnées ; plafond 20 démarches sans chemin guidé.
- Traductions non-FR des clés nouvelles/modifiées (fallback FR ; signaler aux traducteurs, registre NL « u »).
