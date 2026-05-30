import { describe, it, expect } from "vitest";
import {
  extractSharedValues,
  mergeSharedValues,
  applySharedValuesToForm,
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
