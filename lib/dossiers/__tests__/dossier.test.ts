import { describe, it, expect } from "vitest";
import { CATALOG } from "@/lib/fields/catalog";
import { getDossier, isCodeDossier, listDossiers } from "../registry";
import { filterMotifOptions, selectDocuments } from "../types";
import { resolveDocumentFields } from "../resolve";
import { chomageTemporaire, MOTIFS, WHO_CONCERNED, natureDA } from "../chomage-temporaire";
import { interpolateTheoryBody, visibleTheorySections } from "../theory";

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
  it("les slugs de documents sont uniques entre dossiers codés", () => {
    const seen = new Map<string, string>();
    for (const dossier of listDossiers()) {
      for (const doc of dossier.documents) {
        expect(seen.get(doc.slug), `document slug dupliqué: ${doc.slug}`).toBeUndefined();
        seen.set(doc.slug, dossier.slug);
      }
    }
  });
});

describe("chômage temporaire — 11 motifs officiels", () => {
  it("expose exactement 11 motifs (nomenclature ONEM)", () => {
    expect(MOTIFS).toHaveLength(11);
  });
  it("contient les motifs phares", () => {
    expect(MOTIFS).toContain("Économique");
    expect(MOTIFS).toContain("Force majeure");
    expect(MOTIFS).toContain("Force majeure médicale");
    expect(MOTIFS).toContain("Suspension employés");
  });
  it("ne contient plus le faux motif \"Action sociale\"", () => {
    expect(MOTIFS as readonly string[]).not.toContain("Action sociale");
  });
  it("est aligné avec chomageTemporaire.types", () => {
    expect(chomageTemporaire.types).toEqual([...MOTIFS]);
  });
});

describe("matrice qui est concerné", () => {
  it("économique exclut les employés (qui passent par Suspension employés)", () => {
    expect(WHO_CONCERNED["Économique"]).toEqual(["ouvrier", "interimaire"]);
  });
  it("suspension employés est exclusivement employé", () => {
    expect(WHO_CONCERNED["Suspension employés"]).toEqual(["employe"]);
  });
  it("force majeure médicale exclut les intérimaires", () => {
    expect(WHO_CONCERNED["Force majeure médicale"]).toEqual(["ouvrier", "employe"]);
  });
  it("filterMotifOptions filtre selon le statut répondu", () => {
    const all = [...MOTIFS];
    const ouvrier = filterMotifOptions(chomageTemporaire, all, "ouvrier");
    expect(ouvrier).toContain("Économique");
    expect(ouvrier).not.toContain("Suspension employés");
    const employe = filterMotifOptions(chomageTemporaire, all, "employe");
    expect(employe).not.toContain("Économique");
    expect(employe).toContain("Suspension employés");
    const interim = filterMotifOptions(chomageTemporaire, all, "interimaire");
    expect(interim).toContain("Force majeure");
    expect(interim).not.toContain("Force majeure médicale");
  });
  it("sans statut → la liste n'est pas filtrée", () => {
    expect(filterMotifOptions(chomageTemporaire, [...MOTIFS], undefined)).toEqual([...MOTIFS]);
  });
});

describe("nature de DA (code ONEM dérivé)", () => {
  it("transfert prioritaire", () => {
    expect(natureDA({ transfertEnCours: true, motif: "Économique" })?.code).toBe("TFT");
  });
  it("66+ détecté avant TPL", () => {
    expect(natureDA({ age66Plus: true, premiereDemande: true })?.code).toBe("CTP");
  });
  it("première demande → TPL", () => {
    expect(natureDA({ premiereDemande: true, motif: "Économique" })?.code).toBe("TPL");
  });
  it("économique récurrent (pas première) → INT", () => {
    expect(natureDA({ motif: "Économique", statut: "ouvrier" })?.code).toBe("INT");
  });
  it("force majeure récurrent → TEM", () => {
    expect(natureDA({ motif: "Force majeure" })?.code).toBe("TEM");
  });
  it("vacances annuelles récurrent → VAC", () => {
    expect(natureDA({ motif: "Vacances annuelles" })?.code).toBe("VAC");
  });
  it("aucun signal → null", () => {
    expect(natureDA({})).toBeNull();
  });
});

