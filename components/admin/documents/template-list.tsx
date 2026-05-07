"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { FileText, Plus, Edit2, Globe, Archive, RefreshCw, BarChart3, History, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Template {
  id: string;
  toolId: string;
  sourceType: string;
  status: string;
  version: number;
  updatedAt: string;
  tool: { id: string; name: string; slug: string };
  sourceFile: { id: string; name: string; fileType: string | null };
}

interface TemplateListProps {
  templates: Template[];
}

const sourceTypeLabel: Record<string, string> = {
  pdf_acroform: "PDF (formulaire)",
  pdf_flat: "PDF (plat)",
  docx: "Word (DOCX)",
};

const statusLabel: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  draft: { label: "Brouillon", variant: "secondary" },
  published: { label: "Publié", variant: "default" },
  archived: { label: "Archivé", variant: "outline" },
};

export function TemplateList({ templates }: TemplateListProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function changeStatus(id: string, status: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/documents/templates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Échec");
      }
      toast.success(status === "published" ? "Publié" : status === "archived" ? "Archivé" : "Mis à jour");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Générateurs de documents</h1>
          <p className="text-muted-foreground mt-1">
            {templates.length} modèle{templates.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button render={<Link href="/admin/documents/generated" />} variant="outline">
            <Inbox className="w-4 h-4 mr-2" />
            Documents générés
          </Button>
          <Button render={<Link href="/admin/documents/stats" />} variant="outline">
            <BarChart3 className="w-4 h-4 mr-2" />
            Statistiques
          </Button>
          <Button render={<Link href="/admin/documents/new" />}>
            <Plus className="w-4 h-4 mr-2" />
            Nouveau modèle
          </Button>
        </div>
      </div>

      {templates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-2">
            <FileText className="w-10 h-10 text-muted-foreground" />
            <p className="text-muted-foreground">Aucun modèle pour l&apos;instant.</p>
            <Button render={<Link href="/admin/documents/new" />}>
              <Plus className="w-4 h-4 mr-2" />
              Créer le premier modèle
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => {
            const status = statusLabel[t.status] || { label: t.status, variant: "outline" as const };
            return (
              <Card key={t.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 space-y-1">
                      <CardTitle className="text-base">{t.tool.name}</CardTitle>
                      <CardDescription className="text-xs font-mono">/{t.tool.slug}</CardDescription>
                    </div>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-3 pb-4">
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className="text-xs">
                      {sourceTypeLabel[t.sourceType] || t.sourceType}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      v{t.version}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    Source : {t.sourceFile.name}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button
                      render={<Link href={`/admin/documents/${t.toolId}`} />}
                      variant="ghost"
                      size="sm"
                      className="flex-1"
                    >
                      <Edit2 className="w-4 h-4 mr-1" />
                      Éditer
                    </Button>
                    <Button
                      render={<Link href={`/admin/documents/${t.toolId}/history`} />}
                      variant="ghost"
                      size="sm"
                      title="Historique"
                    >
                      <History className="w-4 h-4" />
                    </Button>
                    {t.status === "draft" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === t.id}
                        onClick={() => changeStatus(t.id, "published")}
                      >
                        <Globe className="w-4 h-4 mr-1" />
                        Publier
                      </Button>
                    )}
                    {t.status === "published" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === t.id}
                        onClick={() => changeStatus(t.id, "draft")}
                      >
                        <RefreshCw className="w-4 h-4 mr-1" />
                        Dépublier
                      </Button>
                    )}
                    {t.status !== "archived" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy === t.id}
                        onClick={() => changeStatus(t.id, "archived")}
                        className="text-destructive hover:text-destructive"
                      >
                        <Archive className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
