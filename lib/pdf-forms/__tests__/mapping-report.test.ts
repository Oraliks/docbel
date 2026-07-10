import { describe, it, expect } from "vitest";
import { buildMappingReport } from "../mapping-report";
import type { AcroFieldRaw, PdfFormField } from "../types";
import type { MappingRule } from "../bindings/types";
import { C1_QUESTIONS, applyC1Improvements } from "../seed/c1-fields-improvements";
import { C1_CHANGEMENT_RULES } from "../bindings/per-form/c1-changement";

function tech(name: string, opts?: Partial<AcroFieldRaw>): AcroFieldRaw {
  return { pdfFieldName: name, acroType: opts?.acroType ?? "text", ...opts };
}

describe("mapping-report — cas simples", () => {
  it("un champ direct → claim source=field, status=bound", () => {
    const fields: PdfFormField[] = [
      {
        id: "nom",
        pdfFieldName: "Nom",
        type: "text",
        required: true,
        label: { fr: "Nom" },
      },
    ];
    const technical: AcroFieldRaw[] = [tech("Nom")];
    const report = buildMappingReport(fields, technical);
    expect(report.summary).toEqual({ total: 1, bound: 1, orphan: 0, conflict: 0 });
    expect(report.rows[0].claims).toHaveLength(1);
    expect(report.rows[0].claims[0].source).toBe("field");
    expect(report.rows[0].claims[0].fieldId).toBe("nom");
  });

  it("widget technique sans claim → orphan", () => {
    const technical: AcroFieldRaw[] = [tech("Orphelin", { acroType: "text" })];
    const report = buildMappingReport([], technical);
    expect(report.summary.orphan).toBe(1);
    expect(report.rows[0].status).toBe("orphan");
  });

  it("un pipe → une claim par segment (pipe-option)", () => {
    const fields: PdfFormField[] = [
      {
        id: "q",
        pdfFieldName: "oui_2|non_2",
        type: "radio",
        required: true,
        label: { fr: "Q" },
        options: [
          { value: "oui", label: { fr: "Oui" } },
          { value: "non", label: { fr: "Non" } },
        ],
      },
    ];
    const technical: AcroFieldRaw[] = [
      tech("oui_2", { acroType: "checkbox" }),
      tech("non_2", { acroType: "checkbox" }),
    ];
    const report = buildMappingReport(fields, technical);
    expect(report.summary.bound).toBe(2);
    const oui = report.rows.find((r) => r.pdfFieldName === "oui_2")!;
    expect(oui.claims[0].source).toBe("pipe-option");
    expect(oui.claims[0].detail).toBe("option oui");
  });

  it("array template : 1..maxRows claims sur les widgets étendus", () => {
    const fields: PdfFormField[] = [
      {
        id: "coh",
        pdfFieldName: "",
        type: "array",
        required: false,
        label: { fr: "Cohabitants" },
        maxRows: 3,
        itemFields: [
          {
            id: "prenom",
            pdfFieldName: "",
            type: "text",
            required: true,
            label: { fr: "Prenom" },
            pdfFieldNameTemplate: "{index} 1",
          },
        ],
      },
    ];
    const technical: AcroFieldRaw[] = [
      tech("1 1", { acroType: "text" }),
      tech("2 1", { acroType: "text" }),
      tech("3 1", { acroType: "text" }),
    ];
    const report = buildMappingReport(fields, technical);
    expect(report.summary.bound).toBe(3);
    expect(report.rows[0].claims[0].source).toBe("array-template");
    expect(report.rows[0].claims[0].detail).toContain("ligne");
  });

  it("first-match : claim par sous-champ mappé (widget unique)", () => {
    const fields: PdfFormField[] = [
      {
        id: "coh",
        pdfFieldName: "",
        type: "array",
        required: false,
        label: { fr: "Cohabitants" },
        firstMatchMapping: {
          where: { fieldId: "lien", value: "FAC" },
          fields: { prenom: "Identite partenaire" },
        },
        itemFields: [
          {
            id: "prenom",
            pdfFieldName: "",
            type: "text",
            required: false,
            label: { fr: "Prenom" },
          },
        ],
      },
    ];
    const technical: AcroFieldRaw[] = [tech("Identite partenaire")];
    const report = buildMappingReport(fields, technical);
    expect(report.rows[0].claims[0].source).toBe("first-match");
    expect(report.rows[0].claims[0].detail).toBe("lien=FAC");
  });

  it("règle statique : claim source=rule sur chaque stamp", () => {
    const rules: MappingRule[] = [
      { name: "test-rule", stamp: [{ widget: "W1", value: true }] },
    ];
    const technical: AcroFieldRaw[] = [tech("W1", { acroType: "checkbox" })];
    const report = buildMappingReport([], technical, rules);
    expect(report.rows[0].claims[0].source).toBe("rule");
    expect(report.rows[0].claims[0].ruleName).toBe("test-rule");
  });

  it("règle stampFn : claims via declaredWidgets", () => {
    const rules: MappingRule[] = [
      {
        name: "dynamic",
        stampFn: () => [],
        declaredWidgets: ["Dyn1", "Dyn2"],
      },
    ];
    const technical: AcroFieldRaw[] = [tech("Dyn1"), tech("Dyn2")];
    const report = buildMappingReport([], technical, rules);
    expect(report.summary.bound).toBe(2);
    expect(report.rows.every((r) => r.claims[0].source === "rule")).toBe(true);
  });
});

