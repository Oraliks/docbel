# Refonte « Réglementation chômage » (RioLex) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refondre les 2 écrans partenaire du corpus RioLex (liste de recherche + fiche article) pour une structure lisible : cartes typées par nature, fiche 2 colonnes avec panneau collant, texte de loi structuré, commentaire ONEM en accordéon.

**Architecture:** Deux pages Next séparées, pleine largeur. Le backend (API recherche, gating `visibility`) est INCHANGÉ. Un parseur PUR (`lib/reglementation/`) transforme le texte légal brut en blocs typographiés et découpe le commentaire ONEM ; des composants présentables (`components/reglementation/`) consomment ces blocs et les données déjà renvoyées par l'API / la page serveur.

**Tech Stack:** Next 16 (App Router, RSC) · React 19 · Tailwind 4 · shadcn (base-ui) · next-intl 4 · vitest (tests du parseur pur).

## Global Constraints

- Espace partenaire = **palette shadcn/ProShell, JAMAIS de glass** (`.glass-*`/`backdrop-filter` interdits ici). Dark = shadcn slate, pas le néon public.
- **Pleine largeur** : racine de page `px-4 py-6 lg:px-6`, **aucun `max-w-*` étroit** sur la racine (retirer les `max-w-5xl`/`max-w-4xl` actuels). Seule la colonne de texte de loi plafonne sa longueur de ligne (`max-w-[72ch]`) pour la lisibilité.
- Natures réelles = **`AR` · `AM` · `Loi-programme` · `Loi` · `Arrete-loi`** (pas de « Circulaire »).
- Surlignage `ts_headline` : reconstruire les `<mark>` en **JSX** ; **jamais** `dangerouslySetInnerHTML`.
- **next-intl** : tout libellé user-facing via clés typées `public.pro.regl*` (fr/nl/en ; autres locales = fallback FR). Une clé absente casse `tsc`/`i18n:check`.
- **Pas de nouvelle dépendance.** Réutiliser `components/ui/*` existants (Card, Badge, Select, Accordion, Collapsible, Separator, Skeleton, Button, Input).
- Ne PAS aggraver le lint (`~74` erreurs pré-existantes). Objectif : `tsc` 0 erreur, `pnpm build` vert, `pnpm i18n:check` OK.
- Action fiche V1 = **Imprimer** seulement (Favori/Exporter = backlog, aucun bouton mort).
- Commits fréquents, chemins `git add` **explicites** (workdir partagé), jamais `-A`.

---

### Task 1: Mapping des natures juridiques (`nature.ts`)

Source unique nature → libellé + icône + classes de couleur, réutilisée par cartes, badge, légende, sidebar.

**Files:**
- Create: `lib/reglementation/nature.ts`
- Test: `lib/reglementation/__tests__/nature.test.ts`

