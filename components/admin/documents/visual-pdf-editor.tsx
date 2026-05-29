"use client";

import { useCallback, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DocumentField, DocumentFieldType } from "@/lib/documents/types";
import type { ClickTarget } from "@/lib/documents/click-targets";
import { pdfToHtml, htmlToPdf, type PageGeometry } from "@/lib/pdf-canvas/coords";
import { AnnotationPopover } from "./annotation-popover";
import { AnnotatedFieldsSidebar } from "./annotated-fields-sidebar";
import { PdfCanvas } from "./pdf-canvas";
import { PdfMiniMap } from "./pdf-minimap";
import { type CanonicalFieldPreset } from "./field-library-picker";
import { usePdfDoc } from "./hooks/use-pdf-doc";
import { useClickTargets } from "./hooks/use-click-targets";
import { useOcrCorrections } from "./hooks/use-ocr-corrections";
import { useFieldSelection } from "./hooks/use-field-selection";
import { useKeyboardShortcuts } from "./hooks/use-keyboard-shortcuts";

/// Côté Documents, pdfjs ne nous expose pas la CropBox depuis le viewport
/// (PageDims = {width, height}). On suppose offsets = 0, ce qui est vrai sur
/// la quasi-totalité des PDF qui transitent dans Docbel.
function toGeo(dims: { width: number; height: number }): PageGeometry {
  return { width: dims.width, height: dims.height, offsetX: 0, offsetY: 0 };
}

interface VisualPdfEditorProps {
  templateId: string;
  templateName?: string;
  organismeName?: string | null;
  sourceFileId: string;
  sourceFileSha256?: string | null;
  schema: DocumentField[];
  onSchemaChange: (next: DocumentField[]) => void;
  presets?: CanonicalFieldPreset[];
}

