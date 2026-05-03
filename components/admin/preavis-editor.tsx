"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Info, FileJson, ChevronDown } from "lucide-react";

type Unit = "semaines" | "jours";

interface NoticeRow {
  anMin: number;
  anMax: number | null;
  semaines?: number | string;
  jours?: number;
  label: string;
  formula?: string;
}

interface NoticeTable {
  description?: string;
  label?: string;
  unit?: Unit;
  note?: string;
  table: NoticeRow[];
}

interface PreavisData {
  metadata: {
    source: string;
    lastUpdated: string;
    note?: string;
  };
  cdi_licenciement_post_2014: NoticeTable;
  cdi_demission_post_2014: NoticeTable;
  cdi_contre_preavis: NoticeTable;
  cdi_pension_legal?: { description?: string; note?: string };
  cdi_pre_2014_employe?: unknown;
  cdi_pre_2014_ouvrier: {
    description?: string;
    cct_75: NoticeTable;
    loi_generale: NoticeTable;
    post_2012_pre_2014: NoticeTable;
    secteur_public_pre_2012: NoticeTable;
  };
  [key: string]: unknown;
}

type EditableTablePath =
  | "cdi_licenciement_post_2014"
  | "cdi_demission_post_2014"
  | "cdi_contre_preavis"
  | "cdi_pre_2014_ouvrier.cct_75"
  | "cdi_pre_2014_ouvrier.loi_generale"
  | "cdi_pre_2014_ouvrier.post_2012_pre_2014"
  | "cdi_pre_2014_ouvrier.secteur_public_pre_2012";

const TABLE_DEFS: {
  path: EditableTablePath;
  title: string;
  shortTitle: string;
  unit: Unit;
  context: string;
}[] = [
  {
    path: "cdi_licenciement_post_2014",
    title: "CDI — Licenciement par l'employeur (post-2014)",
    shortTitle: "Licenciement",
    unit: "semaines",
    context:
      "Tableau officiel SPF pour contrats commencés à partir du 01/01/2014 quand l'employeur licencie. Une formule (65 + années - 24) s'applique au-delà de 24 ans.",
  },
  {
    path: "cdi_demission_post_2014",
    title: "CDI — Démission par le travailleur (post-2014)",
    shortTitle: "Démission",
    unit: "semaines",
    context:
      "S'applique à la démission d'un contrat conclu après le 01/01/2014. Plafonné à 13 semaines à partir de 8 ans.",
  },
  {
    path: "cdi_contre_preavis",
    title: "CDI — Contre-préavis",
    shortTitle: "Contre-préavis",
    unit: "semaines",
    context:
      "Délai réduit pour le travailleur licencié qui retrouve un emploi et souhaite partir plus tôt.",
  },
  {
    path: "cdi_pre_2014_ouvrier.cct_75",
    title: "Ouvrier pré-2012 — CCT n°75",
    shortTitle: "Ouvrier CCT 75",
    unit: "jours",
    context:
      "Régime conventionnel des ouvriers du privé entrés avant 01/01/2012, à défaut d'arrêté royal sectoriel.",
  },
  {
    path: "cdi_pre_2014_ouvrier.loi_generale",
    title: "Ouvrier pré-2012 — Loi générale",
    shortTitle: "Ouvrier Loi",
    unit: "jours",
    context:
      "Régime supplétif quand la CCT n°75 ne s'applique pas (avant 01/01/2012).",
  },
  {
    path: "cdi_pre_2014_ouvrier.post_2012_pre_2014",
    title: "Ouvrier 2012–2013 — Loi",
    shortTitle: "Ouvrier 2012–13",
    unit: "jours",
    context:
      "Régime appliqué aux ouvriers du privé entre 01/01/2012 et 31/12/2013.",
  },
  {
    path: "cdi_pre_2014_ouvrier.secteur_public_pre_2012",
    title: "Ouvrier secteur public pré-2012",
    shortTitle: "Ouvrier public",
    unit: "jours",
    context:
      "Ouvriers du secteur public dont le contrat a commencé avant 01/01/2012.",
  },
];

function getTable(data: PreavisData, path: EditableTablePath): NoticeTable {
  const segments = path.split(".") as string[];
  let current: unknown = data;
  for (const seg of segments) {
    current = (current as Record<string, unknown>)[seg];
  }
  return current as NoticeTable;
}

function formatAnMax(value: number | null): string {
  return value === null ? "∞" : String(value);
}

