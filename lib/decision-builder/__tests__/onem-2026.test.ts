import { describe, it, expect } from "vitest";
import {
  mapOnem2026ToWizardSituations,
  ONEM_2026_AVAILABLE_SLUGS,
  ONEM_2026_STUB_BUNDLES,
} from "@/prisma/seeds/data/onem-2026-tree";
import { wizardSituationsToTreeContent } from "../from-wizard";
import { treeContentToWizardSituations } from "../adapter";
import { parseTreeContent } from "../schema";
import { validateDecisionTree } from "../validator";
import {
  applyOnem2026CanonicalTags,
  ONEM_2026_CANONICAL_TAGS,
} from "../onem-canonical";

// Pipeline complet de l'arbre ONEM 2026 : mapping → contenu DB → validation.

const situations = mapOnem2026ToWizardSituations();
const content = applyOnem2026CanonicalTags(
  wizardSituationsToTreeContent(situations),
);

describe("ONEM 2026 — mapping V2 → WizardSituation[]", () => {
  it("produit 13 situations racines, dont le parcours C1", () => {
    expect(situations).toHaveLength(13);
  });

  it("toutes les icônes sont dans le set autorisé", () => {
    const ALLOWED = new Set([
      "Briefcase",
      "Search",
      "GraduationCap",
      "Hourglass",
      "Accessibility",
      "HelpCircle",
      "UserMinus",
      "MapPinned",
    ]);
    for (const s of situations) expect(ALLOWED.has(s.icon)).toBe(true);
  });

  it("force dossierSlug=null pour les orientations externes", () => {
    // Toute feuille orientation_externe doit avoir dossierSlug null.
    const externes: { availability?: string; dossierSlug: string | null }[] = [];
    function walk(result: { availability?: string; dossierSlug: string | null } | undefined) {
      if (result?.availability === "orientation_externe") externes.push(result);
    }
    for (const s of situations) {
      walk(s.result);
      for (const o of s.subQuestion?.options ?? []) {
        walk(o.result);
        for (const r of o.refineQuestion?.options ?? []) walk(r.result);
      }
    }
    expect(externes.length).toBeGreaterThan(0);
    for (const e of externes) expect(e.dossierSlug).toBeNull();
  });
});

describe("ONEM 2026 — contenu DB", () => {
  it("est schéma-valide", () => {
    expect(() => parseTreeContent(content)).not.toThrow();
  });

  it("est PUBLIABLE avec seulement les 3 dossiers réels (a_creer/externe non bloquants)", () => {
    const active = new Set<string>(ONEM_2026_AVAILABLE_SLUGS);
    const report = validateDecisionTree(content, active);
    expect(report.errors).toEqual([]);
    expect(report.publishable).toBe(true);
    // Les dossiers "à créer" génèrent des warnings, pas des erreurs.
    expect(report.warnings.length).toBeGreaterThan(0);
  });

  it("round-trip via l'adapter sans perte de structure", () => {
    const back = treeContentToWizardSituations(content);
    expect(back).toHaveLength(situations.length);
    expect(back.map((s) => s.label)).toEqual(situations.map((s) => s.label));
  });

  it("porte les faits canoniques sûrs utilisés par le dossier chômage complet", () => {
    for (const [id, canonical] of Object.entries(ONEM_2026_CANONICAL_TAGS)) {
      const node = content.nodes[id];
      expect(node?.type).toBe("option");
      expect(node?.type === "option" ? node.canonical : null).toEqual(canonical);
    }
    expect(applyOnem2026CanonicalTags(content)).toEqual(content);
  });
});

describe("ONEM 2026 — stubs", () => {
  it("liste 15 dossiers stub à créer", () => {
    expect(ONEM_2026_STUB_BUNDLES).toHaveLength(15);
  });

  it("aucun stub ne collisionne avec les 3 dossiers réels", () => {
    const stubSlugs = new Set(ONEM_2026_STUB_BUNDLES.map((b) => b.slug));
    for (const real of ONEM_2026_AVAILABLE_SLUGS) {
      expect(stubSlugs.has(real)).toBe(false);
    }
  });
});
