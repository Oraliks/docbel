import { describe, expect, it } from "vitest";
import { isEeeOrSuisseNationality } from "../nationalite-eee";

describe("isEeeOrSuisseNationality", () => {
  it("reconnaît les démonymes belges/français/suisse (accents, casse)", () => {
    expect(isEeeOrSuisseNationality("Belge")).toBe(true);
    expect(isEeeOrSuisseNationality("belge")).toBe(true);
    expect(isEeeOrSuisseNationality("BELGE")).toBe(true);
    expect(isEeeOrSuisseNationality("Française")).toBe(true);
    expect(isEeeOrSuisseNationality("français")).toBe(true);
    expect(isEeeOrSuisseNationality("Néerlandaise")).toBe(true);
    expect(isEeeOrSuisseNationality("Suisse")).toBe(true);
  });

  it("reconnaît un nom de pays composé ou accentué", () => {
    expect(isEeeOrSuisseNationality("Pays-Bas")).toBe(true);
    expect(isEeeOrSuisseNationality("République tchèque")).toBe(true);
    expect(isEeeOrSuisseNationality("Tchèque")).toBe(true);
  });

  it("reconnaît un démonyme EEE noyé dans du texte libre (ponctuation, double nationalité)", () => {
    expect(isEeeOrSuisseNationality("Belge,")).toBe(true);
    expect(isEeeOrSuisseNationality("Marocaine (double nationalité belge)")).toBe(true);
  });

  it("renvoie false pour une nationalité hors EEE/Suisse", () => {
    expect(isEeeOrSuisseNationality("Marocaine")).toBe(false);
    expect(isEeeOrSuisseNationality("Camerounaise")).toBe(false);
    expect(isEeeOrSuisseNationality("Américaine")).toBe(false);
    expect(isEeeOrSuisseNationality("Ivoirienne")).toBe(false);
  });

  it("renvoie false pour un texte vide, blanc, ou non reconnu", () => {
    expect(isEeeOrSuisseNationality("")).toBe(false);
    expect(isEeeOrSuisseNationality("   ")).toBe(false);
    expect(isEeeOrSuisseNationality("xyz123")).toBe(false);
  });
});
