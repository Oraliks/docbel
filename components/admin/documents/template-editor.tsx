"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Wand2 } from "lucide-react";
import { nanoid } from "nanoid";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { FieldEditorRow } from "./field-editor-row";
import { VisualPdfEditor } from "./visual-pdf-editor";
import { TemplateEditorHeader } from "./template-editor-header";
import {
  TemplateSettingsSheet,
  type TemplateSettingsValues,
} from "./template-settings-sheet";
import { ChangeNotesDialog, type ChangeType } from "./change-notes-dialog";
import { useAutosaveDraft } from "./hooks/use-autosave-draft";
import { DocumentField, DocumentSourceType } from "@/lib/documents/types";

interface OrganismeOption {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  color: string;
  type: string;
}

export interface PresetOption {
  id: string;
  name: string;
  description: string | null;
  category: string;
  fieldType: string;
  regex: string | null;
  regexFlags: string | null;
  minLength: number | null;
  maxLength: number | null;
  minValue: number | null;
  maxValue: number | null;
  minDate: string | null;
  maxDate: string | null;
  belgianType: string | null;
  errorMsg: string;
  errorMsgNl: string | null;
  helpText: string | null;
  helpTextNl: string | null;
  placeholder: string | null;
  placeholderNl: string | null;
  defaultLabel: string | null;
  defaultWidth: number | null;
  defaultHeight: number | null;
  defaultValue: string | null;
  defaultOptions: unknown;
  popular: boolean;
  icon: string | null;
}

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
  organismeId: string | null;
  effectiveDate: string | null;
  expiresAt: string | null;
  officialRef: string | null;
  requiresSignature: boolean;
  signaturePosition: { page: number; x: number; y: number; w: number; h: number } | null;
  sourceFile: { id: string; name: string; fileType: string | null; sha256: string | null };
  organisme: { id: string; code: string; name: string; shortName: string | null; color: string } | null;
  tool: { id: string; name: string; slug: string; sectionName: string };
}

interface TemplateEditorProps {
  initial: TemplateInitial;
  organismes: OrganismeOption[];
  presets: PresetOption[];
}

