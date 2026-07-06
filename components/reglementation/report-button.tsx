"use client";

import { ReportButton as GenericReportButton } from "@/components/reports/report-button";

/// « Signaler une erreur » sur un article — persiste désormais dans Report
/// (type "riolex_article") au lieu d'un mailto sans trace (cf. migration 57).
export function ReportButton({
  riolexId,
  loi,
  articleNumber,
  label,
}: {
  riolexId: string;
  loi: string;
  articleNumber: string;
  label: string;
}) {
  return (
    <GenericReportButton
      type="riolex_article"
      targetId={riolexId}
      extraPayload={{ loi, articleNumber }}
      triggerLabel={label}
    />
  );
}
