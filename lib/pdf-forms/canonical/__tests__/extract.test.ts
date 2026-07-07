import { describe, it, expect } from "vitest";
import type { PdfFormField } from "../../types";
import {
  extractCanonical,
  canonicalToPrefill,
  mergeCanonical,
  extractCanonicalFromMany,
} from "../extract";
import { C1_QUESTIONS } from "../../seed/c1-fields-improvements";
import { C1A_FIELDS } from "../../seed/c1a-fields";
import { C1B_FIELDS } from "../../seed/c1b-fields";
import { C1C_FIELDS } from "../../seed/c1c-fields";
import { C46_FIELDS } from "../../seed/c46-fields";
import { C47_FIELDS } from "../../seed/c47-fields";
import { C1_REGIS_FIELDS } from "../../seed/c1-regis-fields";
import { C1_PARTENAIRE_FIELDS } from "../../seed/c1-partenaire-fields";

function field(id: string, opts?: Partial<PdfFormField>): PdfFormField {
  return {
    id,
    pdfFieldName: opts?.pdfFieldName ?? "",
    type: opts?.type ?? "text",
    required: false,
    label: { fr: id, nl: "", de: "" },
    ...opts,
  };
}

describe("extractCanonical — vue simple", () => {
  it("extrait uniquement les champs porteurs d'un canonicalKey", () => {
    const fields: PdfFormField[] = [
      field("a", { canonicalKey: "identity.nom" }),
      field("b", { canonicalKey: "identity.prenom" }),
      field("c" /* pas de canonicalKey */),
    ];
    const canonical = extractCanonical(fields, { a: "Dupont", b: "Marie", c: "ignoré" });
    expect(canonical).toEqual({ "identity.nom": "Dupont", "identity.prenom": "Marie" });
  });

  it("ignore les valeurs vides / null / undefined / whitespace", () => {
    const fields: PdfFormField[] = [
      field("a", { canonicalKey: "identity.nom" }),
      field("b", { canonicalKey: "identity.prenom" }),
      field("c", { canonicalKey: "identity.niss" }),
      field("d", { canonicalKey: "banque.iban" }),
    ];
    const canonical = extractCanonical(fields, { a: "", b: null, c: "  ", d: undefined });
    expect(canonical).toEqual({});
  });

  it("coerce number et boolean en string, trime", () => {
    const fields: PdfFormField[] = [
      field("age", { canonicalKey: "identity.dateNaissance" }),
      field("flag", { canonicalKey: "identity.nationalite" }),
      field("padded", { canonicalKey: "identity.nom" }),
    ];
    const canonical = extractCanonical(fields, { age: 1980, flag: true, padded: "  Dupont  " });
    expect(canonical["identity.dateNaissance"]).toBe("1980");
    expect(canonical["identity.nationalite"]).toBe("true");
    expect(canonical["identity.nom"]).toBe("Dupont");
  });

  it("clé canonique inconnue → ignorée (safe défaut)", () => {
    const fields: PdfFormField[] = [
      field("a", { canonicalKey: "unknown.slug" }),
      field("b", { canonicalKey: "identity.nom" }),
    ];
    const canonical = extractCanonical(fields, { a: "ignored", b: "Kept" });
    expect(canonical).toEqual({ "identity.nom": "Kept" });
  });

  it("fullname { first, last } → concaténé si canonicalKey posé", () => {
    const fields: PdfFormField[] = [
      field("who", { type: "fullname", canonicalKey: "identity.nom" }),
    ];
    const canonical = extractCanonical(fields, { who: { first: " Marie ", last: " Dupont " } });
    expect(canonical["identity.nom"]).toBe("Marie Dupont");
  });
});

describe("canonicalToPrefill — vue simple", () => {
  it("mappe la canonique vers les ids des champs cibles porteurs de la même clé", () => {
    const targetFields: PdfFormField[] = [
      field("nomTarget", { canonicalKey: "identity.nom" }),
      field("prenomTarget", { canonicalKey: "identity.prenom" }),
      field("autre", { canonicalKey: "banque.iban" }),
    ];
    const prefill = canonicalToPrefill(targetFields, {
      "identity.nom": "Dupont",
      "identity.prenom": "Marie",
    });
    expect(prefill).toEqual({ nomTarget: "Dupont", prenomTarget: "Marie" });
  });

  it("ignore les champs cibles sans canonicalKey", () => {
    const targetFields: PdfFormField[] = [
      field("orphelin"),
      field("mappe", { canonicalKey: "identity.nom" }),
    ];
    expect(canonicalToPrefill(targetFields, { "identity.nom": "X" })).toEqual({ mappe: "X" });
  });

  it("aucun match → objet vide (safe pour les callers)", () => {
    const targetFields: PdfFormField[] = [field("a", { canonicalKey: "identity.nom" })];
    expect(canonicalToPrefill(targetFields, { "banque.iban": "BE68" })).toEqual({});
  });
});

