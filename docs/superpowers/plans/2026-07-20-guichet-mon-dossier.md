# Refonte guichet `/mon-dossier` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps en syntaxe checkbox (`- [ ]`).

**Goal:** Faire de `/mon-dossier` un guichet unique et sans doublon avec `/mes-demarches` : miroir « Dossier en cours » → bandeau de reprise, titre unique « Qu'est-ce qui vous arrive ? », une recherche universelle fusionnant situations + dossiers.

**Architecture:** La recherche universelle est portée par le parent `mon-dossier-client.tsx` (qui a déjà `situations` ET `catalog`) : l'état `search` existant du catalogue devient la barre unique ; en plus des dossiers (`searchResults` existant, scoring conservé) elle filtre les situations via une **fonction pure testée** `matchSituations`. L'assistant (`DossierWizard`) perd son en-tête et sa propre barre (nouvelle prop `hideHeader`), il ne garde que les pills + tuiles. Le clic sur une situation-résultat réutilise le mécanisme `presetSituation` (Task 0.6). Design validé sur maquette + spec `docs/superpowers/specs/2026-07-20-guichet-mon-dossier-design.md`.

**Tech Stack:** Next 16 (App Router, server + client components), React 19, next-intl 4, vitest, Tailwind 4 + glass mauve public.

## Global Constraints

- Validation : `pnpm test` (vitest) · `pnpm build` (build+typecheck, PAS de `pnpm typecheck`) · `pnpm i18n:check` · `pnpm lint` (~74 erreurs PRÉ-EXISTANTES, ne pas en ajouter).
- Front glass mauve : jamais `bg-white`/`#FFFFFF` en dur ; tokens `--glass-*` / `.glass-surface` ; pas de `max-w-*`/`mx-auto` sur la racine d'une page front.
- i18n : textes user-facing via `useTranslations` ; `messages/fr.json` = **CRLF avec doublons** → insertions/remplacements SURGICAUX (Edit ciblé, jamais réécrire le fichier) ; ne jamais supprimer une clé (fallback FR des autres locales).
- ESLint refuse `setState` synchrone dans un `useEffect` → init lazy de `useState`.
- `git add` de chemins EXPLICITES uniquement (workdir partagé multi-agents) ; commit à chaque tâche ; **jamais `git push`** (Oraliks pousse) ; jamais `--force`.
- Toute commande `git`/`pnpm` en Bash : `dangerouslyDisableSandbox: true` (le sandbox réverte les fichiers suivis).
- Aucune migration DB. Ownership inchangée. `/mes-demarches` reste propriétaire de la liste des démarches en cours (hors périmètre).

## Ordre : Task 1 → 2 → 3 → 4 → 5.

---

### Task 1: Fonction pure `matchSituations` + test (TDD)

**Files:**
- Create: `lib/dossier-wizard/match-situations.ts`
- Test: `lib/dossier-wizard/__tests__/match-situations.test.ts`

**Interfaces:**
- Produces: `interface SituationSearchItem { value: string; text: string }` ; `matchSituations(query: string, items: SituationSearchItem[]): string[]` (renvoie les `value` matchés ; requête vide → `[]`). Consommé en Task 4.

