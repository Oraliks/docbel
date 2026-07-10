import { describe, it, expect } from "vitest";
import { buildValidator, isFieldVisible, anchoredRegex, validateFieldFormat, isFieldComplete, validateStepFields, findFirstInvalidStep } from "../validation";
import { PdfFormField } from "../types";

function field(p: Partial<PdfFormField> & Pick<PdfFormField, "id" | "type">): PdfFormField {
  return { pdfFieldName: p.id, required: false, label: { fr: p.id }, ...p } as PdfFormField;
}

describe("buildValidator", () => {
  it("NISS : valide OK ; bloque longueur + date impossible ; laisse passer un checksum douteux (#4)", () => {
    const v = buildValidator([field({ id: "niss", type: "niss", required: true })], "fr");
    expect(v.safeParse({ niss: "85073003328" }).success).toBe(true); // valide
    expect(v.safeParse({ niss: "123" }).success).toBe(false); // longueur
    expect(v.safeParse({ niss: "85153003328" }).success).toBe(false); // mois 15 impossible
    // Checksum douteux mais date cohérente → NON bloquant (avertissement seul).
    expect(v.safeParse({ niss: "85073003329" }).success).toBe(true);
  });

  it("iban sans internationalIban : rejette un IBAN étranger valide (belge strict par défaut)", () => {
    const v = buildValidator([field({ id: "iban", type: "iban" })], "fr");
    expect(v.safeParse({ iban: "FR7630006000011234567890189" }).success).toBe(false);
    expect(v.safeParse({ iban: "BE68539007547034" }).success).toBe(true);
  });

  it("iban avec internationalIban=true : accepte un IBAN étranger valide (bug corrigé)", () => {
    const v = buildValidator([field({ id: "iban", type: "iban", internationalIban: true })], "fr");
    expect(v.safeParse({ iban: "FR7630006000011234567890189" }).success).toBe(true);
    expect(v.safeParse({ iban: "LT601010012345678901" }).success).toBe(true); // Revolut (Lituanie)
    expect(v.safeParse({ iban: "BE68539007547034" }).success).toBe(true); // belge toujours accepté
    expect(v.safeParse({ iban: "FR0000000000000000000000000" }).success).toBe(false); // checksum invalide
  });

  it("requiredGroup : rejette si AUCUN champ du groupe n'est rempli/coché", () => {
    const v = buildValidator(
      [
        field({ id: "a", type: "checkbox", requiredGroup: "g" }),
        field({ id: "b", type: "checkbox", requiredGroup: "g" }),
        field({ id: "c", type: "checkbox", requiredGroup: "g" }),
      ],
      "fr"
    );
    const res = v.safeParse({ a: false, b: false, c: false });
    expect(res.success).toBe(false);
    if (!res.success) {
      // L'erreur s'attache au PREMIER champ du groupe (l'ancre).
      expect(res.error.issues[0].path).toEqual(["a"]);
    }
  });

  it("requiredGroup : accepte dès qu'UN SEUL membre du groupe est rempli/coché", () => {
    const v = buildValidator(
      [
        field({ id: "a", type: "checkbox", requiredGroup: "g" }),
        field({ id: "b", type: "checkbox", requiredGroup: "g" }),
      ],
      "fr"
    );
    expect(v.safeParse({ a: false, b: true }).success).toBe(true);
  });

  it("requiredGroup : ignore un membre du groupe actuellement invisible (visibleIf non satisfait)", () => {
    const v = buildValidator(
      [
        field({ id: "toggle", type: "text" }),
        field({
          id: "a",
          type: "checkbox",
          requiredGroup: "g",
          visibleIf: { fieldId: "toggle", op: "equals", value: "show" },
        }),
      ],
      "fr"
    );
    // "a" invisible (toggle !== "show") → aucun membre visible du groupe → pas d'erreur.
    expect(v.safeParse({ toggle: "hide", a: false }).success).toBe(true);
  });

  it("requiredGroup : message custom via errorMsg sur l'ancre, sinon message générique", () => {
    const vCustom = buildValidator(
      [field({ id: "a", type: "checkbox", requiredGroup: "g", errorMsg: { fr: "Choisis-en au moins un." } })],
      "fr"
    );
    const resCustom = vCustom.safeParse({ a: false });
    expect(!resCustom.success && resCustom.error.issues[0].message).toBe("Choisis-en au moins un.");

    const vGeneric = buildValidator([field({ id: "a", type: "checkbox", requiredGroup: "g" })], "fr");
    const resGeneric = vGeneric.safeParse({ a: false });
    expect(!resGeneric.success && resGeneric.error.issues[0].message).toMatch(/au moins une option/);
  });

  it("format BIC (regex générique, ISO 9362) : accepte 8 ou 11 caractères, rejette le reste", () => {
    const v = buildValidator(
      [field({ id: "bic", type: "text", regex: "^[A-Za-z]{6}[A-Za-z0-9]{2}([A-Za-z0-9]{3})?$" })],
      "fr"
    );
    expect(v.safeParse({ bic: "BNPAFRPP" }).success).toBe(true); // 8 car.
    expect(v.safeParse({ bic: "GEBABEBB36A" }).success).toBe(true); // 11 car.
    expect(v.safeParse({ bic: "TROPCOURT" }).success).toBe(false);
    expect(v.safeParse({ bic: "12345678" }).success).toBe(false); // chiffres en tête interdits
  });

  it("explique un NISS trop court (longueur) avec le nombre saisi", () => {
    const v = buildValidator([field({ id: "niss", type: "niss", required: true })], "fr");
    const res = v.safeParse({ niss: "850730" });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].message).toMatch(/11 chiffres/);
      expect(res.error.issues[0].message).toMatch(/saisi 6/);
    }
  });

  it("explique un NISS à date impossible (confusion année/mois/jour) et le BLOQUE", () => {
    const v = buildValidator([field({ id: "niss", type: "niss", required: true })], "fr");
    const res = v.safeParse({ niss: "85153003328" }); // mois 15 impossible
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error.issues[0].message).toMatch(/année.*mois.*jour|impossible/i);
  });

  it("respecte un message NISS personnalisé par l'admin", () => {
    const v = buildValidator(
      [field({ id: "niss", type: "niss", required: true, errorMsg: { fr: "Mon message à moi" } })],
      "fr"
    );
    const res = v.safeParse({ niss: "850730" });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error.issues[0].message).toBe("Mon message à moi");
  });

  it("exige les champs requis visibles", () => {
    const v = buildValidator([field({ id: "nom", type: "text", required: true })], "fr");
    expect(v.safeParse({ nom: "" }).success).toBe(false);
    expect(v.safeParse({ nom: "Dupont" }).success).toBe(true);
  });

  it("n'exige pas un champ requis masqué par visibleIf", () => {
    const fields = [
      field({ id: "a", type: "checkbox" }),
      field({ id: "b", type: "text", required: true, visibleIf: { fieldId: "a", op: "equals", value: true } }),
    ];
    const v = buildValidator(fields, "fr");
    expect(v.safeParse({ a: false, b: "" }).success).toBe(true);
    expect(v.safeParse({ a: true, b: "" }).success).toBe(false);
  });

  it("restreint un select aux options autorisées", () => {
    const f = field({ id: "s", type: "select", options: [{ value: "x", label: { fr: "X" } }] });
    const v = buildValidator([f], "fr");
    expect(v.safeParse({ s: "x" }).success).toBe(true);
    expect(v.safeParse({ s: "z" }).success).toBe(false);
  });

  it("utilise le message d'erreur localisé (NL)", () => {
    const v = buildValidator([field({ id: "iban", type: "iban", required: true })], "nl");
    const res = v.safeParse({ iban: "BE00" });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error.issues[0].message).toMatch(/IBAN/i);
  });

  it("fullname requis exige prénom ET nom", () => {
    const v = buildValidator([field({ id: "name", type: "fullname", required: true })], "fr");
    expect(v.safeParse({ name: { first: "Jean", last: "Dupont" } }).success).toBe(true);
    expect(v.safeParse({ name: { first: "Jean", last: "" } }).success).toBe(false);
    expect(v.safeParse({ name: { first: "", last: "Dupont" } }).success).toBe(false);
    expect(v.safeParse({ name: {} }).success).toBe(false);
  });

  it("fullname optionnel accepte une valeur vide", () => {
    const v = buildValidator([field({ id: "name", type: "fullname" })], "fr");
    expect(v.safeParse({ name: { first: "", last: "" } }).success).toBe(true);
    expect(v.safeParse({}).success).toBe(true);
  });

  it.each([
    ["text", "", false],
    ["text", "x", true],
    ["textarea", "", false],
    ["textarea", "hello", true],
    ["niss", "", false],
    ["iban", "", false],
    ["postal_be", "", false],
    ["tva_be", "", false],
    ["bce", "", false],
    ["phone_be", "", false],
    ["email", "", false],
    ["date", "", false],
    ["number", "", false],
    ["number", "0", true],
    ["select", "", false],
    ["radio", "", false],
  ] as const)("required '%s' avec input %p → success=%s", (type, input, expected) => {
    const f = field({
      id: "x",
      type: type as never,
      required: true,
      options: type === "select" || type === "radio" ? [{ value: "x", label: { fr: "X" } }] : undefined,
    });
    const v = buildValidator([f], "fr");
    expect(v.safeParse({ x: input }).success).toBe(expected);
  });

  it("required: checkbox non cochée échoue, cochée passe", () => {
    const v = buildValidator([field({ id: "c", type: "checkbox", required: true })], "fr");
    expect(v.safeParse({ c: false }).success).toBe(false);
    expect(v.safeParse({ c: true }).success).toBe(true);
  });

  it("texte trop court : message pédagogique avec les deux nombres", () => {
    const v = buildValidator([field({ id: "t", type: "text", minLength: 5 })], "fr");
    const res = v.safeParse({ t: "abc" });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].message).toMatch(/au moins 5/);
      expect(res.error.issues[0].message).toMatch(/écrit 3/);
    }
  });

  it("texte trop long : message pédagogique avec les deux nombres", () => {
    const v = buildValidator([field({ id: "t", type: "text", maxLength: 3 })], "fr");
    const res = v.safeParse({ t: "abcdef" });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].message).toMatch(/maximum 3/);
      expect(res.error.issues[0].message).toMatch(/écrit 6/);
    }
  });

  it("nombre hors plage : messages clairs en français", () => {
    const v = buildValidator([field({ id: "n", type: "number", min: 18, max: 65 })], "fr");
    const tooLow = v.safeParse({ n: 10 });
    expect(tooLow.success).toBe(false);
    if (!tooLow.success) expect(tooLow.error.issues[0].message).toMatch(/au moins.*18/);
    const tooHigh = v.safeParse({ n: 99 });
    expect(tooHigh.success).toBe(false);
    if (!tooHigh.success) expect(tooHigh.error.issues[0].message).toMatch(/pas dépasser 65/);
  });
});

