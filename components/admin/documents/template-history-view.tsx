"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  RotateCcw,
  History,
  Eye,
  Plus,
  Minus,
  Edit3,
  ArrowDownToLine,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { DocumentField } from "@/lib/documents/types";

interface DiffSummary {
  added: { id: string; label: string; type: string }[];
  removed: { id: string; label: string; type: string }[];
  modified: { id: string; label: string; changes: { key: string; from: unknown; to: unknown }[] }[];
  summary: string;
}

interface Revision {
  id: string;
  version: number;
  schema: DocumentField[];
  sourceType: string;
  rgpdNotice: string | null;
  retentionDays: number;
  outputFilenameTpl: string;
  changeNotes: string | null;
  changeType: string;
  diffSummary: DiffSummary | null;
  createdBy: string | null;
  createdAt: string;
}

interface Data {
  toolId: string;
  toolName: string;
  toolSlug: string;
  templateId: string;
  currentVersion: number;
  currentSchema: DocumentField[];
  revisions: Revision[];
}

const CHANGE_TYPE_BADGE: Record<string, { label: string; color: string }> = {
  minor: { label: "Mineur", color: "bg-blue-100 text-blue-800 border-blue-300" },
  major: { label: "Majeur", color: "bg-red-100 text-red-800 border-red-300" },
  hotfix: { label: "Correctif", color: "bg-amber-100 text-amber-800 border-amber-300" },
  source_update: { label: "Source mise à jour", color: "bg-purple-100 text-purple-800 border-purple-300" },
};

function truncate(value: unknown, max = 60): string {
  const s = value === null || value === undefined ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value);
  if (s.length <= max) return s;
  return s.slice(0, max) + "…";
}

