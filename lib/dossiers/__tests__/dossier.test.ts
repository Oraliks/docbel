// Tests du MOTEUR générique des dossiers codés (registre, sélection de
// documents, résolution des champs depuis le catalogue, espace théorique).
//
// Les assertions métier du chômage temporaire (11 motifs, matrice
// `whoConcerned`, codes de nature de DA) et des allocations d'insertion
// (journey en 4 étapes) vivaient ici jusqu'au 2026-07-28 : ces deux dossiers
// ont été supprimés pour être refaits sur la base du form runner du C1. Le
// moteur, lui, reste couvert — contre `chomage-complet` et des définitions
// synthétiques, pour ne dépendre d'aucune donnée métier en particulier.

import { describe, it, expect } from "vitest";
import { CATALOG } from "@/lib/fields/catalog";
import { getDossier, isCodeDossier, listDossiers } from "../registry";
import { filterMotifOptions, selectDocuments } from "../types";
import type { DossierDefinition, DossierDocument } from "../types";
import { resolveDocumentFields } from "../resolve";
import { chomageComplet } from "../chomage-complet";
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
  it("le chômage complet est un dossier codé", () => {
    expect(isCodeDossier("chomage-complet")).toBe(true);
    expect(getDossier("chomage-complet")?.title).toBe("Chômage complet");
  });
  it("un slug inconnu n'est pas codé", () => {
    expect(isCodeDossier("inexistant")).toBe(false);
    expect(getDossier("inexistant")).toBeNull();
  });
  it("listDossiers expose les dossiers codés", () => {
    const slugs = listDossiers().map((d) => d.slug);
    expect(slugs).toContain("chomage-complet");
    expect(slugs).toContain("changement-situation-personnelle");
  });
  it("ne référence plus les dossiers supprimés le 2026-07-28", () => {
    const slugs = listDossiers().map((d) => d.slug);
    expect(slugs).not.toContain("chomage-temporaire");
    expect(slugs).not.toContain("allocations-insertion");
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

// Définition synthétique : le moteur ne doit dépendre d'aucun dossier réel.
const FAKE: DossierDefinition = {
  slug: "fake",
  title: "Dossier de test",
  organism: "ONEM",
  types: ["Alpha", "Beta"],
  whoConcerned: { Alpha: ["ouvrier", "interimaire"], Beta: ["employe"] },
  questions: [],
  documents: [
    { slug: "doc-toujours", title: "Toujours", issuer: "ONEM", fields: [] },
    {
      slug: "doc-conditionnel",
      title: "Conditionnel",
      issuer: "ONEM",
      includeWhen: (a) => a.motif === "Alpha",
      fields: [],
    },
  ],
};

describe("filterMotifOptions — matrice whoConcerned", () => {
  it("filtre selon le statut répondu", () => {
    expect(filterMotifOptions(FAKE, ["Alpha", "Beta"], "ouvrier")).toEqual(["Alpha"]);
    expect(filterMotifOptions(FAKE, ["Alpha", "Beta"], "employe")).toEqual(["Beta"]);
    expect(filterMotifOptions(FAKE, ["Alpha", "Beta"], "interimaire")).toEqual(["Alpha"]);
  });
  it("sans statut → la liste n'est pas filtrée", () => {
    expect(filterMotifOptions(FAKE, ["Alpha", "Beta"], undefined)).toEqual(["Alpha", "Beta"]);
  });
  it("sans matrice whoConcerned → la liste n'est pas filtrée", () => {
    const sansMatrice: DossierDefinition = { ...FAKE, whoConcerned: undefined };
    expect(filterMotifOptions(sansMatrice, ["Alpha", "Beta"], "employe")).toEqual(["Alpha", "Beta"]);
  });
});

describe("selectDocuments — inclusion conditionnelle", () => {
  it("un document sans includeWhen est toujours inclus", () => {
    expect(selectDocuments(FAKE, {}).map((d) => d.slug)).toEqual(["doc-toujours"]);
  });
  it("includeWhen satisfait → le document s'ajoute", () => {
    expect(selectDocuments(FAKE, { motif: "Alpha" }).map((d) => d.slug)).toEqual([
      "doc-toujours",
      "doc-conditionnel",
    ]);
  });
});

describe("résolution des champs depuis le catalogue", () => {
  it("résout une référence canonique (niss) avec son prefill", () => {
    const doc: DossierDocument = {
      slug: "doc-test",
      title: "Doc de test",
      issuer: "ONEM",
      fields: [{ field: "niss", required: true }],
    };
    const niss = resolveDocumentFields(doc)[0];
    expect(niss.key).toBe("niss");
    expect(niss.type).toBe("niss");
    expect(niss.pdfFieldName).toBe(CATALOG.niss.pdfFieldName);
    expect(niss.prefillFrom).toBe("profile.niss");
    expect(niss.required).toBe(true);
  });
  it("un pdfFieldName explicite surcharge celui du catalogue", () => {
    const doc: DossierDocument = {
      slug: "doc-test",
      title: "Doc de test",
      issuer: "ONEM",
      fields: [{ field: "niss", pdfFieldName: "NISS_BIS" }],
    };
    expect(resolveDocumentFields(doc)[0].pdfFieldName).toBe("NISS_BIS");
  });
});

describe("espace théorique", () => {
  it("expose plusieurs sections sur le chômage complet", () => {
    expect((chomageComplet.theory ?? []).length).toBeGreaterThan(1);
  });
  it("filtre par audience", () => {
    expect(visibleTheorySections(chomageComplet, "partner").length).toBeGreaterThan(0);
    expect(visibleTheorySections(chomageComplet, "public").length).toBe(0);
  });
  it("interpole {{ documents }} avec les documents du dossier", () => {
    const sec = chomageComplet.theory!.find((s) => s.id === "documents-a-preparer")!;
    const rendered = interpolateTheoryBody(sec, chomageComplet);
    expect(rendered).not.toContain("{{ documents }}");
    for (const doc of chomageComplet.documents) expect(rendered).toContain(doc.title);
  });
});
