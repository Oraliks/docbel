# Feuille de route « Et maintenant ? » — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** À la fin d'un dossier, dire au citoyen où déposer ses documents (bureau
de son organisme de paiement, selon sa commune), qui doit signer, en combien
d'exemplaires, quoi joindre — à l'écran (BundleRoadmap) et sur une page de
garde PDF ajoutée au zip et à l'e-mail.

**Architecture:** Moteur pur `lib/feuille-de-route/` (modèle + registre de
faits sourcés + `buildFeuilleDeRoute`), importable client ET serveur. Une
nouvelle route GET `/api/bundles/runs/[runId]/feuille-de-route` fournit les
données bureaux (commune extraite du payload via clés canoniques →
`resolveBureausForPostalCode`). Le choix d'organisme de paiement est un state
React local, transmis en paramètre transitoire aux routes zip/e-mail, **jamais
stocké ni journalisé** (donnée art. 9 potentielle). Spec validée :
`docs/superpowers/specs/2026-08-02-feuille-de-route-design.md`.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, Prisma 5,
pdf-lib (déjà présent via le filler), AdmZip (déjà présent), Zod 4, vitest,
next-intl 4.

## Global Constraints

- **Aucune nouvelle dépendance. Aucune migration DB.** (spec : zéro stockage nouveau)
- **Le choix d'OP ne s'écrit nulle part** : ni DB, ni `PdfFormSubmissionLog`, ni
  `trackBundleEvent` metadata, ni logs console. Paramètre de requête transitoire uniquement.
- `git add` de chemins **explicites** uniquement (workdir partagé multi-agents). Jamais `git add -A`.
- `pnpm lint` a ~129 erreurs préexistantes : **zéro nouvelle erreur**.
- Pas de `setState` synchrone dans un `useEffect` (ESLint refuse) — utiliser l'init lazy ou des events.
- Front public : tokens glass (`--glass-ink`, `--glass-surface`…), jamais `bg-white`/`#FFFFFF`.
- **Vouvoiement** partout ; vocabulaire « démarche ».
- Contenu réglementaire : **recopié du PDF officiel ou absent** — jamais rédigé de mémoire.
  En cas de doute, demander à Oraliks. Les textes métier du lot sont à faire valider à la review.
- Les fichiers `messages/*.json` sont volumineux et `fr.json` est en **CRLF** :
  éditer par insertions chirurgicales (Edit sur un bloc court), jamais réécrire le fichier.
- Commandes de validation : `pnpm vitest run <chemin>` (ciblé), puis en fin de lot
  `pnpm test` · `pnpm build` · `pnpm lint` · `pnpm i18n:check`.

---

### Task 1: Modèle + registre de faits sourcés

**Files:**
- Create: `lib/feuille-de-route/model.ts`
- Create: `lib/feuille-de-route/registry.ts`
- Test: `lib/feuille-de-route/__tests__/registry.test.ts`

**Interfaces:**
- Consumes: rien (module feuille, aucune dépendance runtime — types seulement).
- Produces: `OpCode`, `OP_CODES`, `OP_LABELS`, `isOpCode(v)`, `BureauFeuille`,
  `PieceFeuille`, `ConsigneDocument`, `DepotFeuille`, `FeuilleDeRoute`,
  `FeuilleServerData`, `PRUDENCE`, `EXPLICATION_OP` (model.ts) ;
  `FaitsDocument`, `faitsPourDocument(slug)` (registry.ts). Utilisés par les
  Tasks 2, 4, 5, 6, 7.

- [ ] **Step 1: Vérifier le slug réel du C1-Partenaire** (clé du registre)

Run: `grep -rn "slug" lib/pdf-forms/seed/c1-partenaire-fields.ts | head -5`
Expected: une ligne du type `slug: "c1-partenaire"`. Si le slug diffère,
utiliser la valeur réelle comme clé dans `registry.ts` (Step 3).

- [ ] **Step 2: Vérifier la source du fait « 3 exemplaires, signé à deux »**