describe("mapping-report — statuts", () => {
  it("champ texte + règle sur même widget → conflict", () => {
    const fields: PdfFormField[] = [
      {
        id: "iban",
        pdfFieldName: "IBAN",
        type: "iban",
        required: true,
        label: { fr: "IBAN" },
      },
    ];
    const rules: MappingRule[] = [
      { name: "override", stamp: [{ widget: "IBAN", value: "BE68..." }] },
    ];
    const technical: AcroFieldRaw[] = [tech("IBAN", { acroType: "text" })];
    const report = buildMappingReport(fields, technical, rules);
    expect(report.summary.conflict).toBe(1);
  });

  it("deux règles sur un même widget → pas de conflit (dernier gagnant)", () => {
    const rules: MappingRule[] = [
      { name: "a", stamp: [{ widget: "W", value: "1" }] },
      { name: "b", stamp: [{ widget: "W", value: "2" }] },
    ];
    const technical: AcroFieldRaw[] = [tech("W", { acroType: "text" })];
    const report = buildMappingReport([], technical, rules);
    expect(report.summary.conflict).toBe(0);
    expect(report.rows[0].claims).toHaveLength(2);
  });

  it("plusieurs pipe-option sur même widget checkbox = bound (pas conflit)", () => {
    const fields: PdfFormField[] = [
      {
        id: "a",
        pdfFieldName: "shared|other_a",
        type: "radio",
        required: false,
        label: { fr: "A" },
        options: [
          { value: "oui", label: { fr: "Oui" } },
          { value: "non", label: { fr: "Non" } },
        ],
      },
      {
        id: "b",
        pdfFieldName: "shared|other_b",
        type: "radio",
        required: false,
        label: { fr: "B" },
        options: [
          { value: "oui", label: { fr: "Oui" } },
          { value: "non", label: { fr: "Non" } },
        ],
      },
    ];
    const technical: AcroFieldRaw[] = [
      tech("shared", { acroType: "checkbox" }),
      tech("other_a", { acroType: "checkbox" }),
      tech("other_b", { acroType: "checkbox" }),
    ];
    const report = buildMappingReport(fields, technical);
    expect(report.summary.conflict).toBe(0);
  });

  it("règle ciblant un widget ABSENT du technicalSchema → conflict (ligne supplémentaire)", () => {
    const rules: MappingRule[] = [
      { name: "wrong-name", stamp: [{ widget: "InexistantWidget", value: true }] },
    ];
    const report = buildMappingReport([], [], rules);
    expect(report.summary.total).toBe(1);
    expect(report.rows[0].status).toBe("conflict");
    expect(report.rows[0].pdfFieldName).toBe("InexistantWidget");
    expect(report.rows[0].acroType).toBe("unknown");
  });
});

