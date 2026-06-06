import { describe, expect, it } from "vitest";

import {
  DEFAULT_BOOKING_FORM,
  buildFormSchema,
  extractIdentity,
  isValidNrn,
  parseFormFields,
  redactSensitiveFormData,
  validateFormData,
} from "@/lib/booking/form-fields";
import type { BookingField } from "@/lib/booking/types";

// NRN valide construit par mod-97 : base 850515123, contrôle 83 (né avant 2000).
const VALID_NRN = "85051512383";

describe("isValidNrn", () => {
  it("accepte un NRN valide (avec ou sans séparateurs)", () => {
    expect(isValidNrn(VALID_NRN)).toBe(true);
    expect(isValidNrn("85.05.15-123.83")).toBe(true);
  });
  it("rejette un mauvais contrôle ou une mauvaise longueur", () => {
    expect(isValidNrn("85051512300")).toBe(false);
    expect(isValidNrn("123")).toBe(false);
    expect(isValidNrn("")).toBe(false);
  });
});

describe("buildFormSchema / validateFormData", () => {
  const fields: BookingField[] = [
    { key: "lastName", label: "Nom", type: "text", required: true, role: "name" },
    { key: "email", label: "Email", type: "email", required: true, role: "email" },
    { key: "phone", label: "Tel", type: "tel", required: false, role: "phone" },
    { key: "consent", label: "J'accepte", type: "checkbox", required: true },
  ];

  it("rejette les champs requis manquants", () => {
    const r = validateFormData(fields, { lastName: "", email: "x@y.be", consent: true });
    expect(r.ok).toBe(false);
  });

  it("rejette un email invalide", () => {
    const r = validateFormData(fields, { lastName: "Dupont", email: "pasunemail", consent: true });
    expect(r.ok).toBe(false);
  });

  it("exige la case à cocher requise", () => {
    const r = validateFormData(fields, { lastName: "Dupont", email: "x@y.be", consent: false });
    expect(r.ok).toBe(false);
  });

  it("accepte un formulaire valide (champ optionnel vide toléré)", () => {
    const r = validateFormData(fields, {
      lastName: "Dupont",
      email: "X@Y.be",
      phone: "",
      consent: true,
    });
    expect(r.ok).toBe(true);
  });

  it("schéma construit = objet zod parseable", () => {
    expect(buildFormSchema(fields).safeParse({}).success).toBe(false);
  });
});

describe("extractIdentity", () => {
  it("extrait nom/email/nrn/cp depuis le formulaire par défaut", () => {
    const id = extractIdentity(DEFAULT_BOOKING_FORM, {
      lastName: "Dupont",
      firstName: "Jean",
      email: "Jean.Dupont@Mail.be",
      phone: "0470000000",
      nrn: VALID_NRN,
      postalCode: "1000",
      motive: "Question allocations",
    });
    expect(id.name).toBe("Dupont Jean");
    expect(id.nameNormalized).toBe("dupont jean");
    expect(id.email).toBe("jean.dupont@mail.be");
    expect(id.nrn).toBe(VALID_NRN);
    expect(id.postalCode).toBe("1000");
  });

  it("renvoie null pour un NRN incomplet", () => {
    const id = extractIdentity(DEFAULT_BOOKING_FORM, { nrn: "123" });
    expect(id.nrn).toBeNull();
  });
});

describe("parseFormFields", () => {
  it("retombe sur le formulaire par défaut si vide/invalide", () => {
    expect(parseFormFields([])).toEqual(DEFAULT_BOOKING_FORM);
    expect(parseFormFields(null)).toEqual(DEFAULT_BOOKING_FORM);
    expect(parseFormFields("nope")).toEqual(DEFAULT_BOOKING_FORM);
  });
  it("accepte une config valide", () => {
    const custom = [{ key: "x", label: "X", type: "text" as const }];
    expect(parseFormFields(custom)).toHaveLength(1);
  });
});

describe("redactSensitiveFormData", () => {
  it("retire les champs de type nrn et garde le reste", () => {
    const out = redactSensitiveFormData(DEFAULT_BOOKING_FORM, {
      lastName: "Dupont",
      email: "x@y.be",
      nrn: VALID_NRN,
      postalCode: "1000",
    });
    expect("nrn" in out).toBe(false); // NRN jamais conservé en clair
    expect(out.lastName).toBe("Dupont");
    expect(out.email).toBe("x@y.be");
    expect(out.postalCode).toBe("1000");
  });

  it("ne touche rien si aucun champ nrn", () => {
    const fields: BookingField[] = [
      { key: "name", label: "Nom", type: "text" },
    ];
    const data = { name: "Dupont" };
    expect(redactSensitiveFormData(fields, data)).toEqual(data);
  });
});