export function PreavisEditor({ initialData }: { initialData: PreavisData }) {
  const [activeTab, setActiveTab] = useState<EditableTablePath>(TABLE_DEFS[0].path);
  const [expandedTables, setExpandedTables] = useState<Record<EditableTablePath, boolean>>({});
  const [showMetadata, setShowMetadata] = useState(false);


  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Préavis</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Gérez les tables officielles SPF Emploi utilisées par le calculateur
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1.5">
              <FileJson className="w-3.5 h-3.5" />
              <code className="text-xs font-mono">notice-periods-official.json</code>
            </Badge>
          </div>
        </div>

        {/* Read-only Notice */}
        <div className="flex items-center gap-2">
          <Badge variant="secondary">🔒 Lecture seule</Badge>
          <p className="text-xs text-muted-foreground">
            Ces données proviennent du SPF Emploi — visualisation uniquement
          </p>
        </div>
      </div>

      {/* Alert */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950 flex gap-3">
        <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-900 dark:text-blue-200 leading-relaxed">
          Les modifications prennent effet après un <strong>redémarrage du serveur</strong> car les tables sont importées à la compilation.
        </p>
      </div>

      {/* Info Card - Collapsible */}
      <Card className="border-0 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <CardHeader className="pb-3">
          <button
            onClick={() => setShowMetadata(!showMetadata)}
            className="flex items-center justify-between w-full hover:opacity-75 transition-opacity"
          >
            <div className="flex items-center gap-2">
              <Info className="w-5 h-5 text-primary" />
              <CardTitle className="text-base">Source officielle</CardTitle>
            </div>
            <ChevronDown
              className={`w-5 h-5 text-muted-foreground transition-transform ${
                showMetadata ? "rotate-180" : ""
              }`}
            />
          </button>
        </CardHeader>
        {showMetadata && (
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              <strong className="text-foreground">Source :</strong> {initialData.metadata.source}
            </p>
            <p className="text-muted-foreground">
              <strong className="text-foreground">Mise à jour :</strong> {initialData.metadata.lastUpdated}
            </p>
            {initialData.metadata.note && (
              <p className="text-muted-foreground">
                <strong className="text-foreground">Note :</strong> {initialData.metadata.note}
              </p>
            )}
            <p className="text-xs text-muted-foreground pt-2 border-t border-border/30">
              Ces tables proviennent du SPF Emploi, Travail et Concertation sociale. Elles ne peuvent pas être modifiées pour garantir l&apos;intégrité des calculs officiels.
            </p>
          </CardContent>
        )}
      </Card>

      {/* Tables Editor */}
      <div className="space-y-4">
        <div>
          <div className="flex flex-wrap gap-1 bg-muted p-1 rounded-lg w-fit">
            {TABLE_DEFS.map((def) => (
              <button
                key={def.path}
                onClick={() => setActiveTab(def.path)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  activeTab === def.path
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {def.shortTitle}
              </button>
            ))}
          </div>
        </div>

        {/* Table Content */}
        {TABLE_DEFS.map((def) => {
          const table = getTable(initialData, def.path);
          if (activeTab !== def.path) return null;
          return (
            <Card key={def.path}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-base">{def.title}</CardTitle>
                      <CardDescription className="mt-2 text-xs leading-relaxed">
                        {def.context}
                      </CardDescription>
                    </div>
                    <Badge variant="outline">
                      {table.table.length} entrées
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {/* Read-only Table */}
                  <div className="overflow-x-auto border rounded-md">
                    <Table className="text-xs">
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-20 font-semibold">Ancienneté min</TableHead>
                          <TableHead className="w-20 font-semibold">Ancienneté max</TableHead>
                          <TableHead className="w-24 font-semibold">
                            {def.unit === "semaines" ? "Semaines" : "Jours"}
                          </TableHead>
                          <TableHead className="font-semibold">Description</TableHead>
                          {def.unit === "semaines" && (
                            <TableHead className="w-40 font-semibold">Formule</TableHead>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {table.table
                          .slice(0, expandedTables[def.path] ? undefined : 10)
                          .map((row, idx) => (
                            <TableRow key={idx} className="hover:bg-muted/20">
                              <TableCell className="p-2 text-muted-foreground">
                                {row.anMin}
                              </TableCell>
                              <TableCell className="p-2 text-muted-foreground">
                                {formatAnMax(row.anMax)}
                              </TableCell>
                              <TableCell className="p-2 font-semibold text-foreground">
                                {def.unit === "semaines" ? row.semaines : row.jours}
                              </TableCell>
                              <TableCell className="p-2 text-muted-foreground">
                                {row.label}
                              </TableCell>
                              {def.unit === "semaines" && (
                                <TableCell className="p-2 font-mono text-xs text-muted-foreground">
                                  {row.formula || "—"}
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* See More Button */}
                  {table.table.length > 10 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setExpandedTables((prev) => ({
                          ...prev,
                          [def.path]: !prev[def.path],
                        }))
                      }
                      className="w-full"
                    >
                      <ChevronDown
                        className={`w-4 h-4 mr-2 transition-transform ${
                          expandedTables[def.path] ? "rotate-180" : ""
                        }`}
                      />
                      {expandedTables[def.path]
                        ? `Masquer (${table.table.length} entrées)`
                        : `Voir plus (${table.table.length - 10} supplémentaires)`}
                    </Button>
                  )}

                  {/* Preview */}
                  <div className="rounded-lg border border-dashed bg-muted/30 p-3 space-y-1.5">
                    <p className="text-xs font-semibold text-foreground">
                      Aperçu — Premières entrées
                    </p>
                    {table.table.slice(0, 3).map((row, i) => (
                      <p key={i} className="text-xs text-muted-foreground">
                        <strong className="text-foreground">{row.anMin}</strong> à{" "}
                        <strong className="text-foreground">{formatAnMax(row.anMax)}</strong> ans
                        {" → "}
                        <strong className="text-foreground">
                          {def.unit === "semaines" ? row.semaines : row.jours} {def.unit}
                        </strong>{" "}
                        <span>({row.label})</span>
                      </p>
                    ))}
                    {table.table.length > 3 && (
                      <p className="text-xs italic text-muted-foreground">
                        … et {table.table.length - 3} entrées supplémentaires
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
      </div>
    </div>
  );
}
