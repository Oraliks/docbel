"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, RotateCcw, History, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DocumentField } from "@/lib/documents/types";

interface Revision {
  id: string;
  version: number;
  schema: DocumentField[];
  sourceType: string;
  rgpdNotice: string | null;
  retentionDays: number;
  outputFilenameTpl: string;
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

export function TemplateHistoryView({ data }: { data: Data }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  async function restore(rev: Revision) {
    if (
      !confirm(
        `Restaurer la version ${rev.version} ? La version actuelle sera archivée comme nouvelle révision.`
      )
    ) {
      return;
    }
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
      <div className="flex items-center gap-3">
        <Button render={<Link href={`/admin/documents/${data.toolId}`} />} variant="ghost" size="sm">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Retour à l&apos;éditeur
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <History className="w-6 h-6" />
            Historique : {data.toolName}
          </h1>
          <p className="text-sm text-muted-foreground">
            Version actuelle : <Badge>v{data.currentVersion}</Badge>{" "}
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
              Une révision sera automatiquement créée à chaque modification du schema des champs.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.revisions.map((rev) => (
            <Card key={rev.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      Version {rev.version}
                      <Badge variant="outline" className="text-xs">
                        {rev.schema.length} champ{rev.schema.length !== 1 ? "s" : ""}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {rev.sourceType}
                      </Badge>
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      Archivée le {new Date(rev.createdAt).toLocaleString("fr-BE")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPreviewId(previewId === rev.id ? null : rev.id)}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      {previewId === rev.id ? "Masquer" : "Voir"}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => restore(rev)}
                      disabled={busyId === rev.id}
                      variant="default"
                    >
                      <RotateCcw className="w-4 h-4 mr-1" />
                      {busyId === rev.id ? "Restauration…" : "Restaurer"}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {previewId === rev.id && (
                <CardContent className="border-t pt-4">
                  <Alert className="mb-3">
                    <AlertDescription className="text-xs">
                      Aperçu lecture seule. Cliquez sur <b>Restaurer</b> pour appliquer cette version.
                    </AlertDescription>
                  </Alert>
                  <div className="space-y-1 text-sm">
                    {rev.schema.length === 0 ? (
                      <p className="text-muted-foreground">Aucun champ.</p>
                    ) : (
                      rev.schema.map((f) => (
                        <div
                          key={f.id}
                          className="flex items-center gap-2 px-3 py-2 border rounded text-xs"
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
                          {f.section && (
                            <Badge variant="secondary" className="text-[10px]">
                              {f.section}
                            </Badge>
                          )}
                          <code className="text-muted-foreground ml-auto">{f.id}</code>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