/// Éditeur visuel d'un template PDF flat.
///
/// Architecture (single-page) :
///   - À gauche : PDF rendu avec deux overlays superposés
///     * ClickTargets (zones natives détectées : lignes pointillées, cases, etc.)
///     * Rnd des champs déjà placés (draggables + resizables + ContextMenu)
///   - À droite : sidebar liste des champs avec hover preview + ContextMenu
///   - Popover annotation (création ou édition) ancré près du target/Rnd
///
/// La logique est répartie en hooks dédiés (`hooks/use-*`) pour rester < 400L
/// dans ce composant orchestrateur.
export function VisualPdfEditor({
  templateId,
  templateName,
  organismeName,
  sourceFileId,
  schema,
  onSchemaChange,
  presets = [],
}: VisualPdfEditorProps) {
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  /// Coords du dernier right-click sur le PDF (en PDF user-space) — utilisé par
  /// le ContextMenu "Ajouter zone vide ici".
  const lastRightClickPdfRef = useRef<{ x: number; y: number } | null>(null);

  // Hooks state
  const {
    pdfWorkerReady,
    numPages,
    currentPage,
    setCurrentPage,
    scale,
    setScale,
    pageDims,
    dims,
    pdfDocRef,
    handleDocumentLoadSuccess,
    handlePageLoadSuccess,
  } = usePdfDoc();
  const { clickTargets, targetsLoading } = useClickTargets(
    pdfDocRef,
    currentPage,
    numPages
  );
  const { corrections, appendOptimistic } = useOcrCorrections(templateId);
  const {
    selectedFieldId,
    setSelectedFieldId,
    hoveredFieldId,
    setHoveredFieldId,
    pulsingFieldId,
    selectFieldFromSidebar,
    multiSelectedIds,
    toggleMultiSelect,
    clearMultiSelect,
  } = useFieldSelection({
    schema,
    currentPage,
    setCurrentPage,
    scale,
    pageDims,
    containerRef,
  });

  // États locaux UI
  const [hoveredTargetId, setHoveredTargetId] = useState<string | null>(null);
  /// Mode "Aperçu rempli" : rend les Rnd avec des valeurs fictives (Lorem,
  /// dates, NISS valide, etc.) pour visualiser le rendu final sans exporter.
  const [previewMode, setPreviewMode] = useState(false);
  const [activeAnnotation, setActiveAnnotation] = useState<{
    target: ClickTarget;
    anchor: { left: number; top: number; right: number; bottom: number };
    editingField?: DocumentField;
  } | null>(null);

  /// Handler unifié pour le clic sur un Rnd : Shift+clic = toggle multi-select,
  /// clic simple = select primaire (et clear multi).
  function handleRndClick(
    id: string,
    e: React.MouseEvent | { shiftKey?: boolean }
  ) {
    if (e.shiftKey) {
      toggleMultiSelect(id);
      return;
    }
    clearMultiSelect();
    setSelectedFieldId(id);
  }

  /// Supprime le champ primaire + tous les multi-selected en un seul update.
  function removeFieldOrBatch(id: string) {
    if (multiSelectedIds.size > 0) {
      const toRemove = new Set(multiSelectedIds);
      toRemove.add(id);
      onSchemaChange(schema.filter((f) => !toRemove.has(f.id)));
      if (selectedFieldId && toRemove.has(selectedFieldId)) {
        setSelectedFieldId(null);
      }
      clearMultiSelect();
      return;
    }
    removeField(id);
  }

  // Raccourcis clavier (Del, Cmd+D, Cmd+E, flèches, Tab, Esc). Branché ici
  // pour avoir accès à toutes les actions du parent. Désactivé dans les Input.
  useKeyboardShortcuts({
    selectedFieldId,
    schema,
    currentPage,
    setSelectedFieldId: (id) => {
      // Esc clavier déselectionne aussi multi
      if (id === null) clearMultiSelect();
      setSelectedFieldId(id);
    },
    onRemove: (id) => removeFieldOrBatch(id),
    onDuplicate: (field) => duplicateField(field),
    onEdit: (field) => openEditPopover(field),
    onNudge: (id, dx, dy) => nudgeField(id, dx, dy),
  });

  const fieldsOnPage = schema.filter(
    (f) => f.position && f.position.page === currentPage
  );

  /// Vrai si un target est déjà couvert par un champ existant.
  const isTargetAnnotated = useCallback(
    (t: ClickTarget): boolean => {
      return fieldsOnPage.some((f) => {
        if (!f.position) return false;
        const dx = Math.abs(f.position.x - t.x);
        const dy = Math.abs(f.position.y - t.y);
        return dx < 10 && dy < 10;
      });
    },
    [fieldsOnPage]
  );

  // === Mutations sur le schema ===

  function updatePosition(
    id: string,
    htmlPos: { x: number; y: number; w: number; h: number }
  ) {
    if (!dims) return;
    const geo = toGeo(dims);
    const next = htmlToPdf(htmlPos, geo, scale);
    onSchemaChange(
      schema.map((f) =>
        f.id === id && f.position
          ? { ...f, position: { ...f.position, x: next.x, y: next.y, w: next.w, h: next.h } }
          : f
      )
    );
  }

  function removeField(id: string) {
    onSchemaChange(schema.filter((f) => f.id !== id));
    if (selectedFieldId === id) setSelectedFieldId(null);
  }

  function reorderSchema(orderedIds: string[]) {
    const byId = new Map(schema.map((f) => [f.id, f]));
    const reordered = orderedIds
      .map((id) => byId.get(id))
      .filter((f): f is DocumentField => !!f);
    for (const f of schema) {
      if (!orderedIds.includes(f.id)) reordered.push(f);
    }
    onSchemaChange(reordered);
  }

  function addFromLibrary(preset: CanonicalFieldPreset) {
    if (!dims) return;
    const id = `field_${nanoid(6)}`;
    const w = preset.defaultWidth ?? 150;
    const h = preset.defaultHeight ?? 14;
    const x = Math.max(10, dims.width / 2 - w / 2);
    const y = Math.max(10, dims.height / 2 - h / 2);
    let options: DocumentField["options"] | undefined;
    if (preset.fieldType === "select" && Array.isArray(preset.defaultOptions)) {
      options = (preset.defaultOptions as { value: string; label: string }[])
        .filter((o) => o && typeof o.value === "string" && typeof o.label === "string")
        .map((o) => ({ value: o.value, label: o.label }));
    }
    const newField: DocumentField = {
      id,
      label: preset.defaultLabel ?? preset.name,
      type: preset.fieldType as DocumentFieldType,
      required: false,
      presetId: preset.id,
      ...(preset.helpText ? { helpText: preset.helpText } : {}),
      ...(preset.placeholder ? { placeholder: preset.placeholder } : {}),
      ...(preset.defaultValue ? { defaultValue: preset.defaultValue } : {}),
      ...(options ? { options } : {}),
      position: {
        page: currentPage,
        x,
        y,
        w,
        h,
        fontSize: 11,
      },
    };
    onSchemaChange([...schema, newField]);
    setSelectedFieldId(id);
    toast.success(`« ${preset.defaultLabel ?? preset.name} » ajouté(e)`);
  }

  function duplicateField(field: DocumentField) {
    if (!field.position) return;
    const id = `field_${nanoid(6)}`;
    const dup: DocumentField = {
      ...field,
      id,
      label: `${field.label} (copie)`,
      position: {
        ...field.position,
        x: field.position.x + 10,
        y: field.position.y - 10,
      },
    };
    onSchemaChange([...schema, dup]);
    setSelectedFieldId(id);
    toast.success(`« ${field.label} » dupliqué(e)`);
  }

  /// Décale un champ par delta en points PDF (utilisé par les flèches clavier).
  /// Clamp aux dimensions de la page courante pour ne pas faire sortir le champ.
  function nudgeField(id: string, dx: number, dy: number) {
    if (!dims) return;
    onSchemaChange(
      schema.map((f) => {
        if (f.id !== id || !f.position) return f;
        const newX = Math.max(0, Math.min(dims.width - f.position.w, f.position.x + dx));
        const newY = Math.max(0, Math.min(dims.height - f.position.h, f.position.y + dy));
        return { ...f, position: { ...f.position, x: newX, y: newY } };
      })
    );
  }

  function addZoneAtPdfCoords(pdfX: number, pdfY: number) {
    if (!dims) return;
    const w = 150;
    const h = 14;
    const x = Math.max(0, Math.min(dims.width - w, pdfX - w / 2));
    const y = Math.max(0, Math.min(dims.height - h, pdfY - h / 2));
    const id = `field_${nanoid(6)}`;
    const newField: DocumentField = {
      id,
      label: "Nouveau champ",
      type: "text",
      required: false,
      position: { page: currentPage, x, y, w, h, fontSize: 11 },
    };
    onSchemaChange([...schema, newField]);
    setSelectedFieldId(id);
  }

  // === Popover (création + édition) ===

  function handleTargetClick(
    target: ClickTarget,
    e: React.MouseEvent<HTMLButtonElement>
  ) {
    const rect = e.currentTarget.getBoundingClientRect();
    setActiveAnnotation({
      target,
      anchor: {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
      },
    });
  }

  function handleAnnotationSave(field: Omit<DocumentField, "id">) {
    if (!activeAnnotation) return;
    const id = `field_${nanoid(6)}`;
    const newField: DocumentField = {
      ...field,
      id,
      position: field.position
        ? { ...field.position, page: currentPage }
        : undefined,
    };
    onSchemaChange([...schema, newField]);
    setSelectedFieldId(id);
    setActiveAnnotation(null);
    toast.success(
      `« ${field.label} » ajouté${field.presetId ? " (preset rattaché)" : ""}`
    );
    if (field.label && activeAnnotation.target.nearbyLabel) {
      appendOptimistic({
        templateId,
        rawLabel: activeAnnotation.target.nearbyLabel,
        cleanLabel: field.label,
        fieldType: field.type,
        presetId: field.presetId ?? null,
      });
    }
  }

  function handleEditSave(fieldId: string, values: Omit<DocumentField, "id">) {
    onSchemaChange(
      schema.map((f) =>
        f.id === fieldId
          ? {
              ...f,
              label: values.label,
              type: values.type,
              required: values.required ?? f.required,
              presetId: values.presetId ?? undefined,
              helpText: values.helpText ?? undefined,
              internalNote: values.internalNote ?? undefined,
              ...(values.options ? { options: values.options } : {}),
            }
          : f
      )
    );
    setActiveAnnotation(null);
    toast.success(`« ${values.label} » modifié(e)`);
  }

  /// Calcule l'anchor (rect screen) d'un champ depuis sa position PDF.
  /// Stable même si le menu déclencheur est dans un portail Radix.
  function computeFieldAnchor(field: DocumentField) {
    if (!dims || !field.position) return null;
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return null;
    const html = pdfToHtml(
      { x: field.position.x, y: field.position.y, w: field.position.w, h: field.position.h },
      toGeo(dims),
      scale
    );
    return {
      left: containerRect.left + html.x,
      top: containerRect.top + html.y,
      right: containerRect.left + html.x + html.w,
      bottom: containerRect.top + html.y + html.h,
    };
  }

  function openEditPopover(field: DocumentField) {
    const anchor = computeFieldAnchor(field) ?? {
      left: 200,
      top: 200,
      right: 300,
      bottom: 220,
    };
    const syntheticTarget: ClickTarget = {
      id: `edit-${field.id}`,
      kind: "rect",
      x: field.position?.x ?? 0,
      y: field.position?.y ?? 0,
      w: field.position?.w ?? 100,
      h: field.position?.h ?? 14,
      text: field.label,
      nearbyLabel: field.label,
      suggestedType: field.type,
      suggestedPresetName: null,
    };
    setActiveAnnotation({
      target: syntheticTarget,
      anchor,
      editingField: field,
    });
  }

  // === ContextMenu PDF ===

  function handlePdfRightClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!dims) return;
    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    const screenX = e.clientX - rect.left + container.scrollLeft;
    const screenY = e.clientY - rect.top + container.scrollTop;
    // Clic ponctuel → on convertit via htmlToPdf en passant w=h=0 et on garde
    // (x, y+h) = (x, y) du résultat car h=0 ⇒ pdf.y représente déjà le point.
    const pdfPt = htmlToPdf({ x: screenX, y: screenY, w: 0, h: 0 }, toGeo(dims), scale);
    lastRightClickPdfRef.current = { x: pdfPt.x, y: pdfPt.y };
  }

  function handleAddZoneAtLastClick() {
    const c = lastRightClickPdfRef.current;
    if (c) addZoneAtPdfCoords(c.x, c.y);
  }

  function handleAnnotateAtLastClick() {
    const c = lastRightClickPdfRef.current;
    if (!c || !dims) return;
    const w = 150;
    const h = 14;
    const target: ClickTarget = {
      id: `manual-${Date.now()}`,
      kind: "rect",
      x: Math.max(0, c.x - w / 2),
      y: Math.max(0, c.y - h / 2),
      w,
      h,
      text: "",
      nearbyLabel: "",
      suggestedType: "text",
      suggestedPresetName: null,
    };
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;
    const html = pdfToHtml({ x: c.x, y: c.y, w: 0, h: 0 }, toGeo(dims), scale);
    const screenX = html.x + containerRect.left;
    const screenY = html.y + containerRect.top;
    setActiveAnnotation({
      target,
      anchor: {
        left: screenX,
        top: screenY,
        right: screenX + w * scale,
        bottom: screenY + h * scale,
      },
    });
  }

  // === Render ===

  if (!pdfWorkerReady) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 mr-2 animate-spin" />
        Chargement du moteur PDF…
      </div>
    );
  }

  return (
    <div className="flex gap-4 min-w-0">
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <Alert className="py-2">
          <AlertDescription className="text-xs">
            Cliquez sur un élément du PDF (ligne pointillée, case, zone vide) pour
            le transformer en champ. Pour une zone hors texte, utilisez{" "}
            <b>Zone vide</b> ou la <b>Bibliothèque</b> à droite.
          </AlertDescription>
        </Alert>

        <PdfToolbar
          currentPage={currentPage}
          numPages={numPages}
          scale={scale}
          targetsLoading={targetsLoading}
          previewMode={previewMode}
          onTogglePreview={() => setPreviewMode((v) => !v)}
          onPrev={() => setCurrentPage(Math.max(0, currentPage - 1))}
          onNext={() => setCurrentPage(Math.min(numPages - 1, currentPage + 1))}
          onZoomIn={() => setScale(Math.min(3, scale + 0.1))}
          onZoomOut={() => setScale(Math.max(0.5, scale - 0.1))}
        />

        <PdfCanvas
          sourceFileId={sourceFileId}
          currentPage={currentPage}
          scale={scale}
          dims={dims}
          containerRef={containerRef}
          onDocumentLoadSuccess={handleDocumentLoadSuccess}
          onPageLoadSuccess={handlePageLoadSuccess}
          clickTargets={clickTargets}
          hoveredTargetId={hoveredTargetId}
          activeAnnotationTargetId={activeAnnotation?.target.id ?? null}
          isTargetAnnotated={isTargetAnnotated}
          onHoverTarget={setHoveredTargetId}
          onClickTarget={handleTargetClick}
          fieldsOnPage={fieldsOnPage}
          selectedFieldId={selectedFieldId}
          multiSelectedIds={multiSelectedIds}
          hoveredFieldId={hoveredFieldId}
          pulsingFieldId={pulsingFieldId}
          onSelectField={handleRndClick}
          onUpdatePosition={updatePosition}
          onEditField={openEditPopover}
          onDuplicateField={duplicateField}
          onRemoveField={removeField}
          onPdfRightClick={handlePdfRightClick}
          onAddZoneAtLastClick={handleAddZoneAtLastClick}
          onAnnotateAtLastClick={handleAnnotateAtLastClick}
          previewMode={previewMode}
        />
      </div>

      <div className="flex flex-col gap-3 flex-shrink-0">
        <PdfMiniMap
          dims={dims}
          fieldsOnPage={fieldsOnPage}
          selectedFieldId={selectedFieldId}
          scale={scale}
          containerRef={containerRef}
        />
        <AnnotatedFieldsSidebar
          schema={schema}
          currentPage={currentPage}
          selectedFieldId={selectedFieldId}
          presets={presets}
          onSelectField={selectFieldFromSidebar}
          onHoverField={setHoveredFieldId}
          onRemoveField={removeField}
          onReorder={reorderSchema}
          onAddFromLibrary={addFromLibrary}
          onEditField={openEditPopover}
          onDuplicateField={duplicateField}
          placementDisabled={!dims}
        />
      </div>

      {activeAnnotation && (
        <AnnotationPopover
          target={activeAnnotation.target}
          editingField={activeAnnotation.editingField}
          anchor={activeAnnotation.anchor}
          templateId={templateId}
          templateName={templateName ?? "Document"}
          organismeName={organismeName ?? null}
          presets={presets}
          corrections={corrections}
          onCancel={() => setActiveAnnotation(null)}
          onSave={(values) => {
            if (activeAnnotation.editingField) {
              handleEditSave(activeAnnotation.editingField.id, values);
            } else {
              handleAnnotationSave(values);
            }
          }}
        />
      )}
    </div>
  );
}

