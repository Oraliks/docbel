"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DocumentStatsView } from "./document-stats-view";

interface TemplateFunnel {
  templateId: string;
  templateName: string;
  templateSlug: string;
  started: number;
  preview: number;
  signatureStarted: number;
  submitted: number;
  abandoned: number;
  uniqueSessions: number;
  fieldErrors: { fieldId: string; count: number }[];
}

interface PerTemplate {
  total: number;
  loggedIn: number;
  emailed: number;
  name: string;
  slug: string;
}

interface Props {
  funnels: TemplateFunnel[];
  genTotals: {
    last30Days: number;
    loggedIn: number;
    anonymous: number;
    emailed: number;
    activeTemplates: number;
  };
  allTime: number;
  perTemplate: PerTemplate[];
  perDay: { date: string; count: number }[];
}

type Tab = "funnel" | "stats";

export function AnalyticsTabs({ funnels, genTotals, allTime, perTemplate, perDay }: Props) {
  // Lecture du tab depuis l'URL (?tab=stats par ex)
  const initialTab: Tab =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tab") === "stats"
      ? "stats"
      : "funnel";
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  // Totaux funnel
  const totals = funnels.reduce(
    (acc, f) => {
      acc.started += f.started;
      acc.submitted += f.submitted;
      acc.abandoned += f.abandoned;
      acc.sessions += f.uniqueSessions;
      return acc;
    },
    { started: 0, submitted: 0, abandoned: 0, sessions: 0 }
  );
  const conversionRate = totals.started > 0 ? (totals.submitted / totals.started) * 100 : 0;
  const abandonRate = totals.started > 0 ? (totals.abandoned / totals.started) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b">
        <button
          type="button"
          onClick={() => setActiveTab("funnel")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "funnel"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Funnel & abandon
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("stats")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "stats"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Statistiques générations
        </button>
      </div>

      {activeTab === "funnel" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" /> Sessions uniques
                </div>
                <div className="text-2xl font-bold">{totals.sessions}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground">Démarrés</div>
                <div className="text-2xl font-bold">{totals.started}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                  Conversion
                </div>
                <div className="text-2xl font-bold text-green-600">
                  {conversionRate.toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground">{totals.submitted} générés</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5 text-amber-600" />
                  Abandon
                </div>
                <div className="text-2xl font-bold text-amber-600">{abandonRate.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground">{totals.abandoned} abandons</div>
              </CardContent>
            </Card>
          </div>

          {funnels.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center text-muted-foreground">
                <BarChart3 className="w-10 h-10 mx-auto mb-3" />
                <p>Aucune donnée de funnel encore.</p>
                <p className="text-xs mt-1">
                  Les événements sont enregistrés dès qu&apos;un utilisateur ouvre un formulaire publié.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Funnel par document</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead>Document</TableHead>
                      <TableHead className="text-right">Démarrés</TableHead>
                      <TableHead className="text-right">Aperçu</TableHead>
                      <TableHead className="text-right">Soumis</TableHead>
                      <TableHead className="text-right">Abandonnés</TableHead>
                      <TableHead className="text-right">Conversion</TableHead>
                      <TableHead>Top erreurs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {funnels.map((f) => {
                      const conv = f.started > 0 ? (f.submitted / f.started) * 100 : 0;
                      return (
                        <TableRow key={f.templateId}>
                          <TableCell>
                            <div className="space-y-0.5">
                              <Link
                                href={`/outils/${f.templateSlug}`}
                                target="_blank"
                                className="font-medium hover:underline"
                              >
                                {f.templateName}
                              </Link>
                              <code className="text-xs text-muted-foreground block">
                                /{f.templateSlug}
                              </code>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{f.started}</TableCell>
                          <TableCell className="text-right">{f.preview}</TableCell>
                          <TableCell className="text-right text-green-600 font-medium">
                            {f.submitted}
                          </TableCell>
                          <TableCell className="text-right text-amber-600">{f.abandoned}</TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant="outline"
                              className={
                                conv >= 60
                                  ? "bg-green-500/10 dark:bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30"
                                  : conv >= 30
                                    ? "bg-amber-500/10 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                                    : "bg-red-500/10 dark:bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30"
                              }
                            >
                              {conv.toFixed(0)}%
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {f.fieldErrors.length === 0 ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {f.fieldErrors.slice(0, 3).map((e) => (
                                  <Badge
                                    key={e.fieldId}
                                    variant="outline"
                                    className="text-[10px] gap-1 bg-red-500/10 dark:bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30"
                                  >
                                    <AlertTriangle className="w-2.5 h-2.5" />
                                    <code>{e.fieldId}</code> ({e.count})
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === "stats" && (
        <DocumentStatsView
          totals={genTotals}
          allTime={allTime}
          perTemplate={perTemplate}
          perDay={perDay}
        />
      )}
    </div>
  );
}