export function TemplateHistoryView({ data }: { data: Data }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  async function restore(rev: Revision) {
    const ok = await confirm({
      title: `Restaurer la version ${rev.version} ?`,
      description:
        "La version actuelle sera automatiquement archivée comme nouvelle révision avant la restauration. Aucune donnée n'est perdue.",
      confirmText: "Restaurer",
    });
    if (!ok) return;
    setBusyId(rev.id);
    try {
      const res = await fetch(
        `/api/documents/templates/${data.templateId}/revisions/${rev.id}/restore`,
        { method: "POST" }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Échec");
      }
      toast.success(`Version ${rev.version} restaurée`);
      router.push(`/admin/documents/${data.toolId}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button render={<Link href={`/admin/documents/${data.toolId}`} />} variant="ghost" size="sm">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Retour à l&apos;éditeur
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold flex items-center gap-2 truncate">
            <History className="w-6 h-6 flex-shrink-0" />
            Historique : {data.toolName}
          </h1>
          <p className="text-sm text-muted-foreground">
            Version actuelle : <Badge>v{data.currentVersion}</Badge>
            <span className="ml-2">
              {data.revisions.length} révision{data.revisions.length !== 1 ? "s" : ""} archivée
              {data.revisions.length !== 1 ? "s" : ""}
            </span>
          </p>
        </div>
      </div>

      {data.revisions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <History className="w-10 h-10 mx-auto mb-3" />
            <p>Aucune révision archivée pour l&apos;instant.</p>
            <p className="text-xs mt-1">
              Une révision sera automatiquement créée à chaque modification du schéma des champs.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.revisions.map((rev) => {
            const typeBadge = CHANGE_TYPE_BADGE[rev.changeType] || CHANGE_TYPE_BADGE.minor;
            const diff = rev.diffSummary;
            const open = openId === rev.id;
            return (
              <Card key={rev.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="space-y-1.5 min-w-0">
                      <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                        Version {rev.version}
                        <Badge variant="outline" className={`text-xs ${typeBadge.color}`}>
                          {typeBadge.label}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {rev.schema.length} champ{rev.schema.length !== 1 ? "s" : ""}
                        </Badge>
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Archivée le {new Date(rev.createdAt).toLocaleString("fr-BE")}
                      </p>

                      {/* Résumé diff inline */}
                      {diff && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {diff.added.length > 0 && (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 text-xs gap-1">
                              <Plus className="w-3 h-3" />
                              {diff.added.length} ajouté{diff.added.length > 1 ? "s" : ""}
                            </Badge>
                          )}
                          {diff.removed.length > 0 && (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300 text-xs gap-1">
                              <Minus className="w-3 h-3" />
                              {diff.removed.length} supprimé{diff.removed.length > 1 ? "s" : ""}
                            </Badge>
                          )}
                          {diff.modified.length > 0 && (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-xs gap-1">
                              <Edit3 className="w-3 h-3" />
                              {diff.modified.length} modifié{diff.modified.length > 1 ? "s" : ""}
                            </Badge>
                          )}
                        </div>
                      )}

                      {rev.changeNotes && (
                        <p className="text-sm bg-muted/50 rounded p-2 mt-2 italic">{rev.changeNotes}</p>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOpenId(open ? null : rev.id)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        {open ? "Masquer" : "Détails"}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => restore(rev)}
                        disabled={busyId === rev.id}
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        {busyId === rev.id ? "Restauration…" : "Restaurer"}
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {open && (
                  <CardContent className="border-t pt-4 space-y-4">
                    {/* Diff détaillé */}
                    {diff && (diff.added.length > 0 || diff.removed.length > 0 || diff.modified.length > 0) ? (
                      <div className="space-y-3">
                        {diff.added.length > 0 && (
                          <div className="space-y-1.5">
                            <h4 className="text-sm font-medium flex items-center gap-1.5 text-green-700">
                              <Plus className="w-4 h-4" />
                              Ajoutés depuis cette version
                            </h4>
                            {diff.added.map((f) => (
                              <div
                                key={f.id}
                                className="text-xs flex items-center gap-2 px-3 py-2 border-l-2 border-green-500 bg-green-50/50"
                              >
                                <Badge variant="outline" className="text-[10px] font-mono">
                                  {f.type}
                                </Badge>
                                <span className="font-medium">{f.label}</span>
                                <code className="text-muted-foreground ml-auto">{f.id}</code>
                              </div>
                            ))}
                          </div>
                        )}
                        {diff.removed.length > 0 && (
                          <div className="space-y-1.5">
                            <h4 className="text-sm font-medium flex items-center gap-1.5 text-red-700">
                              <Minus className="w-4 h-4" />
                              Supprimés depuis cette version
                            </h4>
                            {diff.removed.map((f) => (
                              <div
                                key={f.id}
                                className="text-xs flex items-center gap-2 px-3 py-2 border-l-2 border-red-500 bg-red-50/50"
                              >
                                <Badge variant="outline" className="text-[10px] font-mono">
                                  {f.type}
                                </Badge>
                                <span className="font-medium line-through">{f.label}</span>
                                <code className="text-muted-foreground ml-auto">{f.id}</code>
                              </div>
                            ))}
                          </div>
                        )}
                        {diff.modified.length > 0 && (
                          <div className="space-y-1.5">
                            <h4 className="text-sm font-medium flex items-center gap-1.5 text-amber-700">
                              <Edit3 className="w-4 h-4" />
                              Modifiés depuis cette version
                            </h4>
                            {diff.modified.map((f) => (
                              <div
                                key={f.id}
                                className="text-xs px-3 py-2 border-l-2 border-amber-500 bg-amber-50/50 space-y-1.5"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{f.label}</span>
                                  <code className="text-muted-foreground">{f.id}</code>
                                </div>
                                <div className="space-y-0.5 pl-3 border-l border-amber-300">
                                  {f.changes.map((c, i) => (
                                    <div key={i} className="flex items-baseline gap-1.5 flex-wrap">
                                      <code className="text-[10px] font-mono bg-amber-100 px-1 rounded">
                                        {c.key}
                                      </code>
                                      <span className="text-red-600 line-through">{truncate(c.from)}</span>
                                      <ArrowDownToLine className="w-3 h-3 rotate-[-90deg] text-muted-foreground" />
                                      <span className="text-green-700">{truncate(c.to)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <Alert>
                        <AlertTriangle className="w-4 h-4" />
                        <AlertDescription className="text-xs">
                          Pas de diff calculé pour cette révision (révision créée avant
                          l&apos;activation du diff visuel).
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Schéma complet de la révision */}
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground py-1">
                        Voir le schéma complet de cette version ({rev.schema.length} champ
                        {rev.schema.length !== 1 ? "s" : ""})
                      </summary>
                      <div className="mt-2 space-y-1">
                        {rev.schema.map((f) => (
                          <div
                            key={f.id}
                            className="flex items-center gap-2 px-3 py-1.5 border rounded text-xs"
                          >
                            <Badge variant="outline" className="text-[10px] font-mono">
                              {f.type}
                            </Badge>
                            <span className="font-medium">{f.label}</span>
                            {f.required && (
                              <Badge variant="secondary" className="text-[10px]">
                                obligatoire
                              </Badge>
                            )}
                            <code className="text-muted-foreground ml-auto">{f.id}</code>
                          </div>
                        ))}
                      </div>
                    </details>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