interface PdfToolbarProps {
  currentPage: number;
  numPages: number;
  scale: number;
  targetsLoading: boolean;
  previewMode: boolean;
  onTogglePreview: () => void;
  onPrev: () => void;
  onNext: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

function PdfToolbar({
  currentPage,
  numPages,
  scale,
  targetsLoading,
  previewMode,
  onTogglePreview,
  onPrev,
  onNext,
  onZoomIn,
  onZoomOut,
}: PdfToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-2 px-1">
      <div className="flex items-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          onClick={onPrev}
          disabled={currentPage === 0}
          title="Page précédente"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-xs text-muted-foreground tabular-nums">
          Page {currentPage + 1} / {numPages || "?"}
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          onClick={onNext}
          disabled={currentPage >= numPages - 1}
          title="Page suivante"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <div className="flex items-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          onClick={onZoomOut}
          title="Zoom -"
        >
          <ZoomOut className="size-4" />
        </Button>
        <span className="text-xs text-muted-foreground tabular-nums w-12 text-center">
          {Math.round(scale * 100)}%
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          onClick={onZoomIn}
          title="Zoom +"
        >
          <ZoomIn className="size-4" />
        </Button>
        {targetsLoading && (
          <span className="text-[10px] text-muted-foreground ml-2 inline-flex items-center gap-1">
            <Loader2 className="size-3 animate-spin" />
            analyse…
          </span>
        )}
        <Button
          size="sm"
          variant={previewMode ? "default" : "outline"}
          className="h-7 ml-2"
          onClick={onTogglePreview}
          title="Affiche les champs avec des valeurs fictives pour visualiser le rendu final"
        >
          {previewMode ? (
            <>
              <EyeOff className="size-3.5 mr-1" />
              Quitter aperçu
            </>
          ) : (
            <>
              <Eye className="size-3.5 mr-1" />
              Aperçu rempli
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
