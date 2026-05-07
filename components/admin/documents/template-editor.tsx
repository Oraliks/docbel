"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Save,
  Globe,
  EyeOff,
  Plus,
  ExternalLink,
  Wand2,
  Settings,
  ListChecks,
  LayoutGrid,
  History,
} from "lucide-react";
import { nanoid } from "nanoid";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FieldEditorRow } from "./field-editor-row";
import { VisualPdfEditor } from "./visual-pdf-editor";
import { DocumentPreviewPane } from "./document-preview-pane";
import { DocumentField, DocumentSourceType } from "@/lib/documents/types";

interface TemplateInitial {
  id: string;
  toolId: string;
  sourceType: string;
  schema: DocumentField[];
  rgpdNotice: string | null;
  retentionDays: number;
  outputFilenameTpl: string;
  status: string;
  version: number;
  sourceFile: { id: string; name: string; fileType: string | null };
  tool: { id: string; name: string; slug: string; sectionName: string };
}

interface TemplateEditorProps {
  initial: TemplateInitial;
}

type Tab = "fields" | "visual" | "settings";

export function TemplateEditor({ initial }: TemplateEditorProps) {
  const router = useRouter();
  const [schema, setSchema] = useState<DocumentField[]>(initial.schema);
  const [sourceType, setSourceType] = useState<DocumentSourceType>(
    initial.sourceType as DocumentSourceType
  );
  const [rgpdNotice, setRgpdNotice] = useState(initial.rgpdNotice || "");
  const [retentionDays, setRetentionDays] = useState(initial.retentionDays);
  const [outputFilenameTpl, setOutputFilenameTpl] = useState(initial.outputFilenameTpl);
  const [status, setStatus] = useState(initial.status);
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("fields");

  const isPdf = initial.sourceFile.fileType === "pdf";
  const isDocx = initial.sourceFile.fileType === "docx";

  const updateField = useCallback((idx: number, updated: DocumentField) => {
    setSchema((prev) => {
      const next = [...prev];
      next[idx] = updated;
      return next;
    });
    setDirty(true);
  }, []);

  const removeField = useCallback((idx: number) => {
    setSchema((prev) => prev.filter((_, i) => i !== idx));
    setDirty(true);
  }, []);

  const addField = useCallback(() => {
    setSchema((prev) => [
      ...prev,
      {
        id: `field_${nanoid(6)}`,
        label: "Nouveau champ",
        type: "text" as const,
        required: false,
      },
    ]);
    setDirty(true);
  }, []);

  async function handleParse() {
    if (
      !confirm(
        "Re-détecter les champs depuis le fichier source ? Vos configurations existantes seront conservées."
      )
    ) {
      return;
    }
    setParsing(true);
    try {
      const res = await fetch(`/api/documents/templates/${initial.id}/parse`, {
        method: "POST",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Échec de la détection");
      }
      const data = await res.json();
      setSchema(data.merged);
      setDirty(true);
      toast.success(`${data.detected.length} champ(s) détecté(s)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setParsing(false);
    }
  }

  async function handleSave(opts?: { newStatus?: string }) {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        schema,
        rgpdNotice: rgpdNotice || null,
        retentionDays,
        outputFilenameTpl,
        sourceType,
      };
      if (opts?.newStatus) body.status = opts.newStatus;

      const res = await fetch(`/api/documents/templates/${initial.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Échec");
      }
      const updated = await res.json();
      setStatus(updated.status);
      setDirty(false);
      toast.success(
        opts?.newStatus === "published"
          ? "Modèle publié"
          : opts?.newStatus === "draft"
          ? "Modèle dépublié"
          : "Sauvegardé"
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  const fieldIds = schema.map((f) => f.id);
  const duplicateIds = fieldIds.filter((id, i) => fieldIds.indexOf(id) !== i);

  const tabs: { id: Tab; label: string; icon: React.ReactNode; show: boolean }[] = [
    { id: "fields", label: `Champs (${schema.length})`, icon: <ListChecks className="w-4 h-4" />, show: true },
    { id: "visual", label: "Éditeur visuel", icon: <LayoutGrid className="w-4 h-4" />, show: isPdf && sourceType === "pdf_flat" },
    { id: "settings", label: "Paramètres", icon: <Settings className="w-4 h-4" />, show: true },
  ];

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Button render={<Link href="/admin/documents" />} variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Retour
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold truncate">{initial.tool.name}</h1>
            <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
              <code className="text-xs">/outils/{initial.tool.slug}</code>
              <Badge variant="outline" className="text-xs">{initial.tool.sectionName}</Badge>
              <Badge variant="outline" className="text-xs">v{initial.version}</Badge>
              <Badge variant={status === "published" ? "default" : "secondary"} className="text-xs">
                {status === "published" ? "Publié" : status === "archived" ? "Archivé" : "Brouillon"}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            render={<Link href={`/admin/documents/${initial.tool.id}/history`} />}
            variant="ghost"
            size="sm"
          >
            <History className="w-4 h-4 mr-1" />
            Historique
          </Button>
          {status === "published" && (
            <Button
              render={<Link href={`/outils/${initial.tool.slug}`} target="_blank" />}
              variant="outline"
              size="sm"
            >
              <ExternalLink className="w-4 h-4 mr-1" />
              Voir public
            </Button>
          )}
          <Button
            onClick={() => handleSave()}
            disabled={saving || duplicateIds.length > 0}
            size="sm"
          >
            <Save className="w-4 h-4 mr-1" />
            {saving ? "Sauvegarde…" : "Sauvegarder"}
          </Button>
          {status !== "published" ? (
            <Button
              onClick={() => handleSave({ newStatus: "published" })}
              disabled={saving || duplicateIds.length > 0 || schema.length === 0}
              size="sm"
            >
              <Globe className="w-4 h-4 mr-1" />
              Publier
            </Button>
          ) : (
            <Button
              onClick={() => handleSave({ newStatus: "draft" })}
              disabled={saving}
              size="sm"
              variant="outline"
            >
              <EyeOff className="w-4 h-4 mr-1" />
              Dépublier
            </Button>
          )}
        </div>
      </div>

      {/* Alertes */}
      {duplicateIds.length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            Identifiants en doublon : <code>{Array.from(new Set(duplicateIds)).join(", ")}</code>.
            Chaque champ doit avoir un id unique.
          </AlertDescription>
        </Alert>
      )}
      {dirty && (
        <Alert>
          <AlertDescription>Modifications non sauvegardées.</AlertDescription>
        </Alert>
      )}

      {/* Layout 2 colonnes : Preview à gauche, édition à droite */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] gap-6 items-start">
        {/* Preview pane */}
        <div className="lg:max-h-[calc(100vh-160px)] lg:overflow-auto">
          <DocumentPreviewPane
            templateId={initial.id}
            sourceFileId={initial.sourceFile.id}
            sourceFile={initial.sourceFile}
          />
        </div>

        {/* Edition pane */}
        <div className="space-y-4 min-w-0">
          {/* Tabs custom horizontal */}
          <div className="flex flex-wrap gap-1 border-b">
            {tabs
              .filter((t) => t.show)
              .map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === t.id
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
          </div>

          {/* Contenu des tabs */}
          {activeTab === "fields" && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
                <CardTitle>Champs du formulaire</CardTitle>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleParse}
                    disabled={parsing}
                    title={
                      isPdf
                        ? "Re-détecter les champs AcroForm du PDF"
                        : isDocx
                        ? "Re-détecter les placeholders {champ} du DOCX"
                        : ""
                    }
                  >
                    <Wand2 className="w-4 h-4 mr-1" />
                    {parsing ? "Détection…" : "Auto-détecter"}
                  </Button>
                  <Button size="sm" onClick={addField}>
                    <Plus className="w-4 h-4 mr-1" />
                    Ajouter un champ
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {schema.length === 0 ? (
                  <div className="text-center py-12 px-4 text-sm text-muted-foreground space-y-2">
                    <p className="font-medium">Aucun champ pour l&apos;instant</p>
                    {isDocx && (
                      <p className="text-xs">
                        Pour les DOCX, ajoutez des placeholders comme{" "}
                        <code className="px-1 py-0.5 bg-muted rounded">{"{nom}"}</code>
                        ,{" "}
                        <code className="px-1 py-0.5 bg-muted rounded">{"{date}"}</code>{" "}
                        dans Word, puis cliquez sur <b>Auto-détecter</b>.
                      </p>
                    )}
                    {isPdf && (
                      <p className="text-xs">
                        Cliquez sur <b>Auto-détecter</b> pour extraire les champs AcroForm du PDF,
                        ou ajoutez-en manuellement.
                      </p>
                    )}
                  </div>
                ) : (
                  schema.map((f, idx) => (
                    <FieldEditorRow
                      key={f.id + idx}
                      field={f}
                      allFields={schema}
                      onChange={(updated) => updateField(idx, updated)}
                      onRemove={() => removeField(idx)}
                    />
                  ))
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === "visual" && isPdf && sourceType === "pdf_flat" && (
            <VisualPdfEditor
              templateId={initial.id}
              sourceFileId={initial.sourceFile.id}
              schema={schema}
              onSchemaChange={(s) => {
                setSchema(s);
                setDirty(true);
              }}
            />
          )}

          {activeTab === "settings" && (
            <Card>
              <CardHeader>
                <CardTitle>Paramètres du modèle</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 max-w-md">
                  <Label>Type de source</Label>
                  <Select
                    value={sourceType}
                    onValueChange={(v) => {
                      if (!v) return;
                      setSourceType(v as DocumentSourceType);
                      setDirty(true);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {isPdf && <SelectItem value="pdf_acroform">PDF avec champs (AcroForm)</SelectItem>}
                      {isPdf && <SelectItem value="pdf_flat">PDF plat (positionnement manuel)</SelectItem>}
                      {isDocx && <SelectItem value="docx">DOCX (placeholders)</SelectItem>}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Fichier source : <code>{initial.sourceFile.name}</code>
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Notice RGPD (affichée à l&apos;utilisateur avant remplissage)</Label>
                  <Textarea
                    value={rgpdNotice}
                    onChange={(e) => {
                      setRgpdNotice(e.target.value);
                      setDirty(true);
                    }}
                    rows={4}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Conservation (jours)</Label>
                    <Input
                      type="number"
                      value={retentionDays}
                      onChange={(e) => {
                        setRetentionDays(parseInt(e.target.value, 10) || 30);
                        setDirty(true);
                      }}
                      min="1"
                      max="365"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nom du fichier généré</Label>
                    <Input
                      value={outputFilenameTpl}
                      onChange={(e) => {
                        setOutputFilenameTpl(e.target.value);
                        setDirty(true);
                      }}
                      placeholder="document-{{date}}.pdf"
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Variables : <code>{"{{date}}"}</code> ou <code>{"{{champ_id}}"}</code>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
