import { describe, it, expect } from "vitest";
import { CATALOG } from "@/lib/fields/catalog";
import { getDossier, isCodeDossier, listDossiers } from "../registry";
import { selectDocuments } from "../types";
import { resolveDocumentFields } from "../resolve";
import { chomageTemporaire, MOTIFS } from "../chomage-temporaire";

describe("catalogue de champs", () => {
  it("chaque entrée a une clé cohérente avec son index", () => {
    for (const [k, v] of Object.entries(CATALOG)) {
      expect(v.key).toBe(k);
      expect(v.pdfFieldName.length).toBeGreaterThan(0);
      expect(v.label.fr).toBeTruthy();
    }
  });
  it("NISS = type niss + prefill profil", () => {
    expect(CATALOG.niss.type).toBe("niss");
    expect(CATALOG.niss.prefillFrom).toBe("profile.niss");
  });
  it("creationDate = prefill system.today", () => {
    expect(CATALOG.creationDate.prefillFrom).toBe("system.today");
  });
});

describe("registre des dossiers", () => {
  it("chômage temporaire est un dossier codé", () => {
    expect(isCodeDossier("chomage-temporaire")).toBe(true);
    expect(getDossier("chomage-temporaire")?.title).toBe("Chômage temporaire");
  });
  it("un slug inconnu n'est pas codé", () => {
    expect(isCodeDossier("inexistant")).toBe(false);
    expect(getDossier("inexistant")).toBeNull();
  });
  it("listDossiers contient au moins le chômage temporaire", () => {
    expect(listDossiers().map((d) => d.slug)).toContain("chomage-temporaire");
  });
});

describe("chômage temporaire — sélection de documents", () => {
  it("inclut les 2 documents toujours requis sans motif particulier", () => {
    const docs = selectDocuments(chomageTemporaire, { motif: "Économique" });
    expect(docs.map((d) => d.slug)).toEqual(["c32-travailleur", "c32-employeur"]);
  });
  it("ajoute le document Force majeure quand motif = Force majeure", () => {
    const docs = selectDocuments(chomageTemporaire, { motif: "Force majeure" });
    expect(docs.map((d) => d.slug)).toContain("c32a-force-majeure");
    expect(docs.map((d) => d.slug)).not.toContain("c32a-intemperies");
  });
  it("ajoute le document Intempéries quand motif = Intempéries", () => {
    const docs = selectDocuments(chomageTemporaire, { motif: "Intempéries" });
    expect(docs.map((d) => d.slug)).toContain("c32a-intemperies");
  });
  it("expose les 7 motifs", () => {
    expect(chomageTemporaire.types).toHaveLength(7);
    expect(MOTIFS).toContain("Force majeure");
  });
});

describe("filtrage des items du bundle (intégration runner)", () => {
  it("sans motif, seuls les documents inconditionnels sont applicables", () => {
    const slugs = selectDocuments(chomageTemporaire, {}).map((d) => d.slug);
    expect(slugs).toEqual(["c32-travailleur", "c32-employeur"]);
  });
  it("motif = Force majeure → FMM ajouté, Intempéries non", () => {
    const slugs = selectDocuments(chomageTemporaire, { motif: "Force majeure" }).map((d) => d.slug);
    expect(slugs).toContain("c32a-force-majeure");
    expect(slugs).not.toContain("c32a-intemperies");
  });
  it("motif = Intempéries → Intempéries ajouté, FMM non", () => {
    const slugs = selectDocuments(chomageTemporaire, { motif: "Intempéries" }).map((d) => d.slug);
    expect(slugs).toContain("c32a-intemperies");
    expect(slugs).not.toContain("c32a-force-majeure");
  });
  it("motif = Économique → aucun document conditionnel", () => {
    const slugs = selectDocuments(chomageTemporaire, { motif: "Économique" }).map((d) => d.slug);
    expect(slugs).toEqual(["c32-travailleur", "c32-employeur"]);
  });
});

describe("résolution des champs depuis le catalogue", () => {
  it("résout une référence canonique (NISS) avec ses métadonnées", () => {
    const doc = chomageTemporaire.documents[0];
    const fields = resolveDocumentFields(doc);
    const niss = fields.find((f) => f.key === "niss");
    expect(niss).toBeTruthy();
    expect(niss?.type).toBe("niss");
    expect(niss?.pdfFieldName).toBe("NISS");
    expect(niss?.prefillFrom).toBe("profile.niss");
    expect(niss?.required).toBe(true);
  });
  it("résout un champ custom (évènement de force majeure)", () => {
    const fmm = chomageTemporaire.documents.find((d) => d.slug === "c32a-force-majeure")!;
    const fields = resolveDocumentFields(fmm);
    const ev = fields.find((f) => f.key === "evenement");
    expect(ev?.type).toBe("textarea");
    expect(ev?.pdfFieldName).toBe("Event");
  });
});
