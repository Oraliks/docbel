import { describe, it, expect } from "vitest";
import { buildProfilePrefill } from "../profile-prefill";
import type { PublicField } from "../public-serializer";

function field(id: string, opts: Partial<PublicField> = {}): PublicField {
  return {
    id,
    type: "text",
    required: false,
    label: { fr: id, nl: "", de: "" },
    ...opts,
  } as PublicField;
}

const PROFILE = { firstName: "Marie", lastName: "Dupont", niss: "85073003328", city: "Bruxelles" };

describe("buildProfilePrefill", () => {
  it("mappe les champs par leur prefillFrom", () => {
    const fields = [
      field("nom", { prefillFrom: "profile.lastName" }),
      field("commune", { prefillFrom: "profile.city" }),
      field("libre"),
    ];
    const out = buildProfilePrefill(fields, PROFILE);
    expect(out.nom).toBe("Dupont");
    expect(out.commune).toBe("Bruxelles");
    expect(out.libre).toBeUndefined();
  });

  /// Les champs composites n'ont PAS de `prefillFrom` : celui-ci ne transporte
  /// qu'une chaîne, et le runner relit une chaîne comme un NOM — le prénom
  /// finissait dans la case « Nom ». Le profil doit donc les remplir par leur
  /// TYPE, comme le fait la voie canonique.
  describe("champs composites `fullname`", () => {
    const fields = [field("nomComplet", { type: "fullname" })];

    it("compose { first, last } depuis le profil", () => {
      expect(buildProfilePrefill(fields, PROFILE).nomComplet).toEqual({
        first: "Marie",
        last: "Dupont",
      });
    });

    it("remplit même si une seule moitié est connue", () => {
      expect(buildProfilePrefill(fields, { lastName: "Dupont" }).nomComplet).toEqual({
        first: "",
        last: "Dupont",
      });
    });

    it("ne remplit rien quand le profil n'a ni prénom ni nom", () => {
      expect(buildProfilePrefill(fields, { city: "Bruxelles" }).nomComplet).toBeUndefined();
    });

    it("ignore les espaces seuls", () => {
      expect(buildProfilePrefill(fields, { firstName: "  ", lastName: "  " }).nomComplet).toBeUndefined();
    });
  });
});