describe("anchoredRegex", () => {
  it("ancre la regex (^...$) pour éviter les correspondances partielles", () => {
    const rx = anchoredRegex("\\d{4}");
    expect(rx?.test("1234")).toBe(true);
    expect(rx?.test("abc1234xyz")).toBe(false);
  });
  it("renvoie null pour une regex invalide", () => {
    expect(anchoredRegex("(")).toBeNull();
  });
});

describe("isFieldVisible", () => {
  it("gère in / notIn", () => {
    expect(isFieldVisible({ fieldId: "t", op: "in", value: ["a", "b"] }, { t: "a" })).toBe(true);
    expect(isFieldVisible({ fieldId: "t", op: "notIn", value: ["a", "b"] }, { t: "c" })).toBe(true);
  });
});

describe("validateFieldFormat — validation par champ (blur)", () => {
  it("champ vide → null (pas d'erreur de format ; le requis se gère à l'envoi)", () => {
    expect(validateFieldFormat(field({ id: "niss", type: "niss", required: true }), "", "fr")).toBeNull();
  });

  it("NISS valide → null ; date impossible → message (bloquant) ; checksum douteux → null (non bloquant)", () => {
    const f = field({ id: "niss", type: "niss" });
    expect(validateFieldFormat(f, "85073003328", "fr")).toBeNull();
    expect(validateFieldFormat(f, "85153003328", "fr")).not.toBeNull(); // mois 15 impossible
    expect(validateFieldFormat(f, "85073003329", "fr")).toBeNull(); // checksum seul → pas d'erreur bloquante
  });

  it("IBAN belge invalide → message ; date invalide → message", () => {
    expect(validateFieldFormat(field({ id: "iban", type: "iban" }), "BE00", "fr")).not.toBeNull();
    expect(validateFieldFormat(field({ id: "d", type: "date" }), "pas-une-date", "fr")).not.toBeNull();
  });

  it("type non validable (text) → toujours null", () => {
    expect(validateFieldFormat(field({ id: "t", type: "text" }), "n'importe quoi", "fr")).toBeNull();
  });
});