**Interfaces:**
- Produces:
  - `type NatureKey = "AR" | "AM" | "Loi-programme" | "Loi" | "Arrete-loi"`
  - `interface NatureMeta { key: NatureKey; short: string; label: string; icon: LucideIcon; accent: string; tile: string; }` (`accent` = classe liseré/point ; `tile` = classes pastille d'icône)
  - `function natureMeta(raw: string | null | undefined): NatureMeta` (fallback sur une entrée « autre » neutre si inconnu — jamais d'exception)
  - `const NATURE_ORDER: NatureKey[]` (ordre stable pour la légende)

- [ ] **Step 1: Write the failing test**

```ts
// lib/reglementation/__tests__/nature.test.ts
import { describe, it, expect } from "vitest";
import { natureMeta, NATURE_ORDER } from "../nature";

describe("natureMeta", () => {
  it("mappe les 5 natures réelles avec libellé + icône", () => {
    for (const k of ["AR", "AM", "Loi-programme", "Loi", "Arrete-loi"] as const) {
      const m = natureMeta(k);
      expect(m.key).toBe(k);
      expect(m.label.length).toBeGreaterThan(0);
      expect(m.icon).toBeTypeOf("function");
      expect(m.accent).toContain("bg-"); // classe tailwind présente
    }
  });
  it("fallback neutre (sans exception) sur une nature inconnue", () => {
    const m = natureMeta("Circulaire");
    expect(m.label.length).toBeGreaterThan(0);
    expect(m.icon).toBeTypeOf("function");
  });
  it("NATURE_ORDER couvre exactement les 5 natures", () => {
    expect([...NATURE_ORDER].sort()).toEqual(
      ["AM", "AR", "Arrete-loi", "Loi", "Loi-programme"].sort(),
    );
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `pnpm exec vitest run lib/reglementation/__tests__/nature.test.ts`
Expected: FAIL (module `../nature` introuvable).

- [ ] **Step 3: Implement `lib/reglementation/nature.ts`**

```ts
import { Landmark, Scale, FileText, Gavel, BookText, type LucideIcon } from "lucide-react";

export type NatureKey = "AR" | "AM" | "Loi-programme" | "Loi" | "Arrete-loi";

export interface NatureMeta {
  key: NatureKey;
  short: string;      // badge court (ex. "AR")
  label: string;      // libellé légende (ex. "Arrêté royal")
  icon: LucideIcon;
  accent: string;     // liseré gauche + point statut neutre (classe bg-*)
  tile: string;       // pastille d'icône : classes bg + text
}

export const NATURE_ORDER: NatureKey[] = ["AR", "AM", "Loi-programme", "Loi", "Arrete-loi"];

// Couleurs via échelles Tailwind neutres/vives cohérentes ProShell (pas de hex en dur criard).
const MAP: Record<NatureKey, NatureMeta> = {
  AR:             { key: "AR",             short: "AR",  label: "Arrêté royal",       icon: Landmark, accent: "bg-indigo-500", tile: "bg-indigo-50 text-indigo-600" },
  AM:             { key: "AM",             short: "AM",  label: "Arrêté ministériel", icon: Scale,    accent: "bg-amber-500",  tile: "bg-amber-50 text-amber-600" },
  "Loi-programme":{ key: "Loi-programme",  short: "L-P", label: "Loi-programme",      icon: FileText, accent: "bg-violet-500", tile: "bg-violet-50 text-violet-600" },
  Loi:            { key: "Loi",            short: "Loi", label: "Loi",                icon: BookText, accent: "bg-sky-500",    tile: "bg-sky-50 text-sky-600" },
  "Arrete-loi":   { key: "Arrete-loi",     short: "AL",  label: "Arrêté-loi",         icon: Gavel,    accent: "bg-slate-500",  tile: "bg-slate-100 text-slate-600" },
};

const FALLBACK: NatureMeta = {
  key: "Loi", short: "—", label: "Autre texte", icon: FileText,
  accent: "bg-slate-400", tile: "bg-slate-100 text-slate-600",
};

export function natureMeta(raw: string | null | undefined): NatureMeta {
  if (raw && raw in MAP) return MAP[raw as NatureKey];
  return FALLBACK;
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `pnpm exec vitest run lib/reglementation/__tests__/nature.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/reglementation/nature.ts lib/reglementation/__tests__/nature.test.ts
git commit -m "feat(reglementation): mapping natures juridiques (icône/couleur/libellé)"
```

---

### Task 2: Parseur de texte légal + découpe commentaire ONEM (`parse-legal-text.ts`)

Cœur logique de la refonte. PUR, tolérant (jamais d'exception).

**Files:**
- Create: `lib/reglementation/parse-legal-text.ts`
- Test: `lib/reglementation/__tests__/parse-legal-text.test.ts`

**Interfaces:**
- Produces:
  - `type LegalBlock = { type: "section" | "paragraph" | "list-item" | "abroge"; marker?: string; text: string }`
  - `function parseLegalText(raw: string): LegalBlock[]`
    - Ligne commençant par `§ N.` / `§ 1er.` → `{ type:"section", marker:"§ 1er", text:"…reste…" }`
    - Ligne commençant par `1°`, `2°`, `- ` → `{ type:"list-item", marker, text }`
    - Ligne (ou texte) commençant par `[Abrogé` → `{ type:"abroge", text }`
    - Sinon → `{ type:"paragraph", text }`
    - Regroupe les lignes vides ; un texte vide → `[]`.
  - `type OnemComment = { index: number; date: string | null; institution: string | null; text: string }`
  - `function splitOnemCommentary(raw: string): OnemComment[]`
    - Découpe sur `Commentaire N` ; extrait une date `(JJ/MM/AAAA)` et une institution `(…)` si présentes en tête ; si aucun marqueur `Commentaire` → un seul bloc `index:1`.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/reglementation/__tests__/parse-legal-text.test.ts
import { describe, it, expect } from "vitest";
import { parseLegalText, splitOnemCommentary } from "../parse-legal-text";

describe("parseLegalText", () => {
  it("texte vide → []", () => {
    expect(parseLegalText("")).toEqual([]);
    expect(parseLegalText("   \n  ")).toEqual([]);
  });

  it("détecte les paragraphes § et les alinéas numérotés", () => {
    const raw = [
      "§ 1er. Le chômeur complet doit être disponible.",
      "",
      "§ 2. Le Roi peut, par arrêté délibéré :",
      "1° les catégories concernées ;",
      "2° les conditions.",
    ].join("\n");
    const blocks = parseLegalText(raw);
    expect(blocks[0]).toMatchObject({ type: "section", marker: "§ 1er" });
    expect(blocks.find((b) => b.type === "section" && b.marker === "§ 2")).toBeTruthy();
    const items = blocks.filter((b) => b.type === "list-item");
    expect(items).toHaveLength(2);
    expect(items[0].marker).toBe("1°");
  });

  it("détecte les listes à tirets", () => {
    const blocks = parseLegalText("- une semaine ;\n- six semaines ;");
    expect(blocks.filter((b) => b.type === "list-item")).toHaveLength(2);
  });

  it("marque un article abrogé", () => {
    const blocks = parseLegalText("[Abrogé. (AM 5.3.2006 - MB 15.3)]");
    expect(blocks[0].type).toBe("abroge");
  });

  it("ne jette jamais (entrée bizarre → au moins 1 bloc paragraphe)", () => {
    const blocks = parseLegalText("texte sans structure particulière 123 %%%");
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    expect(blocks[0].type).toBe("paragraph");
  });
});

describe("splitOnemCommentary", () => {
  it("découpe plusieurs 'Commentaire N' avec date/institution", () => {
    const raw = [
      "Commentaire 1",
      "(23/04/2018) (Gouvernement fédéral)",
      "Les préavis notifiés avant le 1.5.2018 continuent.",
      "Commentaire 2",
      "(01/01/2020) (ONEM)",
      "Autre précision.",
    ].join("\n");
    const cs = splitOnemCommentary(raw);
    expect(cs).toHaveLength(2);
    expect(cs[0].index).toBe(1);
    expect(cs[0].date).toBe("23/04/2018");
    expect(cs[0].institution).toBe("Gouvernement fédéral");
    expect(cs[0].text).toContain("préavis");
  });

  it("aucun marqueur → un seul bloc", () => {
    const cs = splitOnemCommentary("Simple note sans marqueur.");
    expect(cs).toHaveLength(1);
    expect(cs[0].index).toBe(1);
  });

  it("vide → []", () => {
    expect(splitOnemCommentary("")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `pnpm exec vitest run lib/reglementation/__tests__/parse-legal-text.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 3: Implement `lib/reglementation/parse-legal-text.ts`**

```ts
export type LegalBlock = {
  type: "section" | "paragraph" | "list-item" | "abroge";
  marker?: string;
  text: string;
};

const SECTION_RE = /^(§\s*\d+(?:er)?)\s*\.?\s*/;
const NUM_ITEM_RE = /^(\d+°(?:\/\d+)?|[a-z]\))\s+/;
const DASH_ITEM_RE = /^[-–]\s+/;

export function parseLegalText(raw: string): LegalBlock[] {
  const src = (raw ?? "").replace(/\r\n/g, "\n").trim();
  if (!src) return [];
  const blocks: LegalBlock[] = [];
  for (const rawLine of src.split(/\n+/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^\[Abrogé/i.test(line)) {
      blocks.push({ type: "abroge", text: line });
      continue;
    }
    const sec = SECTION_RE.exec(line);
    if (sec) {
      blocks.push({ type: "section", marker: sec[1].replace(/\s+/g, " ").trim(), text: line.slice(sec[0].length).trim() });
      continue;
    }
    const num = NUM_ITEM_RE.exec(line);
    if (num) {
      blocks.push({ type: "list-item", marker: num[1], text: line.slice(num[0].length).trim() });
      continue;
    }
    if (DASH_ITEM_RE.test(line)) {
      blocks.push({ type: "list-item", marker: "–", text: line.replace(DASH_ITEM_RE, "").trim() });
      continue;
    }
    blocks.push({ type: "paragraph", text: line });
  }
  return blocks;
}

export type OnemComment = {
  index: number;
  date: string | null;
  institution: string | null;
  text: string;
};

const COMMENT_SPLIT_RE = /^Commentaire\s+(\d+)\s*$/im;

export function splitOnemCommentary(raw: string): OnemComment[] {
  const src = (raw ?? "").replace(/\r\n/g, "\n").trim();
  if (!src) return [];
  // Découpe en gardant les entêtes "Commentaire N".
  const parts = src.split(/(?=^Commentaire\s+\d+\s*$)/im).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return [];
  if (parts.length === 1 && !COMMENT_SPLIT_RE.test(parts[0])) {
    return [{ index: 1, date: null, institution: null, text: parts[0] }];
  }
  return parts.map((part, i) => {
    const m = /^Commentaire\s+(\d+)\s*/i.exec(part);
    const index = m ? parseInt(m[1], 10) : i + 1;
    let rest = m ? part.slice(m[0].length).trim() : part;
    const dateM = /\((\d{2}\/\d{2}\/\d{4})\)/.exec(rest);
    const date = dateM ? dateM[1] : null;
    // 1re parenthèse non-date en tête = institution.
    const instM = /\(([^)]+)\)/g;
    let institution: string | null = null;
    let g: RegExpExecArray | null;
    while ((g = instM.exec(rest.slice(0, 120)))) {
      if (!/^\d{2}\/\d{2}\/\d{4}$/.test(g[1].trim())) { institution = g[1].trim(); break; }
    }
    return { index, date, institution, text: rest };
  });
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `pnpm exec vitest run lib/reglementation/__tests__/parse-legal-text.test.ts`
Expected: PASS (tous). Ajuster les regex si un cas échoue jusqu'au vert.

- [ ] **Step 5: Commit**

```bash
git add lib/reglementation/parse-legal-text.ts lib/reglementation/__tests__/parse-legal-text.test.ts
git commit -m "feat(reglementation): parseur texte légal + découpe commentaire ONEM (pur, testé)"
```

---

### Task 3: Composants de liste — `nature-badge`, `result-card`, `legend`

Présentables purs (props → JSX), réutilisables. Pas de test unitaire (vérif visuelle en Task 5).

**Files:**
- Create: `components/reglementation/nature-badge.tsx`
- Create: `components/reglementation/result-card.tsx`
- Create: `components/reglementation/legend.tsx`

**Interfaces:**
- Consumes: `natureMeta`, `NATURE_ORDER` (Task 1) ; le type `ResultItem` du client (défini Task 4).
- Produces:
  - `NatureBadge({ nature }: { nature: string })` — pastille d'icône (`tile`) + libellé court.
  - `ResultCard({ item }: { item: ResultItem })` — carte cliquable (Task 5 fournit `ResultItem`).
  - `RegLegend()` — légende natures + statuts.

- [ ] **Step 1: `nature-badge.tsx`** — pastille d'icône colorée (utilise `natureMeta(nature)`), rendu :

```tsx
import { natureMeta } from "@/lib/reglementation/nature";

export function NatureTile({ nature, className = "" }: { nature: string; className?: string }) {
  const m = natureMeta(nature);
  const Icon = m.icon;
  return (
    <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${m.tile} ${className}`} aria-hidden>
      <Icon className="size-4.5" />
    </span>
  );
}
```

- [ ] **Step 2: `result-card.tsx`** — carte de résultat. Structure exacte :
  - Wrapper `Card` en `relative overflow-hidden` ; liseré gauche = `<span className={\`absolute inset-y-0 left-0 w-1 ${natureMeta(item.natureJuridique).accent}\`} />`.
  - `CardContent` en `flex gap-3 py-3 pl-4` : `<NatureTile>` + colonne texte.
  - Ligne 1 : `<Link href={\`/partenaire/reglementation/${encodeURIComponent(item.riolexId)}\`}>` titre (font-medium) ; à droite badge statut : vert `en vigueur` (item.abroge=false) via `<Badge className="bg-emerald-100 text-emerald-700">` + point, ou `<Badge variant="destructive">Abrogé</Badge>`.
  - Ligne 2 (badges, `text-xs text-muted-foreground`) : `<Badge variant="outline">{item.loi}</Badge>`, `<Badge variant="secondary">Art. {item.articleNumber}</Badge>`, date EV si présente, lien RioLex (`item.sourceUrl`, `target="_blank"`).
  - Ligne 3 : extrait surligné si `item.headline` — via `renderHeadline` (déplacé ici depuis l'ancien search-client, ou importé — voir Task 5 ; ré-exporter `renderHeadline` depuis un util partagé `components/reglementation/highlight.tsx` pour éviter la duplication).
  - Créer `components/reglementation/highlight.tsx` exportant `renderHeadline(headline: string): ReactNode` (copie EXACTE de la fonction actuelle de `search-client.tsx` lignes 58-73, avec le même `<mark className="rounded-sm bg-primary/15 px-0.5 font-medium text-primary">`).

- [ ] **Step 3: `legend.tsx`** — `RegLegend()` : rangée `flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground` ; pour chaque `NATURE_ORDER` → `<NatureTile>` mini + `label` ; puis 2 points statut (emerald « En vigueur », rose/red « Abrogé »).

- [ ] **Step 4: Vérif compilation**

Run: `pnpm exec tsc --noEmit` → attendu : 0 nouvelle erreur (le type `ResultItem` sera importé de `search-client` défini en Task 5 ; pour compiler seul, définir `ResultItem` dans `highlight.tsx` ou un `types.ts` partagé — cf. Task 4 note).
Note d'implémentation : créer `components/reglementation/types.ts` avec l'interface `ResultItem` (copiée du route/search-client) et l'importer partout → évite les imports circulaires.

- [ ] **Step 5: Commit**

```bash
git add components/reglementation/nature-badge.tsx components/reglementation/result-card.tsx components/reglementation/legend.tsx components/reglementation/highlight.tsx components/reglementation/types.ts
git commit -m "feat(reglementation): composants liste (pastille nature, carte résultat, légende)"
```

---

### Task 4: Réécriture `search-client.tsx` + page liste pleine largeur

**Files:**
- Modify (réécriture): `components/reglementation/search-client.tsx`
- Modify: `app/partenaire/reglementation/page.tsx` (retirer `max-w-5xl`)

**Interfaces:**
- Consumes: `ResultCard`, `RegLegend`, `types.ts:ResultItem`, `natureMeta`.
- Produces: rien de nouveau (page).

- [ ] **Step 1: Extraire le type `ResultItem`** vers `components/reglementation/types.ts` (déjà créé Task 3). `search-client.tsx` l'importe au lieu de le redéfinir. Conserver `SearchResponse` (mode/results/total/page/pageSize/lois) dans `search-client.tsx`.

- [ ] **Step 2: Bandeau stats** — au-dessus de la barre de recherche, `grid gap-3 sm:grid-cols-3` de 3 `Card` :
  - « `{data?.total ?? "…"}` articles correspondants »
  - « `{data?.lois.length ?? "…"}` lois concernées »
  - « Recherche full-text + sémantique » + sous-texte `t("reglStatsHybridHint")`.
  (Pas d'appel API supplémentaire : on lit `data.total` / `data.lois`.)

- [ ] **Step 3: Filtres** — conserver la logique existante (débounce, `router.replace`, `AbortController`), ajouter un `Select` **tri** (`pertinence` | `article`) qui pose `?tri=` — MAIS comme l'API ne gère pas `tri`, l'appliquer **côté client** sur `data.results` (tri par `articleNumber` naturel si `tri=article`). Garder `loi`/`nature`/`statut`. Ajouter un bouton **Réinitialiser** (remet tout à `ALL`, `q=""`, `page=1`).

- [ ] **Step 4: Résultats** — remplacer les anciennes `Card` inline par `<ResultCard item={item} />`. Skeletons / empty / error inchangés. Ajouter `<RegLegend />` sous la pagination.

- [ ] **Step 5: Page pleine largeur** — dans `app/partenaire/reglementation/page.tsx`, remplacer `<div className="mx-auto w-full max-w-5xl space-y-6">` par `<div className="w-full space-y-6">` (conteneur parent garde `px-4 py-6 lg:px-6`). Titre + sous-titre inchangés.

- [ ] **Step 6: i18n** — ajouter les clés utilisées (`reglStatsHybridHint`, `reglTri`, `reglTriPertinence`, `reglTriArticle`, `reglReset`, `reglStatsArticles`, `reglStatsLois`) dans `messages/fr.json`, `nl.json`, `en.json` (cf. Task 7 pour le lot complet — ou incrémental ici).

- [ ] **Step 7: Vérif compile + build partiel**

Run: `pnpm exec tsc --noEmit`
Expected: 0 erreur.

- [ ] **Step 8: QA preview (liste)** — `preview_start` (beldoc-dev), naviguer `http://localhost:3000/partenaire/reglementation?q=allocation`, vérifier : bandeau stats, cartes typées (pastille + liseré + statut), extrait surligné, légende, filtres, pleine largeur. `preview_console_logs level=error` → aucune erreur d'hydratation.

- [ ] **Step 9: Commit**

```bash
git add components/reglementation/search-client.tsx components/reglementation/types.ts app/partenaire/reglementation/page.tsx messages/fr.json messages/nl.json messages/en.json
git commit -m "feat(reglementation): liste redessinée (stats, cartes typées, légende, pleine largeur)"
```

---

### Task 5: Composants fiche — `legal-text`, `onem-commentary`, `article-sidebar`

**Files:**
- Create: `components/reglementation/legal-text.tsx`
- Create: `components/reglementation/onem-commentary.tsx`
- Create: `components/reglementation/article-sidebar.tsx`

**Interfaces:**
- Consumes: `parseLegalText`/`LegalBlock`, `splitOnemCommentary`/`OnemComment` (Task 2) ; `natureMeta` (Task 1).
- Produces:
  - `LegalText({ raw }: { raw: string })` — RSC pur : `parseLegalText(raw)` → rendu typographié.
  - `OnemCommentary({ raw }: { raw: string })` — **client** (`"use client"`) : `splitOnemCommentary(raw)` → `Accordion` (shadcn) replié, en-tête « N commentaires ONEM · réservé admin » (icône `Lock`).
  - `ArticleSidebar({ meta, refs, sourceUrl, consultedOn, neighbors }: {...})` — panneau collant.

- [ ] **Step 1: `legal-text.tsx`** (RSC) — `const blocks = parseLegalText(raw)`. Rendu dans `<div className="max-w-[72ch] space-y-3 text-[15px] leading-relaxed">` :
  - `section` → `<p><strong>{marker}.</strong> {text}</p>`
  - `paragraph` → `<p>{text}</p>`
  - `list-item` → élément `<div className="flex gap-2 pl-4"><span className="text-muted-foreground">{marker}</span><span>{text}</span></div>`
  - `abroge` → `<p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground italic">{text}</p>`
  - Si `blocks.length === 0` → `<p className="text-muted-foreground">{/* rien à afficher */}</p>`.

- [ ] **Step 2: `onem-commentary.tsx`** (`"use client"`) — `const items = splitOnemCommentary(raw)`. Si vide → `null`. Sinon `Accordion type="multiple"` (shadcn `components/ui/accordion`) collapsed par défaut ; en-tête section : `<div className="flex items-center gap-2"><Lock className="size-4 text-amber-600" /> {items.length} commentaires ONEM · réservé admin</div>`. Chaque item = `AccordionItem` dont le trigger montre « Commentaire {index} » + badges `date`/`institution` si présents ; contenu = `<div className="whitespace-pre-wrap text-sm leading-relaxed">{text}</div>`.

- [ ] **Step 3: `article-sidebar.tsx`** (RSC) — `<aside className="lg:sticky lg:top-20 space-y-4 print:hidden">` contenant 4 `Card` :
  - **Informations** : statut, entrée en vigueur, date publication, date Moniteur, nature (lignes `label`/`valeur`, masquer si vide).
  - **Références** : `refs.slice(0,7)` en `Badge variant="outline"` ; si `refs.length>7` → texte « Voir toutes (N) » (statique, pas d'action V1).
  - **Voir aussi** : `neighbors` (prev/next) → `Link` vers `/partenaire/reglementation/${encodeURIComponent(riolexId)}`.
  - **Lien externe** : `sourceUrl` (RioLex) + ligne attribution `t("reglAttribution", {...})` + `t("reglNotice")`.

- [ ] **Step 4: Vérif compile**

Run: `pnpm exec tsc --noEmit` → 0 erreur.

- [ ] **Step 5: Commit**

```bash
git add components/reglementation/legal-text.tsx components/reglementation/onem-commentary.tsx components/reglementation/article-sidebar.tsx
git commit -m "feat(reglementation): composants fiche (texte structuré, commentaire ONEM accordéon, sidebar)"
```

---

### Task 6: Réécriture page fiche (2 colonnes, sticky, Imprimer, pleine largeur)

**Files:**
- Modify (réécriture layout): `app/partenaire/reglementation/[riolexId]/page.tsx`
- Create: `components/reglementation/print-button.tsx` (`"use client"`, `window.print()`)

**Interfaces:**
- Consumes: `LegalText`, `OnemCommentary`, `ArticleSidebar`, `natureMeta`, `PrintButton`.
- Le chargement DB (candidates/article/commentary/neighbors) et le gating restent **identiques** à l'actuel (ne PAS retoucher les requêtes) — seule la **présentation** change.

- [ ] **Step 1: `print-button.tsx`**

```tsx
"use client";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
export function PrintButton({ label }: { label: string }) {
  return (
    <Button variant="outline" size="sm" onClick={() => window.print()}>
      <Printer className="size-4" aria-hidden /> {label}
    </Button>
  );
}
```

- [ ] **Step 2: Recomposer le JSX de la page** (garder tout le bloc de chargement données + `notFound()` + `neighbors` intact). Nouveau rendu :
  - Conteneur `<div className="w-full space-y-5 px-4 py-6 lg:px-6">` (plus de `mx-auto max-w-4xl`).
  - Fil d'Ariane (`Réglementation › {meta.loi} › Art. {meta.articleNumber}`) + `Link` retour (`print:hidden`).
  - En-tête : `<NatureTile>` + `<h1>` titre ; badges nature/statut ; à droite `<PrintButton label={t("reglPrint")} />` (`print:hidden`) + lien RioLex.
  - **Grille** : `<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">`
    - Col principale : `<article>` → `<LegalText raw={article.content} />` ; puis « Références légales » (les `refs` inline en liste) ; puis `<OnemCommentary raw={commentary.content} />` (rendu uniquement si `commentary` existe = admin).
    - Col latérale : `<ArticleSidebar meta={meta} refs={refs} sourceUrl={article.sourceUrl} consultedOn={consultedOn} neighbors={neighbors} />`.
  - Attribution + `t("reglNotice")` : déplacées dans la sidebar (Task 5) ET conservées en pied de la colonne principale en `print:block` pour l'impression.

- [ ] **Step 3: Print CSS via utilitaires Tailwind** — `print:hidden` sur : fil d'Ariane, bouton retour, PrintButton, la colonne latérale ; forcer la grille en 1 colonne à l'impression (`print:block` sur le conteneur grille). Vérifier qu'aucun `@media print` global n'est requis.

- [ ] **Step 4: Vérif compile**

Run: `pnpm exec tsc --noEmit` → 0 erreur.

- [ ] **Step 5: QA preview (fiche)** — naviguer `http://localhost:3000/partenaire/reglementation/25_11_1991-1-art_131bis` (AGR, gros commentaire) et `.../25_11_1991-1-art_100` : vérifier 2 colonnes, sidebar collante au scroll, texte structuré (§/alinéas), accordéon commentaire replié + dépliable, badges/dates, `preview_console_logs level=error` vide. Tester `preview_resize` (mobile) → colonnes empilées, sidebar sous le texte.

- [ ] **Step 6: Commit**

```bash
git add "app/partenaire/reglementation/[riolexId]/page.tsx" components/reglementation/print-button.tsx
git commit -m "feat(reglementation): fiche article 2 colonnes (sidebar collante, texte structuré, impression)"
```

---

### Task 7: i18n complet + QA finale

**Files:**
- Modify: `messages/fr.json`, `messages/nl.json`, `messages/en.json`

- [ ] **Step 1: Compléter toutes les clés `public.pro.regl*`** utilisées dans les Tasks 3-6 si pas déjà ajoutées : stats (`reglStatsArticles`, `reglStatsLois`, `reglStatsHybrid`, `reglStatsHybridHint`), tri (`reglTri`, `reglTriPertinence`, `reglTriArticle`), `reglReset`, légende (`reglLegendVigueur`, `reglLegendAbroge` + natures via `nature.ts` en dur FR — OK car libellés juridiques identiques FR/NL courants ; sinon clés), fiche (`reglPrint`, `reglCommentCount`, `reglCommentAdminOnly`, `reglPropMb` etc. déjà existantes à vérifier). Reprendre les libellés fr en valeurs nl/en (fallback FR accepté par le projet).

- [ ] **Step 2: i18n check**

Run: `pnpm i18n:check`
Expected: succès (ICU + couverture). Corriger toute clé manquante.

- [ ] **Step 3: Build complet**

Run: `pnpm build`
Expected: build + typecheck OK (0 erreur). Corriger si besoin.

- [ ] **Step 4: Tests**

Run: `pnpm exec vitest run lib/reglementation`
Expected: PASS (Tasks 1-2).

- [ ] **Step 5: QA preview finale** — liste + fiche, desktop + mobile (`preview_resize`), gating anonyme rejoué (`fetch` API `credentials:"omit"` → 401 ; page → 404), impression (vérifier `print:hidden`).

- [ ] **Step 6: Commit**

```bash
git add messages/fr.json messages/nl.json messages/en.json
git commit -m "chore(reglementation): i18n libellés refonte + QA (build/i18n:check/tests verts)"
```

---

## Self-Review

- **Spec coverage :** stats/filtres/cartes/légende (T3-T4) ✓ ; parseur texte + commentaire (T2) ✓ ; fiche 2 col + sidebar collante + accordéon admin (T5-T6) ✓ ; pleine largeur (T4-T6) ✓ ; Imprimer + print CSS (T6) ✓ ; natures réelles (T1) ✓ ; i18n (T7) ✓ ; backend inchangé (aucune tâche ne touche l'API/gating) ✓ ; stats sans changement API (dérivées de `data.total`/`data.lois`) ✓. Backlog (Favori/Exporter/grille/«+filtres») explicitement hors plan ✓.
- **Placeholders :** aucun « TODO » de contenu ; code complet pour le parseur + tests + nature ; composants spécifiés par props/classes/structure exactes.
- **Type consistency :** `ResultItem` centralisé dans `types.ts` (consommé par `result-card`, `search-client`) ; `LegalBlock`/`OnemComment` définis en T2 et consommés en T5 ; `natureMeta` signature stable T1→T3/T5/T6.
- **Note d'ordre :** T3 dépend du `types.ts` créé en T3 (déplacé avant son usage) ; T4 finalise `search-client`. Les libellés i18n peuvent être ajoutés incrémentalement (T4/T6) puis complétés/vérifiés en T7.

## Risques / rappels

- Espace partenaire = **shadcn, pas glass** ; ne pas importer de helper `.glass-*`.
- Ne pas retoucher les requêtes DB ni le gating de `[riolexId]/page.tsx` (juste le JSX).
- `Accordion`/`Select` = base-ui : garder les wrappers `components/ui/*` du repo.
- Vérifier l'absence d'erreur d'hydratation (leçon connue : pas d'`autoFocus` dans une frontière Suspense).
- Lignes de texte légal plafonnées `max-w-[72ch]` malgré la pleine largeur de page.