- [ ] **Step 1 — Écrire le test (RED).** Créer `lib/dossier-wizard/__tests__/match-situations.test.ts` :
```ts
import { describe, it, expect } from "vitest";
import { matchSituations } from "../match-situations";

const items = [
  { value: "perte-emploi", text: "J'ai perdu mon emploi licenciement chômage" },
  { value: "insertion", text: "Je cherche un premier emploi insertion études" },
  { value: "sante", text: "Je suis en incapacité de travail maladie santé" },
];

describe("matchSituations", () => {
  it("requête vide → aucune situation", () => {
    expect(matchSituations("", items)).toEqual([]);
    expect(matchSituations("   ", items)).toEqual([]);
  });
  it("matche label + mots-clés, insensible à la casse", () => {
    expect(matchSituations("EMPLOI", items)).toEqual(["perte-emploi", "insertion"]);
  });
  it("insensible aux accents", () => {
    expect(matchSituations("sante", items)).toEqual(["sante"]);
    expect(matchSituations("santé", items)).toEqual(["sante"]);
  });
  it("aucun match → tableau vide (déclenche le secours IA)", () => {
    expect(matchSituations("zzzznexistepas", items)).toEqual([]);
  });
});
```
- [ ] **Step 2 — Lancer, voir échouer.** `pnpm vitest run lib/dossier-wizard/__tests__/match-situations.test.ts` → FAIL (`Cannot find module '../match-situations'`).
- [ ] **Step 3 — Implémenter (GREEN).** Créer `lib/dossier-wizard/match-situations.ts` :
```ts
/// Filtre PUR des situations pour la recherche universelle du guichet
/// (/mon-dossier). Insensible à la casse et aux accents. Aucune dépendance
/// React/i18n : l'appelant construit `text` (label + description résolus).

export interface SituationSearchItem {
  value: string;
  text: string;
}

const normalize = (s: string): string =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/// Renvoie les `value` des situations dont le texte contient la requête.
/// Requête vide/espaces → `[]` (le guichet montre alors la vue par défaut).
export function matchSituations(
  query: string,
  items: SituationSearchItem[],
): string[] {
  const q = normalize(query.trim());
  if (!q) return [];
  return items.filter((it) => normalize(it.text).includes(q)).map((it) => it.value);
}
```
- [ ] **Step 4 — Lancer, voir passer.** `pnpm vitest run lib/dossier-wizard/__tests__/match-situations.test.ts` → 4/4 PASS.
- [ ] **Step 5 — Commit.**
```bash
git add lib/dossier-wizard/match-situations.ts lib/dossier-wizard/__tests__/match-situations.test.ts
git commit -m "feat(dossier): matchSituations, filtre pur des situations (recherche universelle guichet)"
```

---

### Task 2: `DossierWizard` — prop `hideHeader` (en-tête + libellé + barre de l'assistant masqués)

**Files:**
- Modify: `components/docbel/onboarding/dossier-wizard.tsx` (Props ; en-tête `wizardAssistantTitle` ~l.343-363 ; `StepSituation` : libellé `wizardSituationQuestion` ~l.501-508 + barre de recherche ~l.510-521)

**Interfaces:**
- Produces: `DossierWizardProps` gagne `hideHeader?: boolean` (défaut `false`). `StepSituation` gagne `hideSearch?: boolean`. Consommés en Task 4. Défaut `false` → `components/decision-builder/simulation-panel.tsx` (`dryRun`) inchangé.