describe("sélection des documents (nouvelle règle)", () => {
  it("économique récurrent → seul le C32 travailleur", () => {
    const slugs = selectDocuments(chomageTemporaire, { motif: "Économique" }).map((d) => d.slug);
    expect(slugs).toEqual(["c32-travailleur"]);
  });
  it("première demande → C32 + C1", () => {
    const slugs = selectDocuments(chomageTemporaire, {
      motif: "Économique",
      premiereDemande: true,
    }).map((d) => d.slug);
    expect(slugs).toContain("c32-travailleur");
    expect(slugs).toContain("c1-travailleur");
  });
  it("modificationC1 sans première demande → C32 + C1", () => {
    const slugs = selectDocuments(chomageTemporaire, {
      motif: "Économique",
      modificationC1: true,
    }).map((d) => d.slug);
    expect(slugs).toContain("c1-travailleur");
  });
  it("66+ → C1 même sans première demande", () => {
    const slugs = selectDocuments(chomageTemporaire, {
      motif: "Économique",
      age66Plus: true,
    }).map((d) => d.slug);
    expect(slugs).toContain("c1-travailleur");
  });
  it("force majeure médicale → C32 remplacé par C6 (pas de C32)", () => {
    const slugs = selectDocuments(chomageTemporaire, { motif: "Force majeure médicale" }).map((d) => d.slug);
    expect(slugs).not.toContain("c32-travailleur");
    expect(slugs).toContain("c6-fmm");
  });
  it("FMM + trajet de réintégration → C27R en plus", () => {
    const slugs = selectDocuments(chomageTemporaire, {
      motif: "Force majeure médicale",
      trajetReintegration: true,
    }).map((d) => d.slug);
    expect(slugs).toContain("c6-fmm");
    expect(slugs).toContain("c27r-fmm");
  });
});

describe("résolution des champs depuis le catalogue", () => {
  it("résout NISS sur le C32", () => {
    const c32 = chomageTemporaire.documents.find((d) => d.slug === "c32-travailleur")!;
    const fields = resolveDocumentFields(c32);
    const niss = fields.find((f) => f.key === "niss");
    expect(niss?.type).toBe("niss");
    expect(niss?.pdfFieldName).toBe("NISS");
    expect(niss?.prefillFrom).toBe("profile.niss");
  });
});

describe("espace théorique", () => {
  it("expose plusieurs sections", () => {
    expect((chomageTemporaire.theory ?? []).length).toBeGreaterThan(3);
  });
  it("filtre par audience", () => {
    const partner = visibleTheorySections(chomageTemporaire, "partner");
    const publicSecs = visibleTheorySections(chomageTemporaire, "public");
    expect(partner.length).toBeGreaterThan(0);
    expect(publicSecs.length).toBe(0); // aucune section publique pour l'instant
  });
  it("interpole {{ motifs }} en liste à puces des 11 motifs", () => {
    const sec = chomageTemporaire.theory!.find((s) => s.id === "motifs")!;
    const rendered = interpolateTheoryBody(sec, chomageTemporaire);
    for (const m of MOTIFS) expect(rendered).toContain(`- ${m}`);
  });
  it("interpole {{ qui-est-concerne }} en tableau Markdown", () => {
    const sec = chomageTemporaire.theory!.find((s) => s.id === "qui-est-concerne")!;
    const rendered = interpolateTheoryBody(sec, chomageTemporaire);
    expect(rendered).toContain("| Motif | Ouvrier | Employé | Intérimaire |");
    expect(rendered).toContain("Économique");
  });
  it("interpole {{ documents }} avec tous les documents listés", () => {
    const sec = chomageTemporaire.theory!.find((s) => s.id === "documents")!;
    const rendered = interpolateTheoryBody(sec, chomageTemporaire);
    expect(rendered).toContain("**C3.2 — Travailleur**");
    expect(rendered).toContain("**C1 — Demande d'allocations**");
  });
});
