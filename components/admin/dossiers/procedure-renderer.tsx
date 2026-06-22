import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  AlertCircleIcon,
  CalendarClockIcon,
  ExternalLinkIcon,
  FileTextIcon,
  GavelIcon,
  ListChecksIcon,
  ScrollTextIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TheoryRenderer } from "./theory-renderer";
import type { DossierProcedure } from "@/lib/dossiers/types";
import { lookupUrl } from "@/lib/dossiers/procedures";

interface Props {
  procedure: DossierProcedure;
}

const PURPOSE_BADGE: Record<string, { labelKey: string; className: string }> = {
  demande: { labelKey: "purposeDemande", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200" },
  paiement: { labelKey: "purposePaiement", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200" },
  support: { labelKey: "purposeSupport", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200" },
  controle: { labelKey: "purposeControle", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200" },
};

/// Rendu d'une procédure d'introduction (réglementation, conditions, délais,
/// formulaires, étapes paraphrasées, codes ONEM avec deep-links lookup).
export function ProcedureRenderer({ procedure: p }: Props) {
  const t = useTranslations("admin.dossiers");
  const steps = [...p.steps].sort((a, b) => a.order - b.order);

  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-2 border-b pb-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ScrollTextIcon className="size-3.5" />
          {t("procedureNatureLabel")} <code className="rounded bg-muted px-1 py-0.5 font-mono">{p.natureDA}</code>
          {p.lastReviewedAt && <span className="ml-auto">{t("reviewedOn", { date: p.lastReviewedAt })}</span>}
        </div>
        <h2 className="text-xl font-semibold">{p.title}</h2>
        <p className="text-sm text-muted-foreground">{p.summary}</p>
      </header>

      {p.reglementation && p.reglementation.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <GavelIcon className="size-4 text-muted-foreground" />
            {t("regulation")}
          </h3>
          <ul className="ml-6 list-disc text-sm text-muted-foreground">
            {p.reglementation.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>
      )}

      {(p.conditionsObligatoire || p.conditionsFacultative) && (
        <section className="grid gap-4 md:grid-cols-2">
          {p.conditionsObligatoire && (
            <div className="rounded-lg border bg-card p-4">
              <h3 className="mb-2 text-sm font-semibold text-red-700 dark:text-red-300">
                {t("daMandatory")}
              </h3>
              <ul className="ml-5 list-disc space-y-1 text-sm">
                {p.conditionsObligatoire.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}
          {p.conditionsFacultative && (
            <div className="rounded-lg border bg-card p-4">
              <h3 className="mb-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
                {t("daOptional")}
              </h3>
              <ul className="ml-5 list-disc space-y-1 text-sm">
                {p.conditionsFacultative.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {p.delais && (
        <section className="flex flex-col gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <CalendarClockIcon className="size-4 text-muted-foreground" />
            {t("deadlines")}
          </h3>
          <dl className="grid gap-2 text-sm md:grid-cols-2">
            {p.delais.obligatoire && (
              <div className="rounded border bg-muted/30 p-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("deadlineMandatory")}
                </dt>
                <dd className="mt-1">{p.delais.obligatoire}</dd>
              </div>
            )}
            {p.delais.facultative && (
              <div className="rounded border bg-muted/30 p-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("deadlineOptional")}
                </dt>
                <dd className="mt-1">{p.delais.facultative}</dd>
              </div>
            )}
            {p.delais.exceptions && (
              <div className="rounded border border-dashed bg-muted/30 p-3 md:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("deadlineException")}
                </dt>
                <dd className="mt-1 italic">{p.delais.exceptions}</dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {p.formulaires && p.formulaires.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <FileTextIcon className="size-4 text-muted-foreground" />
            {t("forms")}
          </h3>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">{t("colCode")}</th>
                  <th className="px-3 py-2 text-left">{t("colLabel")}</th>
                  <th className="px-3 py-2 text-left">{t("colRole")}</th>
                  <th className="px-3 py-2 text-left">{t("colReference")}</th>
                </tr>
              </thead>
              <tbody>
                {p.formulaires.map((f) => {
                  const badge = PURPOSE_BADGE[f.purpose];
                  return (
                    <tr key={f.code} className="border-t">
                      <td className="px-3 py-2 align-top">
                        {f.pdfFormSlug ? (
                          <Link
                            href={`/document/${f.pdfFormSlug}`}
                            className="font-mono text-foreground hover:underline"
                          >
                            {f.code}
                          </Link>
                        ) : (
                          <span className="font-mono">{f.code}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">{f.label}</td>
                      <td className="px-3 py-2 align-top">
                        {badge && (
                          <span
                            className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ${badge.className}`}
                          >
                            {t(badge.labelKey as Parameters<typeof t>[0])}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top text-xs text-muted-foreground">
                        {f.officialRef ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <ListChecksIcon className="size-4 text-muted-foreground" />
          {t("operationalSteps")}
        </h3>
        <ol className="flex flex-col gap-3">
          {steps.map((s) => (
            <li key={s.order} className="flex gap-3 rounded-lg border bg-card p-3">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                {s.order >= 100 ? "+" : s.order}
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2">
                  <h4 className="text-sm font-medium">{s.title}</h4>
                  {s.when && (
                    <Badge variant="outline" className="text-[10px]">
                      {s.when}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{s.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {p.codeReferences && p.codeReferences.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{t("onemCodes")}</h3>
          <ul className="flex flex-col gap-1.5 text-sm">
            {p.codeReferences.map((c, i) => (
              <li key={`${c.tableSlug}-${c.code ?? "*"}-${i}`} className="flex items-baseline gap-2">
                <Link
                  href={lookupUrl(c.tableSlug, c.code)}
                  className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-xs hover:bg-muted/70"
                >
                  {c.code ?? "table"}
                  <ExternalLinkIcon className="size-3 opacity-60" />
                </Link>
                <span className="flex-1">{c.label}</span>
                {c.context && (
                  <span className="text-xs italic text-muted-foreground">{c.context}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {p.notes && (
        <section className="rounded-lg border-l-4 border-amber-400 bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-amber-900 dark:text-amber-200">
            <AlertCircleIcon className="size-3.5" />
            {t("keyTakeaway")}
          </div>
          <TheoryRenderer markdown={p.notes} />
        </section>
      )}
    </article>
  );
}
