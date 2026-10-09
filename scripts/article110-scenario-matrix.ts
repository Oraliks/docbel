import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { evaluateArticle110ScenarioMatrix, formatArticle110MatrixMarkdown } from "../lib/regulatory-decision/article-110-scenario-matrix";
import type { C1BaremeThresholds } from "../lib/baremes/c1-thresholds";

const thresholds: C1BaremeThresholds = {
  spouseProfessionalMonthly: 1_000,
  childProfessionalMonthly: 1_000,
  spouseReplacementMonthly: 1_000,
  childReplacementMonthly: 1_000,
  ascendantPensionWithChildMonthly: 1_500,
  ascendantPensionMonthly: 1_000,
  ascendantDisabledPensionMonthly: 1_200,
  source: { fileId: "scenario-matrix", fileName: "barème injecté par la CI", validFrom: new Date("2026-09-01") },
};

async function main() {
  const report = evaluateArticle110ScenarioMatrix(thresholds);
  const root = process.cwd();
  await mkdir(path.join(root, "artifacts"), { recursive: true });
  await Promise.all([
    writeFile(path.join(root, "docs", "audits", "ARTICLE_110_SCENARIO_MATRIX.md"), formatArticle110MatrixMarkdown(report), "utf8"),
    writeFile(path.join(root, "artifacts", "article-110-scenario-matrix.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8"),
  ]);
  console.log(`Article 110 scenario matrix: ${report.total} scenarios, ${report.incoherent.length} incoherent, ${report.withoutReason.length} without reason.`);
}

void main();