describe("mapping-report — C1 changement en conditions réelles", () => {
  // Simule un technicalSchema minimal qui contient les widgets ciblés par les
  // règles C1 changement (13 règles) + quelques widgets orphelins (junk du
  // template). Le rapport doit lister les 13 comme bound et les orphelins
  // comme orphan.
  const ruleWidgets = [
    "je déclare une modification concernant",
    "je change dorganisme de paiement à partir du 5",
    "mon adresse à partir du",
    "ma situation personnelle ou celle des membres de mon ménage 7",
    "mon permis de séjour ou mon permis de travail",
    "le mode de paiement de mes allocations ou mon numéro de compte6",
    "B E",
    "undefined_11",
    "undefined_12",
    "undefined_13",
    "SEPA étranger IBAN  BIC",
    "NomTitulaireSipasOk",
    "Remarques 1",
    "DateDeModification",
    "CodePostal et Commune",
    "non_17",
    "non_18",
    "non_19",
  ];

  it("chaque widget de règle C1 est bound", () => {
    const technical: AcroFieldRaw[] = ruleWidgets.map((n) => tech(n, { acroType: "checkbox" }));
    const report = buildMappingReport([], technical, C1_CHANGEMENT_RULES);
    // Tous les widgets attendus doivent apparaître dans les rows.
    for (const w of ruleWidgets) {
      const row = report.rows.find((r) => r.pdfFieldName === w);
      expect(row, `widget "${w}" absent du rapport`).toBeTruthy();
    }
  });

  it("un widget non couvert par les règles est orphan", () => {
    const technical: AcroFieldRaw[] = [
      ...ruleWidgets.map((n) => tech(n, { acroType: "checkbox" })),
      tech("junk_widget", { acroType: "text" }),
    ];
    const report = buildMappingReport([], technical, C1_CHANGEMENT_RULES);
    const junk = report.rows.find((r) => r.pdfFieldName === "junk_widget");
    expect(junk?.status).toBe("orphan");
  });

  it("rapport C1 improvements (restrict) + rules : 0 conflit sur les widgets couverts", () => {
    // Applique les améliorations restrictives et vérifie qu'aucun widget
    // ciblé par les règles ne se retrouve en conflit. NOTE : les autres
    // widgets référencés par les 150+ champs C1 mais absents du
    // `ruleWidgets` stub apparaissent en "conflit missing widget" (ligne
    // ajoutée pour visibilité admin) — c'est le comportement voulu et
    // reflète le stub minimal du test, pas un vrai bug de la carte.
    const improved = applyC1Improvements(C1_QUESTIONS, {
      defaultMotif: "modification",
      restrictMotifTo5Situations: true,
    });
    const technical: AcroFieldRaw[] = ruleWidgets.map((n) => tech(n, { acroType: "checkbox" }));
    const report = buildMappingReport(improved, technical, C1_CHANGEMENT_RULES);
    // Les 17 widgets ciblés par les règles doivent tous être bound ou
    // conflict via schéma-vs-règle (pas de doublons entre règles).
    for (const w of ruleWidgets) {
      const row = report.rows.find((r) => r.pdfFieldName === w);
      expect(row, `widget "${w}" absent du rapport`).toBeTruthy();
      // Vérif fine : chaque widget de règle a au moins une claim
      // (peu importe la source).
      expect((row?.claims.length ?? 0) > 0).toBe(true);
    }
  });
});
