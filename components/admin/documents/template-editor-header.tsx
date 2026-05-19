"use client";

import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Save,
  Globe,
  EyeOff,
  ExternalLink,
  Settings,
  History,
  FlaskConical,
  Files,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { DocumentField } from "@/lib/documents/types";

interface ToolInfo {
  id: string;
  name: string;
  slug: string;
  sectionName: string;
}

interface Props {
  tool: ToolInfo;
  templateId: string;
  version: number;
  status: string;
  isPdf: boolean;
  schema: DocumentField[];
  dirty: boolean;
  saving: boolean;
  duplicateIds: string[];
  onOpenSettings: () => void;
  onSave: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
}

/// Header de l'éditeur de template : titre + badges + actions globales (Test,
/// Paramètres, Sauvegarder, Publier/Dépublier, Historique, Comparer, Voir public).
export function TemplateEditorHeader({
  tool,
  templateId,
  version,
  status,
  isPdf,
  schema,
  dirty,
  saving,
  duplicateIds,
  onOpenSettings,
  onSave,
  onPublish,
  onUnpublish,
}: Props) {
  async function generateTestPdf() {
    try {
      const res = await fetch(`/api/documents/templates/${templateId}/test-generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Envoie le schema EN MÉMOIRE (peut être différent du sauvegardé)
        // pour permettre de tester avant de sauvegarder.
        body: JSON.stringify({ schema }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Échec");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `test-${tool.slug}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(
        dirty
          ? "PDF de test généré (sur ton brouillon en cours, non sauvegardé)"
          : "PDF de test généré"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 justify-between">
      <div className="flex items-center gap-3 min-w-0">
        <Button render={<Link href="/admin/documents" />} variant="ghost" size="sm">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Retour
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold truncate">{tool.name}</h1>
          <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            <code className="text-xs">/outils/{tool.slug}</code>
            <Badge variant="outline" className="text-xs">
              {tool.sectionName}
            </Badge>
            <Badge variant="outline" className="text-xs">
              v{version}
            </Badge>
            <Badge
              variant={status === "published" ? "default" : "secondary"}
              className="text-xs"
            >
              {status === "published"
                ? "Publié"
                : status === "archived"
                ? "Archivé"
                : "Brouillon"}
            </Badge>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          render={<Link href={`/admin/documents/${tool.id}/history`} />}
          variant="ghost"
          size="sm"
        >
          <History className="w-4 h-4 mr-1" />
          Historique
        </Button>
        {isPdf && (
          <Button
            render={<Link href={`/admin/documents/${tool.id}/compare-source`} />}
            variant="ghost"
            size="sm"
            title="Compare avec une autre version PDF"
          >
            <Files className="w-4 h-4 mr-1" />
            Comparer
          </Button>
        )}
        {status === "published" && (
          <Button
            render={<Link href={`/outils/${tool.slug}`} target="_blank" />}
            variant="outline"
            size="sm"
          >
            <ExternalLink className="w-4 h-4 mr-1" />
            Voir public
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={generateTestPdf}
          disabled={saving || schema.length === 0}
          title="Génère un PDF avec des données fictives pour tester le rendu (utilise le schema en cours, sauvegardé ou non)"
        >
          <FlaskConical className="w-4 h-4 mr-1" />
          Tester
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenSettings}
          title="Paramètres du modèle (RGPD, organisme, conservation…)"
        >
          <Settings className="w-4 h-4 mr-1" />
          Paramètres
        </Button>
        <Button
          onClick={onSave}
          disabled={saving || duplicateIds.length > 0}
          size="sm"
        >
          <Save className="w-4 h-4 mr-1" />
          {saving ? "Sauvegarde…" : "Sauvegarder"}
        </Button>
        {status !== "published" ? (
          <Button
            onClick={onPublish}
            disabled={saving || duplicateIds.length > 0 || schema.length === 0}
            size="sm"
          >
            <Globe className="w-4 h-4 mr-1" />
            Publier
          </Button>
        ) : (
          <Button onClick={onUnpublish} disabled={saving} size="sm" variant="outline">
            <EyeOff className="w-4 h-4 mr-1" />
            Dépublier
          </Button>
        )}
      </div>
    </div>
  );
}