describe("mergeCanonical / extractCanonicalFromMany", () => {
  it("mergeCanonical : la 1ʳᵉ occurrence gagne (priorité décroissante)", () => {
    const merged = mergeCanonical(
      { "identity.nom": "A", "banque.iban": "IBAN_A" },
      { "identity.nom": "B", "identity.prenom": "P_B" }
    );
    expect(merged).toEqual({
      "identity.nom": "A", // A gagne (première occurrence)
      "banque.iban": "IBAN_A",
      "identity.prenom": "P_B",
    });
  });

  it("extractCanonicalFromMany : agrège plusieurs (fields, payload) → carte fusionnée", () => {
    const f1: PdfFormField[] = [field("n", { canonicalKey: "identity.nom" })];
    const f2: PdfFormField[] = [field("p", { canonicalKey: "identity.prenom" })];
    const canonical = extractCanonicalFromMany([
      { fields: f1, payload: { n: "Dupont" } },
      { fields: f2, payload: { p: "Marie" } },
    ]);
    expect(canonical).toEqual({ "identity.nom": "Dupont", "identity.prenom": "Marie" });
  });
});

describe("Aller-retour C1 → compagnons (test métier)", () => {
  it("le NISS du C1 se réinjecte dans le C1A", () => {
    const c1Payload = { niss: "80.10.15-123.45" };
    const canonical = extractCanonical(C1_QUESTIONS, c1Payload);
    expect(canonical["identity.niss"]).toBe("80.10.15-123.45");

    const c1aPrefill = canonicalToPrefill(C1A_FIELDS, canonical);
    // C1A a un champ id="niss" tagué canonicalKey="identity.niss".
    expect(c1aPrefill.niss).toBe("80.10.15-123.45");
  });

  it("nom + prénom du C1 se réinjectent dans le C1B (canonicalisés)", () => {
    const c1Payload = { nom: "Dupont", pr_nom: "Marie", niss: "80.10.15-123.45" };
    const canonical = extractCanonical(C1_QUESTIONS, c1Payload);
    const c1bPrefill = canonicalToPrefill(C1B_FIELDS, canonical);
    expect(c1bPrefill.nom).toBe("Dupont");
    expect(c1bPrefill.pr_nom).toBe("Marie");
    expect(c1bPrefill.niss).toBe("80.10.15-123.45");
  });

  it("l'adresse et le contact du C1 alimentent le C47", () => {
    const c1Payload = {
      niss: "80.10.15-123.45",
      code_postal: "1000",
      adresse_email_facultatif: "marie@example.be",
      num_ro_de_t_l_phone_facultatif: "0470 12 34 56",
    };
    const canonical = extractCanonical(C1_QUESTIONS, c1Payload);
    const c47Prefill = canonicalToPrefill(C47_FIELDS, canonical);
    expect(c47Prefill.niss).toBe("80.10.15-123.45");
    expect(c47Prefill.email).toBe("marie@example.be");
    expect(c47Prefill.t_l_phone).toBe("0470 12 34 56");
    // Pas de correspondance pour rue/commune combinés → non prefill.
    expect(c47Prefill.rue).toBeUndefined();
  });
});

describe("Complétude des seeds compagnons (identity.niss min. requis)", () => {
  const compagnons: Array<[string, PdfFormField[]]> = [
    ["C1", C1_QUESTIONS],
    ["C1A", C1A_FIELDS],
    ["C1B", C1B_FIELDS],
    ["C1C", C1C_FIELDS],
    ["C46", C46_FIELDS],
    ["C47", C47_FIELDS],
    ["C1-REGIS", C1_REGIS_FIELDS],
    ["C1-PARTENAIRE", C1_PARTENAIRE_FIELDS],
  ];

  it.each(compagnons)(
    "%s : au moins un champ identité canonisé (niss OU nom OU prenom)",
    (_name, fields) => {
      // Chaque compagnon collecte AU MOINS UNE clé d'identité. Le C1-REGIS
      // par ex. ne demande pas le NISS mais bien le nom + prénom — la
      // condition « au moins l'un des trois » couvre les deux cas.
      const hasIdentity = fields.some(
        (f) =>
          f.canonicalKey === "identity.niss" ||
          f.canonicalKey === "identity.nom" ||
          f.canonicalKey === "identity.prenom"
      );
      expect(hasIdentity).toBe(true);
    }
  );
});