describe("isFieldComplete — complétion d'un champ (pour le stepper)", () => {
  it("texte non vide = complet, vide = non complet", () => {
    const f = field({ id: "t", type: "text" });
    expect(isFieldComplete(f, "abc", "fr")).toBe(true);
    expect(isFieldComplete(f, "", "fr")).toBe(false);
    expect(isFieldComplete(f, "   ", "fr")).toBe(false);
  });

  it("NISS : complet seulement si valide", () => {
    const f = field({ id: "niss", type: "niss" });
    expect(isFieldComplete(f, "85073003328", "fr")).toBe(true);
    expect(isFieldComplete(f, "850730", "fr")).toBe(false);
  });

  it("checkbox : complet seulement si coché", () => {
    const f = field({ id: "c", type: "checkbox" });
    expect(isFieldComplete(f, true, "fr")).toBe(true);
    expect(isFieldComplete(f, false, "fr")).toBe(false);
  });

  it("fullname : complet seulement si prénom ET nom", () => {
    const f = field({ id: "n", type: "fullname" });
    expect(isFieldComplete(f, { first: "Jean", last: "Dupont" }, "fr")).toBe(true);
    expect(isFieldComplete(f, { first: "Jean", last: "" }, "fr")).toBe(false);
  });
});

describe("validateStepFields — blocage d'avancée d'étape (bouton Continuer)", () => {
  it("renvoie {} quand les champs fournis sont tous valides", () => {
    const fields = [field({ id: "nom", type: "text", required: true })];
    expect(validateStepFields(fields, { nom: "Dupont" }, "fr")).toEqual({});
  });

  it("renvoie un message précis par id pour un champ requis vide", () => {
    const fields = [field({ id: "nom", type: "text", required: true })];
    const errors = validateStepFields(fields, {}, "fr");
    expect(Object.keys(errors)).toEqual(["nom"]);
    expect(errors.nom).toBeTruthy();
  });

  it("ignore les champs qui n'appartiennent PAS à l'étape (payload complet du formulaire)", () => {
    // Le payload contient un champ requis d'une AUTRE étape (non fourni ici) :
    // ne doit jamais apparaître dans les erreurs de CETTE étape.
    const stepFields = [field({ id: "adresse", type: "text", required: true })];
    const fullPayload = { adresse: "Rue Neuve 1", niss: "" }; // "niss" requis ailleurs, absent d'ici
    expect(validateStepFields(stepFields, fullPayload, "fr")).toEqual({});
  });

  it("signale aussi un format invalide (pas seulement le vide) pour un champ de l'étape", () => {
    const fields = [field({ id: "niss", type: "niss", required: true })];
    const errors = validateStepFields(fields, { niss: "850730" }, "fr"); // trop court
    expect(errors.niss).toBeTruthy();
  });

  it("un champ requis mais invisible (visibleIf non satisfait) ne bloque pas", () => {
    const fields = [
      field({ id: "motif", type: "text" }),
      field({ id: "detail", type: "text", required: true, visibleIf: { fieldId: "motif", op: "equals", value: "autre" } }),
    ];
    expect(validateStepFields(fields, { motif: "standard" }, "fr")).toEqual({});
  });
});