- [ ] **Step 1 — Lire** `dossier-wizard.tsx` en entier ; repérer : l'interface des props du composant `DossierWizard`, le bloc en-tête (`t("wizardAssistantTitle")` + sous-titre `wizardAssistantSubtitle`), et `StepSituation` (le `<Label>{t("wizardSituationQuestion")}</Label>` + la `<label>`/`<input>` de recherche + le `useState("")` de `query`).
- [ ] **Step 2 — Ajouter la prop `hideHeader`.** Dans l'interface des props de `DossierWizard`, ajouter `hideHeader?: boolean;`. Dans la destructuration du composant, ajouter `hideHeader = false,`.
- [ ] **Step 3 — Masquer l'en-tête.** Envelopper le bloc en-tête de l'assistant (le `CardHeader`/`div` contenant `t("wizardAssistantTitle")` + `t("wizardAssistantSubtitle")`) dans `{!hideHeader && ( … )}`. Ne PAS toucher au `wizardStepAnnounce` (l'annonce d'étape sr-only reste).
- [ ] **Step 4 — Propager à `StepSituation`.** À l'interface `StepSituationProps`, ajouter `hideSearch?: boolean;` + destructurer `hideSearch = false,`. Au call-site de `StepSituation` (rendu de l'étape 1), passer `hideSearch={hideHeader}`.
- [ ] **Step 5 — Masquer libellé + barre dans `StepSituation`.** Envelopper le `<Label>{t("wizardSituationQuestion")}</Label>` + son `<p>{t("wizardSituationHelp")}</p>` dans `{!hideSearch && ( … )}`. Envelopper la `<label>`…`<input … placeholder={t("searchPlaceholder")} …>`…`</label>` (la barre de recherche de situations) dans `{!hideSearch && ( … )}`. Les pills thématiques + la grille de tuiles restent TOUJOURS rendues. (Quand `hideSearch`, `query` reste `""` → le filtrage retombe sur le thème actif, ce qui est voulu.)
- [ ] **Step 6 — Exporter les helpers pour le parent.** Ajouter `export` devant le `function resolveText(…)` et la fonction `resolveIcon(…)` (helpers locaux du fichier) : ils seront importés par `mon-dossier-client.tsx` en Task 4 pour rendre les tuiles de situation dans les résultats. (Si `resolveIcon` n'existe pas sous ce nom exact, exporter la fonction équivalente qui mappe `s.icon` → composant lucide.)
- [ ] **Step 7 — Validation** : `pnpm exec eslint components/docbel/onboarding/dossier-wizard.tsx` → aucune NOUVELLE erreur ; `pnpm build` → exit 0 (l'assistant compile, `hideHeader` pas encore utilisé).
- [ ] **Step 8 — Commit.**
```bash
git add components/docbel/onboarding/dossier-wizard.tsx
git commit -m "feat(dossier): DossierWizard prop hideHeader + export resolveText/resolveIcon"
```

---

### Task 3: `/mon-dossier` — bandeau de reprise (retrait du miroir) + retarget HelpRow

**Files:**
- Modify: `app/mon-dossier/mon-dossier-client.tsx` (section `#dossier-en-cours` ~l.428-442 ; HelpRow « Où en est ma demande ? »)
- Modify: `messages/fr.json` (`public.dossier` : nouvelles clés bandeau)

**Interfaces:**
- Consumes: `activeRuns: ActiveBundleRun[]` (déjà en props) ; `t` (`useTranslations("public.dossier")`).

- [ ] **Step 1 — Clés i18n** (insertion surgicale dans `public.dossier`, à côté de `ongoingDossier` — grep `"ongoingDossier"` pour la localiser) :
```json
      "resumeBannerTitle": "Vous avez {count, plural, one {1 démarche en cours} other {# démarches en cours}}",
      "resumeBannerCta": "Reprendre",
```
- [ ] **Step 2 — Retirer le miroir.** Dans `mon-dossier-client.tsx`, supprimer intégralement la `<section id="dossier-en-cours" …>…</section>` (le h2 `ongoingDossier` + compteur + liste `activeRuns.map(ActiveRunCard)` + lien `seeAllDemarches`). Si `ActiveRunCard` n'est plus utilisé nulle part ailleurs dans le fichier après ça (grep `ActiveRunCard`), le laisser défini (mort = OK, ne pas supprimer dans ce lot) OU retirer sa définition + ses imports devenus inutiles si c'est propre — vérifier eslint.
- [ ] **Step 3 — Bandeau de reprise.** Juste après le `</header>` (et avant la section guichet), insérer :
```tsx
      {activeRuns.length > 0 && (
        <Link
          href="/mes-demarches"
          className="glass-surface flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors hover:bg-[color:var(--glass-pop-bg)]/40"
        >
          <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--glass-pop-bg)] text-[color:var(--glass-accent-deep)]">
            <RotateCcw className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-[color:var(--glass-ink)]">
              {t("resumeBannerTitle", { count: activeRuns.length })}
            </span>
            <span className="block truncate text-xs text-[color:var(--glass-ink-soft)]">
              {activeRuns.map((r) => r.bundleName).join(" · ")}
            </span>
          </span>
          <span className="shrink-0 text-sm font-bold text-[color:var(--glass-accent-deep)]">
            {t("resumeBannerCta")} →
          </span>
        </Link>
      )}
```
⚠ Vérifier que `RotateCcw` est importé (sinon l'ajouter à l'import `lucide-react` du fichier) et que `ActiveBundleRun` expose bien `bundleName` (grep le type ; sinon utiliser le champ nom réel).
- [ ] **Step 4 — Retarget HelpRow.** Grep `helpWhereIsRequest` dans le fichier : la `<HelpRow … href="#dossier-en-cours" />` (Task 0.5) pointe vers la section supprimée → changer `href="#dossier-en-cours"` en `href="/mes-demarches"`.
- [ ] **Step 5 — Validation** : `pnpm build` → exit 0 ; `pnpm i18n:check` → exit 0. Écran : `/mon-dossier` avec ≥1 run en cours → bandeau ; sans run → pas de bandeau ; plus de bloc « Dossier en cours ».
- [ ] **Step 6 — Commit.**
```bash
git add app/mon-dossier/mon-dossier-client.tsx messages/fr.json
git commit -m "feat(dossier): bandeau reprise sur /mon-dossier (retrait du miroir Dossier en cours)"
```

---

### Task 4: `/mon-dossier` — titre unique + recherche universelle (situations + dossiers)

**Files:**
- Modify: `app/mon-dossier/mon-dossier-client.tsx` (en-tête/h1 ; state `presetSituation` ~l.282 ; barre de recherche du catalogue ~l.473-483 ; rendu guichet ~l.444-459 + catalogue ~l.461-581)
- Modify: `messages/fr.json` (`public.dossier` : placeholder + libellés de groupes ; h1)

**Interfaces:**
- Consumes: `matchSituations` (Task 1) ; `DossierWizard hideHeader` (Task 2) ; symboles existants `situations`, `bundles`/`catalog`, `search`/`setSearch`, `trimmed`, `isSearching`, `searchResults`, `visibleGroups`, `empty`, `AccessRow`, `IntentSearch`, `WizardSituation`, la fonction d'icône/label des situations.

- [ ] **Step 1 — Lire** `mon-dossier-client.tsx` en entier : bien repérer la barre de recherche du catalogue (l'`InputGroup`/`InputGroupInput` ~l.473-483), le bloc de rendu du catalogue (empty / isSearching / groups ~l.530-564), le `<DossierWizard … />` (~l.444-459), et comment les situations exposent label/description/icône (cf. `StepSituation` de `dossier-wizard.tsx` : `resolveText(tc, s.labelKey, s.label)` + `resolveText(tc, s.descriptionKey, s.description)` + `resolveIcon(s.icon)`).
- [ ] **Step 2 — Ré-activer le setter `presetSituation`.** Remplacer `const [presetSituation] = useState<string | null>(validInitialSituation);` par `const [presetSituation, setPresetSituation] = useState<string | null>(validInitialSituation);`.
- [ ] **Step 3 — Index + match des situations.** Ajouter en tête du composant `const tc = useTranslations("public.dossierContent");` et l'import `import { resolveText, resolveIcon } from "@/components/docbel/onboarding/dossier-wizard";` (exportés en Task 2). Après les `useMemo` du catalogue, ajouter :
```ts
  const situationIndex = useMemo(
    () => situations.map((s) => ({
      value: s.value,
      text: `${resolveText(tc, s.labelKey, s.label)} ${resolveText(tc, s.descriptionKey, s.description ?? "")}`,
    })),
    [situations, tc],
  );
  const matchedSituationValues = useMemo(
    () => matchSituations(search, situationIndex),
    [search, situationIndex],
  );
  const matchedSituations = useMemo(
    () => situations.filter((s) => matchedSituationValues.includes(s.value)),
    [situations, matchedSituationValues],
  );
```
- [ ] **Step 4 — `pickSituation`.** Ajouter un handler :
```ts
  // Une situation choisie depuis les RÉSULTATS de recherche : on préremplit
  // l'assistant (remonté à l'étape 2 via presetSituation/key, cf. Task 0.6) et
  // on vide la recherche pour revenir à la vue par défaut (l'assistant visible).
  const pickSituation = (value: string) => {
    setPresetSituation(value);
    setSearch("");
  };
```
- [ ] **Step 5 — Titre unique (h1).** Dans le `<header>`, remplacer le h1 `monDossierTitle` par le titre du guichet en `t.rich` (accent italique, modèle des pages sœurs) :
```tsx
          <h1 className="glass-display max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
            {t.rich("guichetTitle", { em: (chunks) => <em>{chunks}</em> })}
          </h1>
```
et changer la valeur fr.json `guichetTitle` en `"Qu'est-ce qui <em>vous arrive</em> ?"` (Edit surgical ; `guichetTitle` reste utilisé, ne pas supprimer). Conserver/ajuster l'intro `monDossierIntro` sous le h1. Supprimer le h2 `guichetTitle` séparé de la section guichet (il devient le h1) et le h2 `guichetBrowseAll` reste sur la section catalogue.
- [ ] **Step 6 — Barre de recherche universelle en haut.** Déplacer/creuser l'`InputGroup` du catalogue vers le HAUT du guichet (juste sous le bandeau/au-dessus de l'assistant), avec un placeholder universel :
```tsx
      <InputGroup className="min-h-14 rounded-2xl">
        <InputGroupAddon><SearchIcon aria-hidden /></InputGroupAddon>
        <InputGroupInput
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("guichetSearchPlaceholder")}
          aria-label={t("guichetSearchPlaceholder")}
          className="text-base"
        />
      </InputGroup>
```
Retirer l'ancienne `InputGroup` de la section catalogue (elle est remplacée par celle-ci). Clé fr.json à ajouter : `"guichetSearchPlaceholder": "Décrivez votre situation, ou cherchez un dossier…"`. ⚠ Envelopper cette barre + la zone résultats/défaut (Step 7) dans un `<div id="guichet">` — c'est la cible de l'ancre `#guichet` (HelpRow « Trouver le bon dossier », Task 4.1).
- [ ] **Step 7 — Bascule vue par défaut / résultats.** Restructurer le corps sous la barre en :
```tsx
      {isSearching ? (
        // ===== RÉSULTATS FUSIONNÉS =====
        matchedSituations.length === 0 && searchResults.length === 0 ? (
          <div className="glass-surface flex flex-col gap-3 rounded-3xl p-5">
            <h3 className="text-sm font-bold text-[color:var(--glass-ink)]">{t("intentFallbackTitle")}</h3>
            <IntentSearch />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {matchedSituations.length > 0 && (
              <section className="flex flex-col gap-3">
                <h3 className="flex items-center gap-2 text-lg font-bold text-[color:var(--glass-ink)]">
                  {t("guichetResultsSituations")}
                  <span className="rounded-full bg-[color:var(--glass-pop-bg)] px-3 py-1 text-sm text-[color:var(--glass-accent-deep)]">{matchedSituations.length}</span>
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {matchedSituations.map((s) => (
                    <button key={s.value} type="button" onClick={() => pickSituation(s.value)}
                      className="flex items-center gap-3 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-4 text-left transition hover:-translate-y-px">
                      <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--glass-pop-bg)]">{resolveIcon(s.icon)}</span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-[color:var(--glass-ink)]">{resolveText(tc, s.labelKey, s.label)}</span>
                        <span className="block truncate text-xs text-[color:var(--glass-ink-soft)]">{resolveText(tc, s.descriptionKey, s.description ?? "")}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}
            {searchResults.length > 0 && (
              <section className="flex flex-col gap-3">
                <h3 className="flex items-center gap-2 text-lg font-bold text-[color:var(--glass-ink)]">
                  {t("guichetResultsDossiers")}
                  <span className="rounded-full bg-[color:var(--glass-pop-bg)] px-3 py-1 text-sm text-[color:var(--glass-accent-deep)]">{searchResults.length}</span>
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {searchResults.map((bundle) => <AccessRow key={bundle.slug} bundle={bundle} />)}
                </div>
              </section>
            )}
          </div>
        )
      ) : (
        // ===== VUE PAR DÉFAUT =====
        <div className="flex flex-col gap-8">
          <DossierWizard
            key={presetSituation ?? "none"}
            hideHeader
            situations={situations}
            catalog={catalog}
            initialSituation={presetSituation ?? undefined}
          />
          {/* La section catalogue « Parcourir tous les dossiers » (tools + tris/filtres + visibleGroups) reste ICI, MAIS sans sa barre de recherche (déplacée en haut) et sans le bloc empty/IntentSearch en double (le secours IA est géré ci-dessus dans les résultats). */}
        </div>
      )}
```
⚠ `resolveIcon` renvoie un composant/icône : adapter le rendu (`{resolveIcon(s.icon)}` peut nécessiter `const Icon = resolveIcon(s.icon); <Icon className="size-5" />` selon sa signature — cf. `StepSituation`). Reprendre EXACTEMENT le pattern de `StepSituation`.
- [ ] **Step 8 — Clés i18n groupes** (surgical `public.dossier`) : `"guichetResultsSituations": "Situations",` · `"guichetResultsDossiers": "Dossiers",`.
- [ ] **Step 9 — Nettoyer.** Retirer les imports/vars devenus inutiles (l'ancien h1 `monDossierTitle` s'il n'est plus utilisé ; l'ancienne `InputGroup` du catalogue). Vérifier qu'aucun symbole retiré n'est encore référencé (grep).
- [ ] **Step 10 — Validation** : `pnpm build` → exit 0 ; `pnpm test` → verts ; `pnpm i18n:check` → exit 0 ; `pnpm exec eslint app/mon-dossier/mon-dossier-client.tsx` → aucune NOUVELLE erreur. Écrans : `/mon-dossier` vide → h1 unique + barre + assistant (tuiles, sans en-tête ni sa barre) + catalogue dessous ; taper « emploi » → groupes Situations + Dossiers ; clic situation → assistant à l'étape 2 ; clic dossier → `/d/{slug}` ; « zzz » → secours IA ; `?situation=…` → assistant préouvert étape 2 (inchangé).
- [ ] **Step 11 — Commit.**
```bash
git add app/mon-dossier/mon-dossier-client.tsx messages/fr.json
git commit -m "feat(dossier): guichet /mon-dossier - titre unique + recherche universelle (situations + dossiers)"
```

---

### Task 5: Adapter la spec e2e + validation de fin

**Files:**
- Modify: `tests/e2e/mon-dossier/mon-dossier.spec.ts`

- [ ] **Step 1 — Adapter l'e2e.** La spec (réécrite au Lot 4 précédent) assume l'ancien catalogue avec sa propre barre. Mettre à jour pour la nouvelle structure : h1 « Qu'est-ce qui vous arrive ? » ; UNE barre de recherche (`getByRole("searchbox")` au niveau page, plus scopée au catalogue) ; taper une requête → vérifier l'apparition des groupes « Situations » / « Dossiers » ; taper un terme sans résultat → secours IA « Décrivez votre situation avec vos mots » (`intentFallbackTitle`). Garder le test « ouvrir un dossier → /d/[slug] » (via un résultat dossier). ⚠ Non rejouable ici (pas de dev server) — aligner les sélecteurs sur les valeurs i18n réelles et documenter en tête « à confirmer au prochain `pnpm test:e2e` ».
- [ ] **Step 2 — Validation de fin (boundary)** : `pnpm build` → exit 0 ; `pnpm test` → verts (dont `match-situations`) ; `pnpm i18n:check` → exit 0 ; `pnpm lint` → aucune NOUVELLE erreur (mesurer le delta vs ~74).
- [ ] **Step 3 — Commit.**
```bash
git add tests/e2e/mon-dossier/mon-dossier.spec.ts
git commit -m "test(e2e): mon-dossier spec adaptee au guichet a recherche universelle"
```

---

## Après le plan
- État livrable : Oraliks relit + pousse (jamais de push automatique).
- QA visuelle navigateur (guichet vide/rempli, recherche, mobile, thème) = Oraliks.
- Suivi : `filterGuichet` du spec est réalisé comme `matchSituations` (situations) + réutilisation du `searchResults` existant (dossiers) — refinement assumé.
