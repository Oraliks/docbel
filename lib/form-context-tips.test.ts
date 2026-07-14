import { describe, it, expect } from "vitest";
import {
  resolveTips,
  parseFormContextTips,
  getDefaultTipsForForm,
  formContextTipsSchema,
  mergeFormContextTips,
  pickLocalized,
  FORM_CONTEXT_TIPS_DEFAULTS,
  type TipEntry,
} from "./form-context-tips";

const ALWAYS: TipEntry = {
  id: "a",
  when: { type: "always" },
  title: { fr: "Toujours" },
  reminders: [{ fr: "r-always" }],
};
const ADDRESS: TipEntry = {
  id: "b",
  when: { type: "field-checked", fieldId: "modificationAdresse" },
  title: { fr: "Adresse" },
  reminders: [{ fr: "r-address" }],
};
const IDENTITE: TipEntry = {
  id: "c",
  when: { type: "section", sectionKey: "identite" },
  title: { fr: "Identité" },
  reminders: [{ fr: "r-identite" }],
};
const ENTRIES = [ALWAYS, ADDRESS, IDENTITE];

describe("resolveTips", () => {
  it("garde toujours une entrée `always` quel que soit le contexte", () => {
    const shown = resolveTips(ENTRIES, { sectionKeys: [], checkedFieldIds: [] });
    expect(shown.map((e) => e.id)).toEqual(["a"]);
  });

  it("inclut une entrée `field-checked` seulement si le champ est coché", () => {
    expect(
      resolveTips(ENTRIES, { sectionKeys: [], checkedFieldIds: ["modificationAdresse"] }).map(
        (e) => e.id,
      ),
    ).toEqual(["a", "b"]);
    expect(
      resolveTips(ENTRIES, { sectionKeys: [], checkedFieldIds: ["modificationCompte"] }).map(
        (e) => e.id,
      ),
    ).toEqual(["a"]);
  });

  it("inclut une entrée `section` seulement si la section active matche", () => {
    expect(
      resolveTips(ENTRIES, { sectionKeys: ["identite"], checkedFieldIds: [] }).map((e) => e.id),
    ).toEqual(["a", "c"]);
    expect(
      resolveTips(ENTRIES, { sectionKeys: ["mes-revenus"], checkedFieldIds: [] }).map((e) => e.id),
    ).toEqual(["a"]);
  });

  it("matche une section active même si elle n'est PAS la première (macro-étape)", () => {
    // Régression : une macro-étape regroupe plusieurs sections ; un conseil
    // ciblé sur une section non-première doit s'afficher (bug si on ne passait
    // que sectionKeys[0]).
    expect(
      resolveTips([IDENTITE], {
        sectionKeys: ["mes-activites", "identite"],
        checkedFieldIds: [],
      }).map((e) => e.id),
    ).toEqual(["c"]);
  });

  it("préserve l'ordre de déclaration et empile plusieurs matches", () => {
    const shown = resolveTips(ENTRIES, {
      sectionKeys: ["identite"],
      checkedFieldIds: ["modificationAdresse"],
    });
    expect(shown.map((e) => e.id)).toEqual(["a", "b", "c"]);
  });

  it("renvoie une liste vide quand rien ne matche (sans `always`)", () => {
    expect(resolveTips([ADDRESS, IDENTITE], { sectionKeys: [], checkedFieldIds: [] })).toEqual([]);
  });
});

describe("mergeFormContextTips", () => {
  it("préserve un formulaire absent du patch (anti lost-update)", () => {
    const base = { X: { entries: [ALWAYS] }, Z: { entries: [ADDRESS] } };
    const patch = { X: { entries: [] } }; // l'admin a vidé X, ne connaît pas Z
    const merged = mergeFormContextTips(base, patch);
    expect(merged.X.entries).toEqual([]);
    expect(merged.Z.entries.map((e) => e.id)).toEqual(["b"]); // Z survit
  });
});

describe("pickLocalized", () => {
  it("prend la locale demandée, repli FR si absente", () => {
    expect(pickLocalized({ fr: "bonjour", nl: "hallo" }, "nl")).toBe("hallo");
    expect(pickLocalized({ fr: "bonjour" }, "de")).toBe("bonjour");
    expect(pickLocalized({ fr: "bonjour", nl: "" }, "nl")).toBe("bonjour");
  });
});

describe("parseFormContextTips", () => {
  it("laisse passer un dictionnaire valide", () => {
    const dict = {
      "mon-form": { entries: [ALWAYS] },
    };
    const parsed = parseFormContextTips(dict);
    expect(parsed["mon-form"].entries.map((e) => e.id)).toEqual(["a"]);
  });

  it("retombe sur les défauts sur une entrée corrompue (jamais de throw)", () => {
    expect(() => parseFormContextTips({ "x": { entries: "pas-un-tableau" } })).not.toThrow();
    const parsed = parseFormContextTips({ "x": { entries: "pas-un-tableau" } });
    // Une valeur invalide ne doit pas écraser/vider : on retombe sur les défauts.
    expect(parsed["c1-changement-situation"]).toBeDefined();
  });

  it("retombe sur les défauts sur une valeur non-objet", () => {
    expect(parseFormContextTips(null)).toEqual(FORM_CONTEXT_TIPS_DEFAULTS);
    expect(parseFormContextTips("nope")).toEqual(FORM_CONTEXT_TIPS_DEFAULTS);
  });
});

describe("getDefaultTipsForForm", () => {
  it("renvoie les entrées par défaut d'un formulaire connu", () => {
    expect(getDefaultTipsForForm("c1-changement-situation").length).toBeGreaterThan(0);
  });
  it("renvoie [] pour un formulaire sans défauts", () => {
    expect(getDefaultTipsForForm("form-inconnu")).toEqual([]);
  });
});

describe("FORM_CONTEXT_TIPS_DEFAULTS — contenu C1 adresse", () => {
  const entries = FORM_CONTEXT_TIPS_DEFAULTS["c1-changement-situation"]?.entries ?? [];
  const address = entries.find(
    (e) => e.when.type === "field-checked" && e.when.fieldId === "modificationAdresse",
  );

  it("contient un bloc adresse déclenché par modificationAdresse", () => {
    expect(address).toBeDefined();
  });

  it("rappelle l'inscription Actiris et la prise d'effet dès l'emménagement", () => {
    const joined = (address?.reminders ?? []).map((r) => r.fr).join(" ");
    expect(joined).toMatch(/Actiris/i);
    expect(joined).toMatch(/commune/i);
  });

  it("fournit une checklist « À vérifier »", () => {
    expect((address?.checklist ?? []).length).toBeGreaterThan(0);
  });

  it("passe le schéma STRICT d'écriture (setFormContextTips accepterait les défauts)", () => {
    // L'admin GET renvoie les défauts ; un « Enregistrer » sans modif les
    // repasse par `formContextTipsSchema.safeParse`. Ils doivent être valides.
    expect(formContextTipsSchema.safeParse(FORM_CONTEXT_TIPS_DEFAULTS).success).toBe(true);
  });
});