describe("findFirstInvalidStep — saut de plusieurs étapes via le stepper", () => {
  it("renvoie null quand toutes les étapes fournies sont valides", () => {
    const steps = [
      [field({ id: "a", type: "text", required: true })],
      [field({ id: "b", type: "text", required: true })],
    ];
    expect(findFirstInvalidStep(steps, { a: "x", b: "y" }, "fr")).toBeNull();
  });

  it("détecte une étape invalide qui N'EST PAS la première (bug Oraliks 2026-07-07 : cliquer 2+ crans plus loin dans le stepper devait valider TOUTES les étapes survolées, pas seulement celle qu'on quitte)", () => {
    const steps = [
      [field({ id: "a", type: "text", required: true })], // étape 0 : remplie
      [field({ id: "b", type: "text", required: true })], // étape 1 : PAS remplie (sautée)
      [field({ id: "c", type: "text", required: true })], // étape 2 : cible du clic
    ];
    const result = findFirstInvalidStep(steps, { a: "x" }, "fr"); // b et c vides
    expect(result).not.toBeNull();
    expect(result?.index).toBe(1); // la 2ᵉ étape (celle sautée), pas la dernière
    expect(Object.keys(result?.errors ?? {})).toEqual(["b"]);
  });

  it("s'arrête à la PREMIÈRE étape invalide (n'agrège pas les erreurs des étapes suivantes)", () => {
    const steps = [
      [field({ id: "a", type: "text", required: true })],
      [field({ id: "b", type: "text", required: true })],
    ];
    const result = findFirstInvalidStep(steps, {}, "fr"); // ni a ni b remplis
    expect(result?.index).toBe(0);
    expect(Object.keys(result?.errors ?? {})).toEqual(["a"]);
  });
});