Run: `python -m markitdown private/pdfs/C1-PARTENAIRE_FR.pdf -o "$TMPDIR/c1p.md" && grep -i -n "EXEMPLAIRES" "$TMPDIR/c1p.md"`
Expected: une ligne contenant « A COMPLETER PAR LE CHOMEUR ET LE PARTENAIRE EN
3 EXEMPLAIRES » (déjà citée par NEXT_ACTIONS #40). Si la mention exacte diffère,
recopier la formulation réelle dans le commentaire source du Step 3. Si le PDF
n'est pas lisible ici, garder la citation de NEXT_ACTIONS #40 comme source, en
le disant dans le commentaire.

- [ ] **Step 3: Écrire le modèle et le registre**

`lib/feuille-de-route/model.ts` :

```ts
// Feuille de route « Et maintenant ? » — modèle pur, importable client ET
// serveur (aucun import runtime : le panneau React construit la feuille
// lui-même, le choix d'organisme de paiement ne quitte donc pas le client).
// Spec : docs/superpowers/specs/2026-08-02-feuille-de-route-design.md.

/// Miroir volontaire de la constante privée OP_CODES de
/// lib/bureaus/resolve.ts (qui importe prisma, donc inutilisable ici côté
/// client). Toute évolution se fait dans les DEUX fichiers.
export const OP_CODES = ["capac", "fgtb", "csc", "synova"] as const;
export type OpCode = (typeof OP_CODES)[number];

/// Acronymes officiels — pas des libellés inventés.
export const OP_LABELS: Record<OpCode, string> = {
  capac: "CAPAC",
  fgtb: "FGTB",
  csc: "CSC",
  synova: "SYNOVA",
};

export function isOpCode(v: unknown): v is OpCode {
  return typeof v === "string" && (OP_CODES as readonly string[]).includes(v);
}

/// Projection minimale d'un SerializedBureau (lib/bureaus/types.ts) : ce que
/// la feuille affiche, rien de plus — le mapping se fait côté serveur.
export interface BureauFeuille {
  opCode: OpCode;
  nom: string;
  adresse: string;
  telephone: string | null;
  siteWeb: string | null;
  rendezVousUrl: string | null;
}

export interface PieceFeuille {
  slug: string;
  titre: string;
}

export interface ConsigneDocument {
  slug: string;
  titre: string;
  signatures: string;
  exemplaires: number;
}

export type DepotFeuille =
  | { mode: "bureau"; opCode: OpCode; bureau: BureauFeuille }
  | { mode: "choix"; bureaux: BureauFeuille[] }
  | { mode: "generique" };

export interface FeuilleDeRoute {
  pieces: PieceFeuille[];
  consignes: ConsigneDocument[];
  depot: DepotFeuille;
  communeName: string | null;
  prudence: string;
}

/// Ce que la route GET feuille-de-route renvoie au panneau. `null` côté
/// consommateur = repli générique (commune non extractible, aucun bureau).
export interface FeuilleServerData {
  communeName: string | null;
  bureauxParOp: BureauFeuille[];
}

/// Item #35 de NEXT_ACTIONS — formulation reprise telle quelle.
export const PRUDENCE =
  "Docbel ne remplace pas une décision de l'ONEM ou de votre organisme de paiement.";

/// Texte métier À FAIRE VALIDER PAR ORALIKS à la review du lot (spec,
/// section Écran). Factuel : la CAPAC est l'organisme public, les trois
/// autres sont les organismes syndicaux.
export const EXPLICATION_OP =
  "Votre organisme de paiement est celui auprès duquel vous êtes inscrit pour vos allocations : la CAPAC (organisme public) ou votre organisme syndical. Si vous ne savez pas lequel choisir, voici les bureaux compétents pour votre commune.";
```

`lib/feuille-de-route/registry.ts` :

```ts
// Faits statiques par document — UNIQUEMENT ceux imprimés sur le PDF officiel
// (règle anti-invention du dépôt). Un document absent du registre reçoit les
// faits par défaut : signé par le déclarant, un exemplaire. On n'invente
// jamais un délai ni une consigne : ce qui n'est pas sourçable n'existe pas
// ici (spec V1 — les délais réglementaires sont hors périmètre).

export interface FaitsDocument {
  signatures: string;
  exemplaires: number;
}

export const FAITS_PAR_DEFAUT: FaitsDocument = {
  signatures: "À signer par vous.",
  exemplaires: 1,
};

const FAITS: Record<string, FaitsDocument> = {
  // Source : bandeau imprimé du C1-PARTENAIRE « A COMPLETER PAR LE CHOMEUR ET
  // LE PARTENAIRE EN 3 EXEMPLAIRES » (private/pdfs/C1-PARTENAIRE_FR.pdf,
  // vérifié au markitdown — cf. aussi NEXT_ACTIONS #40). La case du
  // partenaire n'est pas signable dans Docbel (un formulaire = un signataire,
  // cf. PDF_FORMS_RULES) : elle se signe à la main sur le papier imprimé.
  "c1-partenaire": {
    signatures:
      "À signer par vous ET par votre partenaire — sa case se signe à la main, sur le papier imprimé.",
    exemplaires: 3,
  },
};

export function faitsPourDocument(slug: string): FaitsDocument {
  return FAITS[slug] ?? FAITS_PAR_DEFAUT;
}
```

(Si le Step 1 a montré un slug différent de `c1-partenaire`, utiliser le vrai.)

- [ ] **Step 4: Écrire le test**

`lib/feuille-de-route/__tests__/registry.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { FAITS_PAR_DEFAUT, faitsPourDocument } from "../registry";
import { OP_CODES, isOpCode, PRUDENCE } from "../model";

describe("registry feuille de route", () => {
  it("le C1-Partenaire se signe à deux, en 3 exemplaires", () => {
    const faits = faitsPourDocument("c1-partenaire");
    expect(faits.exemplaires).toBe(3);
    expect(faits.signatures).toMatch(/partenaire/i);
  });

  it("un document inconnu reçoit les faits par défaut", () => {
    expect(faitsPourDocument("document-inconnu")).toEqual(FAITS_PAR_DEFAUT);
  });

  it("les 4 codes OP sont reconnus, le reste refusé", () => {
    for (const code of OP_CODES) expect(isOpCode(code)).toBe(true);
    expect(isOpCode("cgslb")).toBe(false); // le code du parc bureaux pour l'OP libéral est "synova"
    expect(isOpCode(null)).toBe(false);
  });

  it("la phrase de prudence cite l'ONEM et l'organisme de paiement", () => {
    expect(PRUDENCE).toMatch(/ONEM/);
    expect(PRUDENCE).toMatch(/organisme de paiement/);
  });
});
```

- [ ] **Step 5: Lancer le test**

Run: `pnpm vitest run lib/feuille-de-route/__tests__/registry.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/feuille-de-route/model.ts lib/feuille-de-route/registry.ts lib/feuille-de-route/__tests__/registry.test.ts
git commit -m "feat(feuille-de-route): modèle pur + registre de faits sourcés (C1-Partenaire à deux, 3 ex.)"
```

---

### Task 2: `buildFeuilleDeRoute` (moteur pur)

**Files:**
- Create: `lib/feuille-de-route/build.ts`
- Test: `lib/feuille-de-route/__tests__/build.test.ts`

**Interfaces:**
- Consumes: `model.ts` (types, `PRUDENCE`), `registry.ts` (`faitsPourDocument`).
- Produces: `buildFeuilleDeRoute(input: { pieces: PieceFeuille[]; serverData: FeuilleServerData | null; opChoice: OpCode | null }): FeuilleDeRoute` — consommé par le panneau (Task 7) et les routes zip/e-mail (Task 6).

- [ ] **Step 1: Écrire le test (d'abord, il doit échouer)**

`lib/feuille-de-route/__tests__/build.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { buildFeuilleDeRoute } from "../build";
import type { BureauFeuille, PieceFeuille } from "../model";

const PIECES: PieceFeuille[] = [
  { slug: "c1-changement", titre: "C1 — Déclaration de la situation personnelle et familiale" },
  { slug: "c1-partenaire", titre: "C1-Partenaire" },
];

const BUREAU_CAPAC: BureauFeuille = {
  opCode: "capac",
  nom: "CAPAC Bruxelles",
  adresse: "Rue de Brabant 62, 1210 Bruxelles",
  telephone: null,
  siteWeb: null,
  rendezVousUrl: null,
};
const BUREAU_FGTB: BureauFeuille = { ...BUREAU_CAPAC, opCode: "fgtb", nom: "FGTB Bruxelles" };

describe("buildFeuilleDeRoute", () => {
  it("OP choisi + bureau connu → dépôt ciblé sur CE bureau", () => {
    const f = buildFeuilleDeRoute({
      pieces: PIECES,
      serverData: { communeName: "Bruxelles", bureauxParOp: [BUREAU_CAPAC, BUREAU_FGTB] },
      opChoice: "capac",
    });
    expect(f.depot).toEqual({ mode: "bureau", opCode: "capac", bureau: BUREAU_CAPAC });
    expect(f.communeName).toBe("Bruxelles");
  });

  it("sans choix d'OP → mode choix avec les bureaux disponibles", () => {
    const f = buildFeuilleDeRoute({
      pieces: PIECES,
      serverData: { communeName: "Bruxelles", bureauxParOp: [BUREAU_CAPAC, BUREAU_FGTB] },
      opChoice: null,
    });
    expect(f.depot.mode).toBe("choix");
    if (f.depot.mode === "choix") expect(f.depot.bureaux).toHaveLength(2);
  });

  it("OP choisi mais absent de la liste → retombe en mode choix (jamais d'écran vide)", () => {
    const f = buildFeuilleDeRoute({
      pieces: PIECES,
      serverData: { communeName: "Bruxelles", bureauxParOp: [BUREAU_FGTB] },
      opChoice: "capac",
    });
    expect(f.depot.mode).toBe("choix");
  });

  it("aucune donnée serveur → repli générique", () => {
    const f = buildFeuilleDeRoute({ pieces: PIECES, serverData: null, opChoice: "capac" });
    expect(f.depot).toEqual({ mode: "generique" });
    expect(f.communeName).toBeNull();
  });

  it("les consignes portent les faits du registre, dans l'ordre des pièces", () => {
    const f = buildFeuilleDeRoute({ pieces: PIECES, serverData: null, opChoice: null });
    expect(f.consignes.map((c) => c.slug)).toEqual(["c1-changement", "c1-partenaire"]);
    expect(f.consignes[0].exemplaires).toBe(1);
    expect(f.consignes[1].exemplaires).toBe(3);
    expect(f.consignes[1].signatures).toMatch(/partenaire/i);
  });

  it("la phrase de prudence est toujours présente", () => {
    const f = buildFeuilleDeRoute({ pieces: [], serverData: null, opChoice: null });
    expect(f.prudence).toMatch(/ONEM/);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `pnpm vitest run lib/feuille-de-route/__tests__/build.test.ts`
Expected: FAIL — `Cannot find module '../build'` (ou équivalent).

- [ ] **Step 3: Implémenter**

`lib/feuille-de-route/build.ts` :

```ts
// Assemble la feuille de route à partir des pièces du run, des bureaux résolus
// côté serveur et du choix d'organisme de paiement (state client, jamais
// stocké). Fonction PURE : le panneau React et la page de garde PDF
// construisent la même feuille — écran et papier ne peuvent pas diverger.

import {
  PRUDENCE,
  type FeuilleDeRoute,
  type FeuilleServerData,
  type OpCode,
  type PieceFeuille,
  type DepotFeuille,
} from "./model";
import { faitsPourDocument } from "./registry";

export function buildFeuilleDeRoute(input: {
  pieces: PieceFeuille[];
  serverData: FeuilleServerData | null;
  opChoice: OpCode | null;
}): FeuilleDeRoute {
  const consignes = input.pieces.map((p) => ({
    slug: p.slug,
    titre: p.titre,
    ...faitsPourDocument(p.slug),
  }));

  const bureaux = input.serverData?.bureauxParOp ?? [];
  let depot: DepotFeuille;
  if (bureaux.length === 0) {
    depot = { mode: "generique" };
  } else if (input.opChoice) {
    const bureau = bureaux.find((b) => b.opCode === input.opChoice);
    // OP choisi introuvable dans la liste (données incomplètes pour cette
    // commune) : on montre le choix complet plutôt qu'un bloc vide.
    depot = bureau
      ? { mode: "bureau", opCode: input.opChoice, bureau }
      : { mode: "choix", bureaux };
  } else {
    depot = { mode: "choix", bureaux };
  }

  return {
    pieces: input.pieces,
    consignes,
    depot,
    communeName: input.serverData?.communeName ?? null,
    prudence: PRUDENCE,
  };
}
```

- [ ] **Step 4: Vérifier le passage**

Run: `pnpm vitest run lib/feuille-de-route/__tests__/build.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/feuille-de-route/build.ts lib/feuille-de-route/__tests__/build.test.ts
git commit -m "feat(feuille-de-route): moteur pur buildFeuilleDeRoute (dépôt ciblé/choix/générique)"
```

---

### Task 3: Extraction du code postal depuis les payloads (pur)

**Files:**
- Create: `lib/feuille-de-route/extract-postal.ts`
- Test: `lib/feuille-de-route/__tests__/extract-postal.test.ts`

**Interfaces:**
- Consumes: `extractCanonical` (`lib/pdf-forms/canonical/extract.ts`), type `PdfFormField` (`lib/pdf-forms/types.ts`).
- Produces: `postalCodeFromPayloads(pairs: Array<{ fields: PdfFormField[]; payload: Record<string, unknown> }>): string | null` — consommé par la Task 4.

- [ ] **Step 1: Écrire le test**

`lib/feuille-de-route/__tests__/extract-postal.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { postalCodeFromPayloads } from "../extract-postal";
import type { PdfFormField } from "@/lib/pdf-forms/types";

// Champ minimal façon seed C1 : le CP porte la clé canonique
// adresse.codePostal (cf. lib/pdf-forms/seed/c1/identite.ts).
function champCp(id: string, canonicalKey?: string): PdfFormField {
  return { id, pdfFieldName: "", type: "text", label: { fr: "CP" }, section: "s", order: 1, canonicalKey } as PdfFormField;
}

describe("postalCodeFromPayloads", () => {
  it("extrait le CP via la clé canonique adresse.codePostal", () => {
    const cp = postalCodeFromPayloads([
      { fields: [champCp("cp", "adresse.codePostal")], payload: { cp: "1210" } },
    ]);
    expect(cp).toBe("1210");
  });

  it("repli sur l'id de champ code_postal du C1 quand aucune clé canonique", () => {
    const cp = postalCodeFromPayloads([
      { fields: [champCp("code_postal")], payload: { code_postal: " 4000 " } },
    ]);
    expect(cp).toBe("4000");
  });

  it("ignore les valeurs non belges (pas 4 chiffres) et continue sur le formulaire suivant", () => {
    const cp = postalCodeFromPayloads([
      { fields: [champCp("cp", "adresse.codePostal")], payload: { cp: "75011" } },
      { fields: [champCp("cp", "adresse.codePostal")], payload: { cp: "1000" } },
    ]);
    expect(cp).toBe("1000");
  });

  it("null quand rien n'est extractible", () => {
    expect(postalCodeFromPayloads([])).toBeNull();
    expect(
      postalCodeFromPayloads([{ fields: [champCp("autre")], payload: { autre: "abc" } }]),
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `pnpm vitest run lib/feuille-de-route/__tests__/extract-postal.test.ts`
Expected: FAIL — module `../extract-postal` introuvable.

- [ ] **Step 3: Implémenter**

`lib/feuille-de-route/extract-postal.ts` :

```ts
// Trouve le code postal belge du citoyen dans les payloads d'un run :
// d'abord la clé canonique adresse.codePostal (posée sur le C1 —
// lib/pdf-forms/seed/c1/identite.ts), puis l'id de champ historique
// `code_postal` en repli (spec). Renvoie null si rien d'exploitable —
// le consommateur bascule alors la feuille en mode générique.

import { extractCanonical } from "@/lib/pdf-forms/canonical/extract";
import type { PdfFormField } from "@/lib/pdf-forms/types";

const CP_BELGE = /^\d{4}$/;

export function postalCodeFromPayloads(
  pairs: Array<{ fields: PdfFormField[]; payload: Record<string, unknown> }>,
): string | null {
  for (const { fields, payload } of pairs) {
    const canonical = extractCanonical(fields, payload);
    const candidats = [
      canonical["adresse.codePostal"],
      typeof payload["code_postal"] === "string" ? (payload["code_postal"] as string) : null,
    ];
    for (const brut of candidats) {
      const cp = brut?.trim() ?? "";
      if (CP_BELGE.test(cp)) return cp;
    }
  }
  return null;
}
```

- [ ] **Step 4: Vérifier le passage**

Run: `pnpm vitest run lib/feuille-de-route/__tests__/extract-postal.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/feuille-de-route/extract-postal.ts lib/feuille-de-route/__tests__/extract-postal.test.ts
git commit -m "feat(feuille-de-route): extraction du CP depuis les payloads (canonique + repli C1)"
```

---

### Task 4: Données serveur + route GET `feuille-de-route`

**Files:**
- Create: `lib/feuille-de-route/server.ts`
- Create: `app/api/bundles/runs/[runId]/feuille-de-route/route.ts`

**Interfaces:**
- Consumes: `postalCodeFromPayloads` (Task 3), `isOpCode`/`BureauFeuille`/`FeuilleServerData` (Task 1), `resolveBureausForPostalCode` (`lib/bureaus/resolve.ts`), `loadDossierState`/`DossierState` (`lib/bundles/completion.ts`), `prisma` (`lib/prisma`), `checkRateLimit`/`getClientIp` (`lib/pdf-forms/security.ts`), `auth` (`lib/auth`).
- Produces: `feuilleServerDataForState(state: DossierState): Promise<FeuilleServerData | null>` (consommé par la Task 6) ; route `GET /api/bundles/runs/[runId]/feuille-de-route` → `{ serverData: FeuilleServerData | null }` (consommée par la Task 7).

- [ ] **Step 1: Implémenter le builder serveur**

`lib/feuille-de-route/server.ts` :

```ts
// Partie serveur de la feuille de route : extrait le CP des payloads du run
// (une requête pdfForm.fields, même patron que regenerate-pdfs.ts) puis
// résout les bureaux OP compétents pour la commune. On n'appelle JAMAIS
// resolveBureausForPostalCode avec un organismePaiement : le choix d'OP est
// un state client (spec, art. 9) — le serveur renvoie les 4 bureaux, le
// client filtre. Renvoie null (→ mode générique) si rien d'extractible.

import { prisma } from "@/lib/prisma";
import { resolveBureausForPostalCode } from "@/lib/bureaus/resolve";
import type { DossierState } from "@/lib/bundles/completion";
import type { PdfFormField } from "@/lib/pdf-forms/types";
import { isOpCode, type BureauFeuille, type FeuilleServerData } from "./model";
import { postalCodeFromPayloads } from "./extract-postal";

export async function feuilleServerDataForState(
  state: DossierState,
): Promise<FeuilleServerData | null> {
  const ids = state.items
    .map((it) => it.pdfFormId)
    .filter((x): x is string => typeof x === "string" && x.length > 0);
  if (ids.length === 0) return null;

  const forms = await prisma.pdfForm.findMany({
    where: { id: { in: ids } },
    select: { id: true, fields: true },
  });
  const pairs = forms.flatMap((f) => {
    const payload = state.payloads[f.id];
    if (!payload) return [];
    return [{ fields: ((f.fields as unknown as PdfFormField[]) || []), payload }];
  });

  const cp = postalCodeFromPayloads(pairs);
  if (!cp) return null;

  const resolved = await resolveBureausForPostalCode(cp);
  const bureauxParOp: BureauFeuille[] = resolved.attitre.organismesPaiement.flatMap((b) =>
    isOpCode(b.organismeCode)
      ? [
          {
            opCode: b.organismeCode,
            nom: b.name,
            adresse: b.fullAddress,
            telephone: b.phone,
            siteWeb: b.website,
            rendezVousUrl: b.appointmentUrl,
          },
        ]
      : [],
  );

  return { communeName: resolved.commune?.nameFr ?? null, bureauxParOp };
}
```

- [ ] **Step 2: Implémenter la route GET**

`app/api/bundles/runs/[runId]/feuille-de-route/route.ts` — même squelette
ownership/verrou que `download-all/route.ts` (404 « pas trouvé/pas à toi »
indistincts, 409 dossier incomplet) :

```ts
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { loadDossierState } from "@/lib/bundles/completion";
import { feuilleServerDataForState } from "@/lib/feuille-de-route/server";
import { checkRateLimit, getClientIp } from "@/lib/pdf-forms/security";

const json = { "Content-Type": "application/json; charset=utf-8" };

/// GET → données bureaux de la feuille de route (commune + bureaux OP
/// compétents). Le choix d'OP du citoyen ne transite JAMAIS par ici : le
/// serveur renvoie les 4, le panneau filtre côté client (spec, art. 9).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const ip = getClientIp(req);
  const rl = checkRateLimit(`bundle-feuille:${ip}:${runId}`, { windowMs: 60_000, max: 10 });
  if (!rl.ok) {
    return NextResponse.json({ error: "Trop de requêtes, réessayez plus tard" }, { status: 429, headers: json });
  }

  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id || null;
  const sessionId = req.cookies.get("beldoc-bundle-session")?.value || null;

  const state = await loadDossierState(runId, { userId, sessionId });
  if (!state) {
    return NextResponse.json({ error: "Dossier introuvable" }, { status: 404, headers: json });
  }
  if (!state.allRequiredDone) {
    return NextResponse.json({ error: "dossier_incomplete" }, { status: 409, headers: json });
  }

  let serverData;
  try {
    serverData = await feuilleServerDataForState(state);
  } catch (err) {
    // Neon partagée : cold-start possible (P1001) — repli générique plutôt
    // qu'une 500 : la feuille reste utile sans adresse.
    console.error("[bundle-feuille-de-route] resolve error:", err);
    serverData = null;
  }

  return NextResponse.json(
    { serverData },
    { headers: { ...json, "Cache-Control": "private, no-store" } },
  );
}
```

- [ ] **Step 3: Vérifier la compilation**

Run: `pnpm build`
Expected: build OK, la route apparaît dans la liste des routes générées
(`/api/bundles/runs/[runId]/feuille-de-route`).

- [ ] **Step 4: Commit**

```bash
git add lib/feuille-de-route/server.ts "app/api/bundles/runs/[runId]/feuille-de-route/route.ts"
git commit -m "feat(feuille-de-route): données serveur (CP→bureaux OP) + route GET verrouillée"
```

---

### Task 5: Page de garde PDF (pdf-lib)

**Files:**
- Create: `lib/feuille-de-route/page-de-garde.ts`
- Test: `lib/feuille-de-route/__tests__/page-de-garde.test.ts`

**Interfaces:**
- Consumes: `FeuilleDeRoute`, `OP_LABELS` (Task 1) ; `pdf-lib` (dépendance existante du filler).
- Produces: `buildPageDeGarde(feuille: FeuilleDeRoute): Promise<Uint8Array>` — consommé par la Task 6.
- ⚠ Texte en **WinAnsi** (Helvetica standard) : accents français et « » OK ;
  ne pas utiliser de caractères hors Latin-1 (pas de flèches ni d'emoji).

- [ ] **Step 1: Écrire le test**

`lib/feuille-de-route/__tests__/page-de-garde.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildPageDeGarde } from "../page-de-garde";
import { buildFeuilleDeRoute } from "../build";

const FEUILLE = buildFeuilleDeRoute({
  pieces: [
    { slug: "c1-changement", titre: "C1 - Declaration de situation" },
    { slug: "c1-partenaire", titre: "C1-Partenaire" },
  ],
  serverData: {
    communeName: "Bruxelles",
    bureauxParOp: [
      {
        opCode: "capac",
        nom: "CAPAC Bruxelles",
        adresse: "Rue de Brabant 62, 1210 Bruxelles",
        telephone: "02 000 00 00",
        siteWeb: null,
        rendezVousUrl: null,
      },
    ],
  },
  opChoice: "capac",
});

describe("buildPageDeGarde", () => {
  it("produit un PDF valide d'au moins une page", async () => {
    const bytes = await buildPageDeGarde(FEUILLE);
    expect(bytes.length).toBeGreaterThan(500);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("mode générique : produit aussi un PDF valide (jamais de crash sans bureau)", async () => {
    const generique = buildFeuilleDeRoute({ pieces: [], serverData: null, opChoice: null });
    const doc = await PDFDocument.load(await buildPageDeGarde(generique));
    expect(doc.getPageCount()).toBe(1);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `pnpm vitest run lib/feuille-de-route/__tests__/page-de-garde.test.ts`
Expected: FAIL — module `../page-de-garde` introuvable.

- [ ] **Step 3: Implémenter**

`lib/feuille-de-route/page-de-garde.ts` :

```ts
// Page de garde A4 « Et maintenant ? » ajoutée en tête du zip et de l'e-mail.
// Page d'AIDE, pas un formulaire : bandeau explicite pour qu'elle ne soit
// jamais confondue avec un document officiel (spec). Helvetica standard
// (WinAnsi) : pas de police embarquée, pas de caractères hors Latin-1.

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { OP_LABELS, type FeuilleDeRoute } from "./model";

const A4: [number, number] = [595.28, 841.89];
const MARGE = 50;
const ENCRE = rgb(0.13, 0.12, 0.2);
const DOUX = rgb(0.35, 0.33, 0.45);

/// Découpe un texte en lignes tenant dans maxWidth (pdf-lib ne wrappe pas).
function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const mots = text.split(/\s+/).filter(Boolean);
  const lignes: string[] = [];
  let ligne = "";
  for (const mot of mots) {
    const essai = ligne ? `${ligne} ${mot}` : mot;
    if (font.widthOfTextAtSize(essai, size) <= maxWidth) ligne = essai;
    else {
      if (ligne) lignes.push(ligne);
      ligne = mot;
    }
  }
  if (ligne) lignes.push(ligne);
  return lignes.length > 0 ? lignes : [""];
}

export async function buildPageDeGarde(feuille: FeuilleDeRoute): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage(A4);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const largeur = A4[0] - 2 * MARGE;
  let y = A4[1] - MARGE;

  const ecrit = (
    text: string,
    opts: { font?: PDFFont; size?: number; gap?: number; color?: ReturnType<typeof rgb> } = {},
  ) => {
    const font = opts.font ?? regular;
    const size = opts.size ?? 10.5;
    for (const ligne of wrap(text, font, size, largeur)) {
      y -= size + 3;
      page.drawText(ligne, { x: MARGE, y, size, font, color: opts.color ?? ENCRE });
    }
    y -= opts.gap ?? 6;
  };

  ecrit("Et maintenant ?", { font: bold, size: 20, gap: 2 });
  ecrit(
    "Page d'aide Docbel - à conserver avec vos documents, ne pas envoyer à l'ONEM ni à votre organisme de paiement.",
    { size: 9, color: DOUX, gap: 14 },
  );

  // 1. Où déposer
  ecrit("1. Où déposer vos documents", { font: bold, size: 13, gap: 4 });
  if (feuille.depot.mode === "bureau") {
    const b = feuille.depot.bureau;
    ecrit(
      `Déposez l'ensemble de vos documents auprès de votre organisme de paiement (${OP_LABELS[feuille.depot.opCode]}).`,
    );
    ecrit(`${b.nom} - ${b.adresse}`, { font: bold });
    if (b.telephone) ecrit(`Téléphone : ${b.telephone}`);
    if (b.siteWeb) ecrit(`Site : ${b.siteWeb}`);
  } else if (feuille.depot.mode === "choix") {
    ecrit(
      "Déposez l'ensemble de vos documents auprès de VOTRE organisme de paiement (celui auprès duquel vous êtes inscrit). Bureaux compétents" +
        (feuille.communeName ? ` pour ${feuille.communeName}` : "") +
        " :",
    );
    for (const b of feuille.depot.bureaux) {
      ecrit(`${OP_LABELS[b.opCode]} : ${b.nom} - ${b.adresse}`);
    }
  } else {
    ecrit(
      "Déposez l'ensemble de vos documents auprès de votre organisme de paiement (CAPAC ou votre organisme syndical). Retrouvez le bureau compétent pour votre commune sur la page Bureaux de Docbel.",
    );
  }
  y -= 8;

  // 2. Signatures & exemplaires
  ecrit("2. Signatures et exemplaires", { font: bold, size: 13, gap: 4 });
  for (const c of feuille.consignes) {
    const ex = c.exemplaires > 1 ? `${c.exemplaires} exemplaires` : "1 exemplaire";
    ecrit(`- ${c.titre} : ${c.signatures} (${ex})`);
  }
  y -= 8;

  // 3. Contenu du dossier
  if (feuille.pieces.length > 0) {
    ecrit("3. Documents de votre dossier", { font: bold, size: 13, gap: 4 });
    for (const p of feuille.pieces) ecrit(`- ${p.titre}`);
    y -= 8;
  }

  ecrit(feuille.prudence, { size: 9, color: DOUX });
  return doc.save();
}
```

Note encodage : Helvetica/WinAnsi couvre tous les accents français utilisés
ci-dessus. Seule contrainte : aucun caractère hors Latin-1 (pas de « → »,
pas d'emoji, pas de tiret cadratin exotique — le tiret simple suffit).

- [ ] **Step 4: Vérifier le passage**

Run: `pnpm vitest run lib/feuille-de-route/__tests__/page-de-garde.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/feuille-de-route/page-de-garde.ts lib/feuille-de-route/__tests__/page-de-garde.test.ts
git commit -m "feat(feuille-de-route): page de garde A4 pdf-lib (aide, non officielle)"
```

---

### Task 6: Zip + e-mail — paramètre `op` transitoire + page de garde

**Files:**
- Modify: `lib/bundles/regenerate-pdfs.ts:35` (exporter `completedEligibleItems`)
- Modify: `app/api/bundles/runs/[runId]/download-all/route.ts`
- Modify: `app/api/bundles/runs/[runId]/email/route.ts`

**Interfaces:**
- Consumes: `buildFeuilleDeRoute` (Task 2), `feuilleServerDataForState` (Task 4), `buildPageDeGarde` (Task 5), `isOpCode` (Task 1), `itemTitle` (`components/docbel/bundle-runner/compute.ts` — déjà importé côté serveur par regenerate-pdfs), `completedEligibleItems` (export ajouté ici).
- Produces: `GET …/download-all?op=<code>` et `POST …/email` avec body `{ to, consent, op? }`. Le zip contient `0_LISEZ-MOI_feuille-de-route.pdf` en premier ; l'e-mail la joint en première pièce.
- **Interdit** : écrire `op` dans un log, un `trackBundleEvent`, ou une ligne `PdfFormSubmissionLog`. Les metadata analytics existantes restent strictement inchangées.

- [ ] **Step 1: Exporter `completedEligibleItems`**

Dans `lib/bundles/regenerate-pdfs.ts`, ligne 35, remplacer
`function completedEligibleItems(` par `export function completedEligibleItems(`
(la doc du fichier reste valable — aucune autre modification).

- [ ] **Step 2: Modifier la route zip**

Dans `app/api/bundles/runs/[runId]/download-all/route.ts` :

Ajouter aux imports :

```ts
import { completedEligibleItems } from "@/lib/bundles/regenerate-pdfs";
import { itemTitle } from "@/components/docbel/bundle-runner/compute";
import { buildFeuilleDeRoute } from "@/lib/feuille-de-route/build";
import { feuilleServerDataForState } from "@/lib/feuille-de-route/server";
import { buildPageDeGarde } from "@/lib/feuille-de-route/page-de-garde";
import { isOpCode } from "@/lib/feuille-de-route/model";
```

Juste après `const { runId } = await params;` :

```ts
  // Choix d'organisme de paiement du citoyen — paramètre TRANSITOIRE (spec,
  // art. 9) : il compose la page de garde puis est oublié. Ne jamais l'écrire
  // dans un log, un event analytics ou une ligne PdfFormSubmissionLog.
  const opRaw = req.nextUrl.searchParams.get("op");
  const opChoice = isOpCode(opRaw) ? opRaw : null;
```

Entre `const zip = new AdmZip();` et la boucle `for (const doc of result.docs)`,
insérer la page de garde (best-effort : son échec ne prive jamais le citoyen
de ses documents, même règle que les logs de régénération) :

```ts
  try {
    const serverData = await feuilleServerDataForState(result.state);
    const pieces = completedEligibleItems(result.state).flatMap((it) =>
      it.pdfForm ? [{ slug: it.pdfForm.slug, titre: itemTitle(it) }] : [],
    );
    const feuille = buildFeuilleDeRoute({ pieces, serverData, opChoice });
    const garde = await buildPageDeGarde(feuille);
    zip.addFile("0_LISEZ-MOI_feuille-de-route.pdf", Buffer.from(garde));
  } catch (err) {
    console.error("[bundle-download-all] page de garde échouée (non bloquant) :", err);
  }
```

Le `trackBundleEvent("documents_downloaded", …)` existant reste **strictement
inchangé** (aucune clé `op`).

Note : vérifier la signature d'`itemTitle` dans
`components/docbel/bundle-runner/compute.ts` avant de l'importer. Si elle
exige un argument de plus (locale), ne pas la tordre : lire directement sur
l'item le champ de titre qu'`itemTitle` lit elle-même (visible dans
compute.ts, type `BundleItem`) — jamais le slug brut comme titre.

- [ ] **Step 3: Modifier la route e-mail**

Dans `app/api/bundles/runs/[runId]/email/route.ts` : mêmes imports que Step 2
(sans AdmZip). Lire `op` depuis le body :

```ts
  const opChoice = isOpCode(body.op) ? body.op : null;
```

(élargir le type local du body : `let body: { to?: unknown; consent?: unknown; op?: unknown };`)

Après l'obtention de `result` et avant la construction du message Resend,
générer la page de garde (même bloc try/catch que la route zip, sans
`zip.addFile`) puis l'ajouter en PREMIÈRE pièce jointe, dans le même format
que les documents existants (le tableau `attachments` construit depuis
`result.docs` — lignes ~80-110 du fichier ; reprendre exactement la forme
`{ filename, content }` qu'on y voit) :

```ts
  // garde: Uint8Array | null — produit par le bloc try/catch ci-dessus
  const attachments = [
    ...(garde ? [{ filename: "0_LISEZ-MOI_feuille-de-route.pdf", content: Buffer.from(garde) }] : []),
    ...result.docs.map((doc) => ({ filename: doc.filename, content: doc.bytes })),
  ];
```

Aucun autre changement : consentement, rate-limit, événements analytics
inchangés (aucune clé `op` nulle part).

- [ ] **Step 4: Vérifier compilation + non-régression**

Run: `pnpm vitest run lib/feuille-de-route && pnpm build`
Expected: tests PASS, build OK.

- [ ] **Step 5: Commit**

```bash
git add lib/bundles/regenerate-pdfs.ts "app/api/bundles/runs/[runId]/download-all/route.ts" "app/api/bundles/runs/[runId]/email/route.ts"
git commit -m "feat(feuille-de-route): page de garde dans le zip et l'e-mail, op transitoire jamais journalisé"
```

---

### Task 7: Panneau « Et maintenant ? » dans BundleRoadmap + i18n + analytics

**Files:**
- Create: `components/docbel/feuille-de-route-panel.tsx`
- Modify: `components/docbel/bundle-roadmap.tsx` (nouvelle étape + state `op` + liens zip/e-mail)
- Modify: `lib/bundles/analytics-events.ts` (autoriser `feuille_de_route_viewed`)
- Modify: `messages/fr.json`, `messages/nl.json`, `messages/de.json`, `messages/en.json`, `messages/es.json`, `messages/it.json`, `messages/pt.json`, `messages/ro.json`, `messages/ru.json`, `messages/tr.json`, `messages/ar.json`, `messages/bg.json`, `messages/mk.json`, `messages/sq.json` (6 clés chrome sous `public.dossier`)

**Interfaces:**
- Consumes: `buildFeuilleDeRoute`/`model` (Tasks 1-2), route GET (Task 4), `RoadmapDocument` (export existant de bundle-roadmap.tsx), `useTranslations("public.dossier")`, POST `/api/bundles/events` (existant).
- Produces: `<FeuilleDeRoutePanel documents={RoadmapDocument[]} bundleRunId={string} op={OpCode|null} onOpChange={(op) => void} />` ; `BundleRoadmap` détient le state `op` et l'ajoute au lien zip (`?op=`) et au body e-mail.
- Rappels : contenu réglementaire (consignes, prudence, explication OP) = **FR depuis le modèle**, comme les seeds ; seules les 6 clés de chrome passent par messages. Le choix d'OP ne part QUE vers download-all/email.

- [ ] **Step 1: Autoriser l'événement analytics (sans OP)**

Dans `lib/bundles/analytics-events.ts`, ajouter `"feuille_de_route_viewed"` à
la liste des événements client acceptés (même forme que les entrées voisines —
ouvrir le fichier, l'entrée s'ajoute dans la constante que lit
`isClientBundleEvent`). Aucune metadata nouvelle.

- [ ] **Step 2: Ajouter les 6 clés chrome dans les 14 locales**

Sous l'objet `public.dossier` de chaque fichier (insertion chirurgicale à côté
des clés `roadmap*` existantes ; **fr.json est en CRLF** — Edit court, jamais
de réécriture). Valeurs FR (traduire fidèlement dans chaque langue, ce sont des
chaînes d'interface simples — PAS du contenu réglementaire) :

```json
"feuilleTitle": "Et maintenant ?",
"feuilleOpQuestion": "Quel est votre organisme de paiement ?",
"feuilleOpUnknown": "Je ne sais pas",
"feuilleLoading": "Recherche du bureau compétent pour votre commune…",
"feuilleGeneric": "Déposez vos documents auprès de votre organisme de paiement. Trouvez le bureau compétent pour votre commune :",
"feuilleFindOffice": "Voir les bureaux près de chez vous"
```

- [ ] **Step 3: Écrire le panneau**

`components/docbel/feuille-de-route-panel.tsx` :

```tsx
"use client";

// Panneau « Et maintenant ? » de l'écran de sortie du dossier. Récupère les
// bureaux OP compétents (route feuille-de-route), laisse le citoyen choisir
// son organisme de paiement en LOCAL (jamais stocké — spec, art. 9), et rend
// les blocs du moteur pur. Le contenu réglementaire (consignes, prudence,
// explication) vient du modèle FR, comme les seeds ; seul le chrome est i18n.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { MapPin } from "lucide-react";
import { buildFeuilleDeRoute } from "@/lib/feuille-de-route/build";
import {
  EXPLICATION_OP,
  OP_CODES,
  OP_LABELS,
  type BureauFeuille,
  type FeuilleServerData,
  type OpCode,
} from "@/lib/feuille-de-route/model";
import type { RoadmapDocument } from "./bundle-roadmap";
import { cn } from "@/lib/utils";

interface FeuilleDeRoutePanelProps {
  documents: RoadmapDocument[];
  bundleRunId: string;
  op: OpCode | null;
  onOpChange: (op: OpCode | null) => void;
}

function BureauCard({ bureau, titre }: { bureau: BureauFeuille; titre?: string }) {
  return (
    <div className="rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-3 text-sm">
      {titre ? <p className="font-semibold text-[color:var(--glass-ink)]">{titre}</p> : null}
      <p className="font-medium text-[color:var(--glass-ink)]">{bureau.nom}</p>
      <p className="text-[color:var(--glass-ink-soft)]">{bureau.adresse}</p>
      {bureau.telephone ? (
        <p className="text-[color:var(--glass-ink-soft)]">{bureau.telephone}</p>
      ) : null}
      {bureau.siteWeb ? (
        <a
          href={bureau.siteWeb}
          target="_blank"
          rel="noreferrer"
          className="text-[color:var(--glass-ink)] underline underline-offset-2"
        >
          {bureau.siteWeb}
        </a>
      ) : null}
    </div>
  );
}

export function FeuilleDeRoutePanel({
  documents,
  bundleRunId,
  op,
  onOpChange,
}: FeuilleDeRoutePanelProps) {
  const t = useTranslations("public.dossier");
  const [serverData, setServerData] = useState<FeuilleServerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [unknownOpen, setUnknownOpen] = useState(false);
  const viewedSent = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/bundles/runs/${bundleRunId}/feuille-de-route`);
        if (!cancelled && res.ok) {
          const data = (await res.json()) as { serverData: FeuilleServerData | null };
          setServerData(data.serverData);
        }
      } catch {
        // Repli générique silencieux : la feuille reste utile sans adresse.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bundleRunId]);

  useEffect(() => {
    if (viewedSent.current) return;
    viewedSent.current = true;
    // Fréquentation du panneau — JAMAIS le choix d'OP (spec RGPD).
    void fetch("/api/bundles/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType: "feuille_de_route_viewed" }),
    }).catch(() => {});
  }, []);

  const feuille = buildFeuilleDeRoute({
    pieces: documents.map((d) => ({ slug: d.slug, titre: d.title })),
    serverData,
    opChoice: op,
  });

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-medium text-[color:var(--glass-ink)]">
          {t("feuilleOpQuestion")}
        </p>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={t("feuilleOpQuestion")}>
          {OP_CODES.map((code) => (
            <button
              key={code}
              type="button"
              aria-pressed={op === code}
              onClick={() => {
                setUnknownOpen(false);
                onOpChange(op === code ? null : code);
              }}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                op === code
                  ? "border-transparent bg-[color:var(--glass-ink)] text-[color:var(--glass-bg)]"
                  : "border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] text-[color:var(--glass-ink)] hover:bg-[color:var(--glass-surface-strong)]",
              )}
            >
              {OP_LABELS[code]}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={unknownOpen}
            onClick={() => {
              onOpChange(null);
              setUnknownOpen(true);
            }}
            className="rounded-full border border-dashed border-[color:var(--glass-border)] px-3 py-1.5 text-sm text-[color:var(--glass-ink-soft)] hover:bg-[color:var(--glass-surface)]"
          >
            {t("feuilleOpUnknown")}
          </button>
        </div>
        {unknownOpen ? (
          <p className="mt-2 text-sm text-[color:var(--glass-ink-soft)]">{EXPLICATION_OP}</p>
        ) : null}
      </div>

      {loading ? (
        <p className="text-sm text-[color:var(--glass-ink-soft)]">{t("feuilleLoading")}</p>
      ) : feuille.depot.mode === "bureau" ? (
        <BureauCard bureau={feuille.depot.bureau} />
      ) : feuille.depot.mode === "choix" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {feuille.depot.bureaux.map((b) => (
            <BureauCard key={b.opCode} bureau={b} titre={OP_LABELS[b.opCode]} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-[color:var(--glass-ink-soft)]">{t("feuilleGeneric")}</p>
          <Link
            href="/bureaux"
            className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-[color:var(--glass-ink)] underline underline-offset-2"
          >
            <MapPin className="size-4" aria-hidden />
            {t("feuilleFindOffice")}
          </Link>
        </div>
      )}

      <ul className="flex flex-col gap-1.5">
        {feuille.consignes.map((c) => (
          <li key={c.slug} className="text-sm text-[color:var(--glass-ink)]">
            <span className="font-medium">{c.titre}</span>{" "}
            <span className="text-[color:var(--glass-ink-soft)]">
              — {c.signatures}{" "}
              {c.exemplaires > 1 ? `(${c.exemplaires} exemplaires)` : "(1 exemplaire)"}
            </span>
          </li>
        ))}
      </ul>

      <p className="text-xs text-[color:var(--glass-ink-soft)]">{feuille.prudence}</p>
    </div>
  );
}
```

Avant d'utiliser les classes tokens (`--glass-border`, `--glass-surface-strong`…),
vérifier leur existence exacte dans `app/globals.css` et reprendre l'idiome des
sections voisines de `bundle-roadmap.tsx` (les cards de l'écran) — les noms
ci-dessus sont à ALIGNER sur l'existant, pas à inventer.

- [ ] **Step 4: Intégrer dans BundleRoadmap**

Dans `components/docbel/bundle-roadmap.tsx` :

1. Imports : `import { FeuilleDeRoutePanel } from "./feuille-de-route-panel";`
   et `import type { OpCode } from "@/lib/feuille-de-route/model";`
2. State en tête du composant : `const [op, setOp] = useState<OpCode | null>(null);`
3. Nouvelle étape ajoutée à `steps` (après l'étape docs, même forme que les
   `steps.push` existants), seulement si `bundleRunId` :

```tsx
  if (bundleRunId) {
    steps.push({
      key: "feuille",
      icon: <Landmark className="size-4" aria-hidden />,
      title: t("feuilleTitle"),
      content: (
        <FeuilleDeRoutePanel
          documents={documents}
          bundleRunId={bundleRunId}
          op={op}
          onOpChange={setOp}
        />
      ),
    });
  }
```

4. Lien zip : localiser le `href`/`fetch` qui appelle
   `/api/bundles/runs/${bundleRunId}/download-all` et lui ajouter le paramètre
   quand un OP est choisi : `` `${base}${op ? `?op=${op}` : ""}` ``.
5. E-mail : dans `sendByEmail()`, le body devient
   `JSON.stringify({ to: emailTo.trim(), consent: emailConsent, op })` (la
   route ignore `op: null`).

- [ ] **Step 5: Vérifier**

Run: `pnpm build && pnpm i18n:check && pnpm lint`
Expected: build OK ; i18n:check OK (14 locales couvertes) ; lint sans
**nouvelle** erreur (≈129 préexistantes).

- [ ] **Step 6: Commit**

```bash
git add components/docbel/feuille-de-route-panel.tsx components/docbel/bundle-roadmap.tsx lib/bundles/analytics-events.ts messages/fr.json messages/nl.json messages/de.json messages/en.json messages/es.json messages/it.json messages/pt.json messages/ro.json messages/ru.json messages/tr.json messages/ar.json messages/bg.json messages/mk.json messages/sq.json
git commit -m "feat(feuille-de-route): panneau Et maintenant ? (chips OP client-only, i18n chrome 14 locales)"
```

---

### Task 8: Validation finale, QA manuelle, mise à jour des queues

**Files:**
- Modify: `docs/tasks/NEXT_ACTIONS.md` (item #40 → absorbé)

**Interfaces:**
- Consumes: tout ce qui précède.
- Produces: lot poussé, prêt pour la relecture métier d'Oraliks.

- [ ] **Step 1: Suite complète**

Run: `pnpm test && pnpm build && pnpm lint && pnpm i18n:check`
Expected: ~2 320+ tests verts (dont les 12+ nouveaux), build OK, lint sans
nouvelle erreur, i18n OK.

- [ ] **Step 2: Audit réglementaire (lecture seule, non bloquant)**

Lancer le sous-agent `/verif-reglementation` sur
`lib/feuille-de-route/registry.ts` + `model.ts` (textes affichés). Joindre son
rapport ✅/⚠️/❓ au message de fin de lot — les ⚠️/❓ sont pour Oraliks, on ne
« corrige » pas un texte métier sans lui.

- [ ] **Step 3: QA manuelle (dev)**

Lancer le dev server (PowerShell propre — l'`ANTHROPIC_API_KEY=""` injectée
bloque l'IA, cf. mémoire projet), compléter un dossier jusqu'au verrou, puis :
- le panneau « Et maintenant ? » apparaît sur l'écran de sortie ; chips OP
  fonctionnelles ; « Je ne sais pas » affiche l'explication + les 4 bureaux ;
- le zip contient `0_LISEZ-MOI_feuille-de-route.pdf` EN PREMIER, la page cite
  le bon bureau quand un OP est choisi ;
- l'e-mail reçoit la page de garde en première pièce jointe ;
- clair/sombre OK ; la page ne « remonte » pas quand on clique une chip
  (si le contenu raccourcit, cf. règle runner — vérifier explicitement) ;
- `SELECT` sur `PdfFormSubmissionLog` + grep des logs dev : **aucune trace du
  code OP** ; l'event `feuille_de_route_viewed` existe SANS metadata OP.

- [ ] **Step 4: Mettre à jour NEXT_ACTIONS**

Item #40 : statut → `**FAIT** (feuille de route, plan 2026-08-02)` en gardant
la ligne (l'historique des items reste en place, cf. #36-#38).

- [ ] **Step 5: Commit + push**

```bash
git add docs/tasks/NEXT_ACTIONS.md
git commit -m "docs(feuille-de-route): #40 absorbé par la feuille de route"
git push
```

---

## Self-review (fait à l'écriture du plan)

- **Couverture spec** : ancrage écran + zip/mail (T6-T7) ; sélecteur OP jamais
  stocké (T4 route sans op, T6 transitoire, T7 state local) ; moteur pur +
  registre sourcé (T1-T2) ; commune canonique + replis (T3-T4) ; page de garde
  non officielle (T5) ; prudence (modèle, écran, PDF) ; analytics sans OP (T7) ;
  #40 absorbé (T1 registre + T8). Hors périmètre respecté : pas de délais, pas
  de hors-dossier, pas d'AppSetting.
- **Placeholders** : aucun TBD ; deux points de vérification à l'exécution
  (signature exacte d'`itemTitle`, noms exacts des tokens glass) sont des
  vérifications d'existant avec repli défini, pas des trous de design.
- **Cohérence de types** : `PieceFeuille{slug,titre}` partout ; `op`/`opChoice:
  OpCode|null` partout ; `FeuilleServerData` produit en T4, consommé T6/T7 ;
  `buildPageDeGarde(feuille): Promise<Uint8Array>` produit T5, consommé T6.
