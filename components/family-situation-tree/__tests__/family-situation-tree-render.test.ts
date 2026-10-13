import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import messages from "@/messages/fr.json";
import { FamilySituationTree } from "@/app/partenaire/outils/arbre-situation-familiale/family-situation-tree";

const thresholds = {
  spouseProfessionalMonthly: 1000,
  childProfessionalMonthly: null,
  spouseReplacementMonthly: null,
  childReplacementMonthly: null,
  source: null,
};

function renderTree(initialState?: Parameters<typeof FamilySituationTree>[0]["initialState"]) {
  return renderToStaticMarkup(
    // eslint-disable-next-line react/no-children-prop
    createElement(NextIntlClientProvider, {
      locale: "fr",
      messages,
      children: createElement(FamilySituationTree, { thresholds, initialState }),
    }),
  );
}

describe("FamilySituationTree — rendu i18n réel", () => {
  it("renders the French start choices without exposing an i18n key", () => {
    const html = renderTree();

    expect(html).toContain("Quelle est votre situation de vie ?");
    expect(html).toContain("Avec mon conjoint / partenaire");
    expect(html).not.toContain("public.pro.");
  });

  it("renders one qualified declaration choice for a person living alone", () => {
    const html = renderTree({ branch: "alone", people: [] });

    expect(html).toContain("Une situation particulière s’applique-t-elle ?");
    expect(html).toContain("Garde / hébergement alterné répondant aux conditions");
    expect(html).toContain("Pension alimentaire versée sur une base juridique applicable");
    expect(html).not.toContain("Nombre moyen de jours calendrier par semaine");
    expect(html).not.toContain("Bénéficiaire");
  });

  it("renders the declared-condition explanation for the selected isolated basis", () => {
    const html = renderTree({ branch: "alone", people: [], declaredAloneSituation: "alternating_care" });

    expect(html).toContain("Selon votre déclaration d’hébergement alterné répondant aux conditions");
    expect(html).not.toContain("Vous déclarez payer effectivement une pension alimentaire");
    expect(html).not.toContain("Taux du mois renvoyé par le socle");
  });

  it("renders the unanswered partner question as an accessible choice, not a review panel", () => {
    const html = renderTree({ branch: "partner", people: [{ id: "partner", relation: "partner", label: "partner" }] });

    expect(html).toContain("Votre partenaire remplit-il les conditions pour être pris en compte dans votre ménage ?");
    expect(html).toContain('role="radiogroup"');
    expect(html).not.toContain("Situation à examiner");
    expect(html).not.toContain("Une précision est nécessaire");
    expect(html).not.toContain("public.pro.");
  });

  it("asks for a person after the multi-person path is selected instead of concluding isolated", () => {
    const html = renderTree({ branch: "others", people: [] });

    expect(html).toContain("Une précision est nécessaire");
    expect(html).not.toContain("N — Isolé");
  });

  it("keeps the family-allowance question available for a child with an explicit absence of income", () => {
    const html = renderTree({
      branch: "others",
      people: [{ id: "child", relation: "child", hasProfessionalIncome: false, hasReplacementIncome: false }],
    });

    expect(html).toContain("Au moins un enfant ouvre-t-il encore droit aux allocations familiales ?");
    expect(html).toContain("Une précision est nécessaire");
    expect(html).not.toContain("A — Avec charge de famille");
  });

  it("renders the shared ONEM review for an answered third-party household", () => {
    const html = renderTree({
      branch: "others",
      cohousing: false,
      people: [{
        id: "third-party",
        relation: "third_party",
        label: "third_party",
        hasProfessionalIncome: false,
        hasReplacementIncome: false,
      }],
    });

    expect(html).toContain("Situation à examiner");
    expect(html).toContain("doit être examinée par l’ONEM");
  });

  it("renders the two distinct partner amounts without a C110A availability question", () => {
    const html = renderTree({
      branch: "partner",
      people: [{
        id: "spouse",
        relation: "spouse",
        label: "spouse",
        hasProfessionalIncome: true,
        hasReplacementIncome: false,
        professionalIncomeType: "employee",
        professionalIncomeAmount: 900,
        professionalIncomeContract: "cdi",
        professionalIncomeVariable: true,
      }],
    });

    expect(html).toContain("Revenu professionnel brut de référence (€)");
    expect(html).toContain("Revenu professionnel brut du mois évalué (€)");
    expect(html).not.toContain("Le C110A est-il disponible ?");
    expect(html).not.toContain("public.pro.");
  });
});
