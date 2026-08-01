import { describe, it, expect } from "vitest";
import {
  extractSharedValues,
  mergeSharedValues,
  applySharedValuesToForm,
  buildBundleSharedMaps,
} from "../shared-values";
import type { PublicField } from "@/lib/pdf-forms/public-serializer";

function field(p: Partial<PublicField> & Pick<PublicField, "id" | "type">): PublicField {
  return { required: false, label: { fr: p.id }, ...p } as PublicField;
}

describe("extractSharedValues", () => {
  it("extrait les champs marqués prefillFrom = profile.* / itsme.*", () => {
    const fields = [
      field({ id: "niss", type: "niss", prefillFrom: "profile.niss" }),
      field({ id: "nom", type: "text", prefillFrom: "profile.lastName" }),
      field({ id: "libre", type: "text" }),
    ];
    const payload = { niss: "85073003328", nom: "Dupont", libre: "ignoré" };
    expect(extractSharedValues(fields, payload)).toEqual({
      "profile.niss": "85073003328",
      "profile.lastName": "Dupont",
    });
  });

  it("ignore les valeurs vides ou non-chaînes", () => {
    const fields = [
      field({ id: "a", type: "text", prefillFrom: "profile.firstName" }),
      field({ id: "b", type: "checkbox", prefillFrom: "profile.email" }),
    ];
    expect(extractSharedValues(fields, { a: "", b: true })).toEqual({});
  });
});

describe("mergeSharedValues — priorité au premier", () => {
  it("la première occurrence l'emporte", () => {
    const merged = mergeSharedValues(
      { "profile.niss": "85073003328" },
      { "profile.niss": "00000000000", "profile.email": "x@y.be" }
    );
    expect(merged).toEqual({ "profile.niss": "85073003328", "profile.email": "x@y.be" });
  });
});

describe("applySharedValuesToForm", () => {
  it("mappe valeurs partagées → ids du formulaire cible via prefillFrom", () => {
    const target = [
      field({ id: "national_number", type: "niss", prefillFrom: "profile.niss" }),
      field({ id: "surname", type: "text", prefillFrom: "profile.lastName" }),
      field({ id: "remarks", type: "textarea" }),
    ];
    const shared = { "profile.niss": "85073003328", "profile.lastName": "Dupont" };
    expect(applySharedValuesToForm(target, shared)).toEqual({
      national_number: "85073003328",
      surname: "Dupont",
    });
  });

  it("ne renvoie pas les champs sans valeur partagée correspondante", () => {
    const target = [field({ id: "x", type: "text", prefillFrom: "profile.iban" })];
    expect(applySharedValuesToForm(target, { "profile.niss": "85073003328" })).toEqual({});
  });
});

describe("buildBundleSharedMaps — S3 : le plus petit `order` doit gagner", () => {
  // `items` est supposé déjà trié par `order` croissant par l'appelant (requête
  // Prisma `orderBy: { order: "asc" }`, cf. page.tsx) — la fonction fait
  // confiance à l'ordre reçu et fusionne en « premier arrivé, premier servi ».
  const identityField = field({ id: "nom", type: "text", canonicalKey: "identity.nom" });
  const nissField = field({ id: "niss", type: "niss", prefillFrom: "profile.niss" });

  it("le document passé en premier (plus petit order) l'emporte sur un doublon", () => {
    const items = [
      { pdfForm: { id: "form-a", fields: [identityField, nissField] } },
      { pdfForm: { id: "form-b", fields: [identityField, nissField] } },
    ];
    const payloads = {
      "form-a": { nom: "Dupont", niss: "85073003328" },
      "form-b": { nom: "Martin", niss: "00000000000" },
    };
    const { shared, canonical } = buildBundleSharedMaps(items, "form-courant", payloads);
    expect(canonical["identity.nom"]).toBe("Dupont");
    expect(shared["profile.niss"]).toBe("85073003328");
  });

  it("le résultat est stable quel que soit le contenu des documents suivants", () => {
    const items = [
      { pdfForm: { id: "form-a", fields: [identityField] } },
      { pdfForm: { id: "form-b", fields: [identityField] } },
      { pdfForm: { id: "form-c", fields: [identityField] } },
    ];
    const payloads = {
      "form-a": { nom: "Dupont" },
      "form-b": { nom: "Martin" },
      "form-c": { nom: "Leroy" },
    };
    const run1 = buildBundleSharedMaps(items, "form-courant", payloads);
    const run2 = buildBundleSharedMaps(items, "form-courant", payloads);
    expect(run1.canonical["identity.nom"]).toBe("Dupont");
    expect(run2.canonical["identity.nom"]).toBe("Dupont");
  });

  it("exclut le document COURANT même s'il porte déjà un payload", () => {
    const items = [{ pdfForm: { id: "form-courant", fields: [identityField] } }];
    const payloads = { "form-courant": { nom: "Dupont" } };
    const { shared, canonical } = buildBundleSharedMaps(items, "form-courant", payloads);
    expect(shared).toEqual({});
    expect(canonical).toEqual({});
  });

  it("ignore les documents du bundle pas encore complétés (aucun payload)", () => {
    const items = [
      { pdfForm: { id: "form-a", fields: [identityField] } },
      { pdfForm: { id: "form-b", fields: [identityField] } },
    ];
    const payloads = { "form-b": { nom: "Martin" } };
    const { canonical } = buildBundleSharedMaps(items, "form-courant", payloads);
    expect(canonical["identity.nom"]).toBe("Martin");
  });

  it("ignore les items sans pdfForm résolu (déclencheur introuvable)", () => {
    const items = [{ pdfForm: null }];
    const { shared, canonical } = buildBundleSharedMaps(items, "form-courant", {});
    expect(shared).toEqual({});
    expect(canonical).toEqual({});
  });
});
