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
  const typeTotal = Object.values(report.byResultType).reduce((sum, count) => sum + count, 0);
  const categoryTotal = Object.values(report.byCategory).reduce((sum, count) => sum + count, 0);
  const compositionRows = report.compositionCoverage.map((row) => `| ${row.composition} | ${row.total} | ${row.determined} | ${row.information} | ${row.document} | ${row.onem} | ${row.notAutomated} |`).join("\n");
  const mixedDetails = report.mixedOrUnsupported.map((group) => `- ${group.scenarioIds.join(", ")} — composition ${group.householdComposition}; faits : ${group.facts}; attendu si précisé : ${group.expectedBranchIfKnown}; ${group.classifierReason}`).join("\n");
  const markdown = `${formatArticle110MatrixMarkdown(report)}\n## Validation de couverture\n\n### Types de résultat\n\n- Déterminés : ${report.byResultType.decision_determined}\n- Informations manquantes : ${report.byResultType.information_missing}\n- Pièces : ${report.byResultType.document_required}\n- Décisions ONEM : ${report.byResultType.onem_decision_required}\n- Non automatisés : ${report.byResultType.not_automated}\n- TOTAL : ${typeTotal}\n\n### Catégories déterminées\n\n- A : ${report.byCategory.A}\n- B : ${report.byCategory.B}\n- N : ${report.byCategory.N}\n- TOTAL : ${categoryTotal}\n\n### Couverture des compositions\n\n| Composition | Scénarios | Déterminés | Incomplets | Pièces | ONEM | Non automatisés |\n| --- | ---: | ---: | ---: | ---: | ---: | ---: |\n${compositionRows}\n\n### mixed_or_unsupported\n\n${mixedDetails}\n\n### Anomalies\n\n${report.anomalies.length ? report.anomalies.map((anomaly) => `- ${anomaly}`).join("\n") : "- Aucune."}\n\nAssertions : types=${report.assertions.resultTypesTotal}, catégories=${report.assertions.categoriesTotal}, incohérents=${report.assertions.incoherent}, justifications=${report.assertions.withoutReason}, A=${report.assertions.atLeastOneA}, B=${report.assertions.atLeastOneB}, N=${report.assertions.atLeastOneN}.\n\nDurée : ${report.durationMs} ms\n`;
  await mkdir(path.join(root, "artifacts"), { recursive: true });
  await Promise.all([
    writeFile(path.join(root, "docs", "audits", "ARTICLE_110_SCENARIO_MATRIX.md"), markdown, "utf8"),
    writeFile(path.join(root, "artifacts", "article-110-scenario-matrix.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8"),
  ]);
  console.log(`Article 110 scenario matrix: ${report.total} scenarios, ${report.incoherent.length} incoherent, ${report.withoutReason.length} without reason.`);
}

void main();
