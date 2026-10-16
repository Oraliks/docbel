import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import messages from "@/messages/fr.json";
import { Article110RandomMessageText } from "../article-110-random-test-mode";
import { explainArticle110RandomResult } from "@/lib/regulatory-decision/article-110-random-explanation";
import { evaluateArticle110Verifier } from "@/lib/regulatory-decision/article-110-verifier";

const thresholds = {
  spouseProfessionalMonthly: 1_000,
  childProfessionalMonthly: 1_000,
  spouseReplacementMonthly: 1_000,
  childReplacementMonthly: 1_000,
  ascendantPensionWithChildMonthly: 1_500,
  ascendantPensionMonthly: 1_744.3,
  ascendantDisabledPensionMonthly: 2_829.28,
  source: { fileId: "t147-2026-04", fileName: "t147-2026-04.xlsx", validFrom: new Date("2026-04-01") },
} as const;

function renderPensionExplanation(amount: number) {
  const input = {
    thresholds,
    asOf: "2026-10-08",
    people: [{ id: "father", relation: "relative" as const, label: "Père", isAscendant: true, hasProfessionalIncome: false, hasReplacementIncome: true, replacementIncomeType: "pension" as const, replacementIncomeAmount: amount }],
  };
  const result = evaluateArticle110Verifier(input);
  const message = explainArticle110RandomResult(input, result, "fr").paragraphs[0]!;
  return renderToStaticMarkup(
    createElement(NextIntlClientProvider, {
      locale: "fr",
      messages,
      timeZone: "Europe/Brussels",
    }, createElement(Article110RandomMessageText, { message })),
  );
}

describe("Article 110 random amount explanations", () => {
  it("renders a structured bold comparison for a pension below the applicable ceiling", () => {
    const html = renderPensionExplanation(1_700);

    expect(html).toContain("Montant déclaré : <strong>1 700,00 €</strong>");
    expect(html).toContain("Plafond maximum admissible depuis le 01/04/2026 : <strong>1 744,30 €</strong>");
    expect(html).toContain("inférieur au plafond — admissible au regard de ce plafond");
    expect(html).toContain("<strong>A — Travailleur ayant charge de famille</strong>");
    expect(html).toContain("son père");
    expect(html).not.toContain("**");
  });

  it("renders equality with the ceiling as admissible", () => {
    const html = renderPensionExplanation(1_744.3);

    expect(html).toContain("Comparaison : égal au plafond — admissible au regard de ce plafond");
    expect(html).toContain("<strong>1 744,30 €</strong>");
    expect(html).toContain("<strong>A — Travailleur ayant charge de famille</strong>");
  });

  it("renders an amount above the ceiling as an exceedance and keeps category B", () => {
    const html = renderPensionExplanation(1_744.31);

    expect(html).toContain("Comparaison : supérieur au plafond — dépassement");
    expect(html).toContain("revenu de remplacement pertinent");
    expect(html).toContain("<strong>B — Cohabitant</strong>");
  });
});