/// Orchestrateur de l'édition d'un template documentaire.
/// Compose : header (actions globales), éditeur visuel (PDF flat) OU liste
/// champs (DOCX/AcroForm), sheet Paramètres, dialog Note de changement.
export function TemplateEditor({ initial, organismes, presets }: TemplateEditorProps) {
  const router = useRouter();
  const confirm = useConfirm();

  // --- État édition champs ---
  const [schema, setSchema] = useState<DocumentField[]>(initial.schema);
  const [status, setStatus] = useState(initial.status);
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // --- État paramètres template (regroupés pour passage au Sheet) ---
  const [settings, setSettings] = useState<TemplateSettingsValues>({
    sourceType: initial.sourceType as DocumentSourceType,
    rgpdNotice: initial.rgpdNotice || "",
    retentionDays: initial.retentionDays,
    outputFilenameTpl: initial.outputFilenameTpl,
    organismeId: initial.organismeId,
    effectiveDate: initial.effectiveDate || "",
    expiresAt: initial.expiresAt || "",
    officialRef: initial.officialRef || "",
    requiresSignature: initial.requiresSignature,
  });
  function patchSettings(patch: Partial<TemplateSettingsValues>) {
    setSettings((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  }

  // --- Modal note de changement ---
  const [showChangeNotes, setShowChangeNotes] = useState(false);
  const [pendingChangeNotes, setPendingChangeNotes] = useState("");
  const [pendingChangeType, setPendingChangeType] = useState<ChangeType>("minor");
  const [pendingPublish, setPendingPublish] = useState<"published" | "draft" | undefined>(
    undefined
  );

  // --- Dérivés ---
  const initialSchemaJson = JSON.stringify(initial.schema);
  const schemaChanged = JSON.stringify(schema) !== initialSchemaJson;
  const isPdf = initial.sourceFile.fileType === "pdf";
  const isDocx = initial.sourceFile.fileType === "docx";
  const fieldIds = schema.map((f) => f.id);
  const duplicateIds = fieldIds.filter((id, i) => fieldIds.indexOf(id) !== i);

  // Auto-save brouillon dans localStorage (toutes les 3s pendant édition).
  // Propose de restaurer au prochain chargement si un brouillon non-sauvé est trouvé.
  useAutosaveDraft({
    templateId: initial.id,
    templateVersion: initial.version,
    schema,
    dirty,
    onRestore: (restored) => {
      setSchema(restored);
      setDirty(true);
    },
  });

  // --- Mutations champs (mode fallback non-PDF) ---
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

  // --- Auto-detect (PDF AcroForm / DOCX placeholders, hors flow visuel) ---
  async function handleParse() {
    const ok = await confirm({
      title: "Re-détecter les champs ?",
      description:
        "Les champs seront extraits à nouveau depuis le fichier source. Vos configurations existantes (label, type, validation) seront conservées pour les champs déjà présents.",
      confirmText: "Re-détecter",
    });
    if (!ok) return;
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

  // --- Save / Publish ---

  async function requestSave(opts?: { newStatus?: "published" | "draft" }) {
    if (schemaChanged) {
      const actionLabel =
        opts?.newStatus === "published"
          ? "Publication"
          : opts?.newStatus === "draft"
          ? "Dépublication"
          : "Sauvegarde";
      const wantsNote = await confirm({
        title: "Documenter ce changement ?",
        description: `Vous avez modifié les champs du formulaire (v${
          initial.version + 1
        } sera créée). Voulez-vous laisser une note pour expliquer ce qui a changé ? Vous pouvez aussi continuer directement.`,
        confirmText: "Oui, ajouter une note",
        cancelText: `Non, ${actionLabel.toLowerCase()} sans note`,
      });
      if (wantsNote) {
        setPendingPublish(opts?.newStatus);
        setPendingChangeNotes("");
        setPendingChangeType("minor");
        setShowChangeNotes(true);
      } else {
        void doSave({ ...opts, changeType: "minor" });
      }
      return;
    }
    void doSave(opts);
  }

  async function doSave(opts?: {
    newStatus?: "published" | "draft";
    changeNotes?: string;
    changeType?: ChangeType;
  }) {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        schema,
        rgpdNotice: settings.rgpdNotice || null,
        retentionDays: settings.retentionDays,
        outputFilenameTpl: settings.outputFilenameTpl,
        sourceType: settings.sourceType,
        organismeId: settings.organismeId || null,
        effectiveDate: settings.effectiveDate || null,
        expiresAt: settings.expiresAt || null,
        officialRef: settings.officialRef || null,
        requiresSignature: settings.requiresSignature,
      };
      if (opts?.newStatus) body.status = opts.newStatus;
      if (opts?.changeNotes !== undefined) body.changeNotes = opts.changeNotes;
      if (opts?.changeType) body.changeType = opts.changeType;

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
      setShowChangeNotes(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 w-full">
      <TemplateEditorHeader
        tool={initial.tool}
        templateId={initial.id}
        version={initial.version}
        status={status}
        isPdf={isPdf}
        schema={schema}
        dirty={dirty}
        saving={saving}
        duplicateIds={duplicateIds}
        onOpenSettings={() => setSettingsOpen(true)}
        onSave={() => requestSave()}
        onPublish={() => requestSave({ newStatus: "published" })}
        onUnpublish={() => requestSave({ newStatus: "draft" })}
      />

      {duplicateIds.length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            Identifiants en doublon :{" "}
            <code>{Array.from(new Set(duplicateIds)).join(", ")}</code>. Chaque champ
            doit avoir un id unique.
          </AlertDescription>
        </Alert>
      )}
      {dirty && (
        <Alert>
          <AlertDescription>Modifications non sauvegardées.</AlertDescription>
        </Alert>
      )}

      {/* ÉDITEUR — visuel pour pdf_flat, sinon liste FieldEditorRow */}
      {isPdf && settings.sourceType === "pdf_flat" ? (
        <VisualPdfEditor
          templateId={initial.id}
          templateName={initial.tool.name}
          organismeName={
            organismes.find((o) => o.id === settings.organismeId)?.name ?? null
          }
          sourceFileId={initial.sourceFile.id}
          sourceFileSha256={initial.sourceFile.sha256}
          schema={schema}
          presets={presets}
          onSchemaChange={(s) => {
            setSchema(s);
            setDirty(true);
          }}
        />
      ) : (
        <NonVisualFieldsList
          schema={schema}
          presets={presets}
          parsing={parsing}
          isPdf={isPdf}
          isDocx={isDocx}
          onParse={handleParse}
          onAddField={addField}
          onUpdateField={updateField}
          onRemoveField={removeField}
        />
      )}

      <TemplateSettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        values={settings}
        onChange={patchSettings}
        organismes={organismes}
        sourceFileName={initial.sourceFile.name}
        isPdf={isPdf}
        isDocx={isDocx}
      />

      <ChangeNotesDialog
        open={showChangeNotes}
        nextVersion={initial.version + 1}
        pendingStatus={pendingPublish}
        notes={pendingChangeNotes}
        onNotesChange={setPendingChangeNotes}
        changeType={pendingChangeType}
        onChangeTypeChange={setPendingChangeType}
        saving={saving}
        onCancel={() => setShowChangeNotes(false)}
        onConfirm={() =>
          doSave({
            newStatus: pendingPublish,
            changeNotes: pendingChangeNotes || undefined,
            changeType: pendingChangeType,
          })
        }
      />
    </div>
  );
}

interface NonVisualFieldsListProps {
  schema: DocumentField[];
  presets: PresetOption[];
  parsing: boolean;
  isPdf: boolean;
  isDocx: boolean;
  onParse: () => void;
  onAddField: () => void;
  onUpdateField: (idx: number, updated: DocumentField) => void;
  onRemoveField: (idx: number) => void;
}

/// Fallback pour les templates non-PDF-flat : liste éditable simple avec
/// FieldEditorRow par champ + boutons Auto-détecter et Ajouter un champ.
function NonVisualFieldsList({
  schema,
  presets,
  parsing,
  isPdf,
  isDocx,
  onParse,
  onAddField,
  onUpdateField,
  onRemoveField,
}: NonVisualFieldsListProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <CardTitle>Champs du formulaire</CardTitle>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={onParse}
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
          <Button size="sm" onClick={onAddField}>
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
                <code className="px-1 py-0.5 bg-muted rounded">{"{nom}"}</code>,{" "}
                <code className="px-1 py-0.5 bg-muted rounded">{"{date}"}</code> dans
                Word, puis cliquez sur <b>Auto-détecter</b>.
              </p>
            )}
            {isPdf && (
              <p className="text-xs">
                Cliquez sur <b>Auto-détecter</b> pour extraire les champs AcroForm du
                PDF, ou ajoutez-en manuellement.
              </p>
            )}
          </div>
        ) : (
          schema.map((f, idx) => (
            <FieldEditorRow
              key={f.id + idx}
              field={f}
              allFields={schema}
              presets={presets}
              onChange={(updated) => onUpdateField(idx, updated)}
              onRemove={() => onRemoveField(idx)}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}
