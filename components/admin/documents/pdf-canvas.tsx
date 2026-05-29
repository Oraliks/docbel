"use client";

import { createElement } from "react";
import dynamic from "next/dynamic";
import { Rnd } from "react-rnd";
import {
  Pencil,
  Copy,
  Trash2,
  Plus,
  Type as TypeIcon,
  AlignLeft,
  Hash,
  Calendar,
  CheckSquare,
  ChevronDown,
  IdCard,
  CreditCard,
  MapPin,
  Building2,
  Phone,
  PenTool,
  HelpCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { DocumentField } from "@/lib/documents/types";
import type { ClickTarget } from "@/lib/documents/click-targets";
import { getPreviewValue } from "@/lib/documents/preview-values";
import { pdfToHtml, type PageGeometry } from "@/lib/pdf-canvas/coords";
import type { PageDims } from "./hooks/use-pdf-doc";

/// Adapter PageDims (front-only, sans CropBox offset) → PageGeometry pour
/// pouvoir réutiliser pdfToHtml. Côté Documents, pdfjs ne nous expose pas la
/// CropBox depuis le viewport → on suppose offsets = 0 (vrai sur la quasi-
/// totalité des PDF documents qui transitent dans Docbel).
function dimsToGeometry(dims: PageDims): PageGeometry {
  return { width: dims.width, height: dims.height, offsetX: 0, offsetY: 0 };
}

const PDFDocument = dynamic(() => import("react-pdf").then((m) => m.Document), {
  ssr: false,
});
const PDFPage = dynamic(() => import("react-pdf").then((m) => m.Page), {
  ssr: false,
});

const FIELD_TYPE_ICONS: Record<string, LucideIcon> = {
  text: TypeIcon,
  textarea: AlignLeft,
  number: Hash,
  date: Calendar,
  checkbox: CheckSquare,
  select: ChevronDown,
  niss: IdCard,
  iban: CreditCard,
  postal_be: MapPin,
  tva_be: Building2,
  bce: Building2,
  phone_be: Phone,
  signature: PenTool,
};

function getFieldTypeIcon(type: string): LucideIcon {
  return FIELD_TYPE_ICONS[type] ?? HelpCircle;
}

interface PdfCanvasProps {
  sourceFileId: string;
  currentPage: number;
  scale: number;
  dims: PageDims | undefined;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onDocumentLoadSuccess: (pdf: { numPages: number }) => void;
  onPageLoadSuccess: (page: { originalWidth: number; originalHeight: number }) => void;

  // Click targets (zones cliquables natives détectées dans le PDF)
  clickTargets: ClickTarget[];
  hoveredTargetId: string | null;
  activeAnnotationTargetId: string | null;
  isTargetAnnotated: (t: ClickTarget) => boolean;
  onHoverTarget: (id: string | null) => void;
  onClickTarget: (target: ClickTarget, e: React.MouseEvent<HTMLButtonElement>) => void;

  // Champs existants
  fieldsOnPage: DocumentField[];
  selectedFieldId: string | null;
  hoveredFieldId: string | null;
  pulsingFieldId: string | null;
  /// Set des champs co-sélectionnés via Shift+clic (pour batch delete).
  multiSelectedIds: Set<string>;
  /// Callback unifié pour le clic sur un Rnd : reçoit l'event pour pouvoir
  /// détecter Shift+clic (multi) vs clic simple (select primaire).
  onSelectField: (id: string, e: React.MouseEvent | { shiftKey?: boolean }) => void;
  onUpdatePosition: (
    id: string,
    htmlPos: { x: number; y: number; w: number; h: number }
  ) => void;
  onEditField: (field: DocumentField) => void;
  onDuplicateField: (field: DocumentField) => void;
  onRemoveField: (id: string) => void;

  // ContextMenu du PDF (clic droit sur zone vide)
  onPdfRightClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  onAddZoneAtLastClick: () => void;
  onAnnotateAtLastClick: () => void;

  /// Mode aperçu : les Rnd affichent une valeur fictive au lieu de l'icône type.
  previewMode: boolean;
}

export function PdfCanvas(props: PdfCanvasProps) {
  const {
    sourceFileId,
    currentPage,
    scale,
    dims,
    containerRef,
    onDocumentLoadSuccess,
    onPageLoadSuccess,
    clickTargets,
    hoveredTargetId,
    activeAnnotationTargetId,
    isTargetAnnotated,
    onHoverTarget,
    onClickTarget,
    fieldsOnPage,
    selectedFieldId,
    hoveredFieldId,
    pulsingFieldId,
    multiSelectedIds,
    onSelectField,
    onUpdatePosition,
    onEditField,
    onDuplicateField,
    onRemoveField,
    onPdfRightClick,
    onAddZoneAtLastClick,
    onAnnotateAtLastClick,
    previewMode,
  } = props;

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          ref={containerRef}
          onContextMenu={onPdfRightClick}
          className="relative inline-block border rounded-lg overflow-auto bg-muted/20 mx-auto"
          style={{ maxWidth: "100%" }}
        >
          <PDFDocument
            file={`/api/files/${sourceFileId}/download`}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div className="p-12 text-center text-sm text-muted-foreground">
                Chargement du PDF…
              </div>
            }
            error={
              <div className="p-12 text-center text-sm text-destructive">
                Erreur de chargement du PDF
              </div>
            }
          >
            <PDFPage
              pageNumber={currentPage + 1}
              scale={scale}
              onLoadSuccess={onPageLoadSuccess}
              renderAnnotationLayer={false}
              renderTextLayer={false}
            />

            {/* Overlay des click targets */}
            {dims &&
              clickTargets.map((t) => (
                <ClickTargetButton
                  key={t.id}
                  target={t}
                  dims={dims}
                  scale={scale}
                  isHovered={hoveredTargetId === t.id}
                  isActive={activeAnnotationTargetId === t.id}
                  isAnnotated={isTargetAnnotated(t)}
                  onHover={onHoverTarget}
                  onClick={onClickTarget}
                />
              ))}

            {/* Champs existants (draggables/resizables) */}
            {dims &&
              fieldsOnPage.map((f) => (
                <FieldRect
                  key={f.id}
                  field={f}
                  dims={dims}
                  scale={scale}
                  isSelected={selectedFieldId === f.id}
                  isMultiSelected={multiSelectedIds.has(f.id)}
                  isHovered={hoveredFieldId === f.id}
                  isPulsing={pulsingFieldId === f.id}
                  previewMode={previewMode}
                  onSelect={onSelectField}
                  onUpdatePosition={onUpdatePosition}
                  onEdit={onEditField}
                  onDuplicate={onDuplicateField}
                  onRemove={onRemoveField}
                />
              ))}
          </PDFDocument>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem onClick={onAddZoneAtLastClick}>
          <Plus className="size-4 mr-2" />
          Ajouter une zone vide ici
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onAnnotateAtLastClick}>
          <Pencil className="size-4 mr-2" />
          Annoter une zone ici…
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

interface ClickTargetButtonProps {
  target: ClickTarget;
  dims: PageDims;
  scale: number;
  isHovered: boolean;
  isActive: boolean;
  isAnnotated: boolean;
  onHover: (id: string | null) => void;
  onClick: (target: ClickTarget, e: React.MouseEvent<HTMLButtonElement>) => void;
}

function ClickTargetButton({
  target,
  dims,
  scale,
  isHovered,
  isActive,
  isAnnotated,
  onHover,
  onClick,
}: ClickTargetButtonProps) {
  const html = pdfToHtml(
    { x: target.x, y: target.y, w: target.w, h: target.h },
    dimsToGeometry(dims),
    scale
  );
  const htmlX = html.x;
  const htmlY = html.y;
  const htmlW = Math.max(8, html.w);
  const htmlH = Math.max(8, html.h);
  return (
    <button
      type="button"
      onMouseEnter={() => onHover(target.id)}
      onMouseLeave={() => onHover(null)}
      onClick={(e) => onClick(target, e)}
      title={
        target.nearbyLabel
          ? `Cliquer pour annoter : ${target.nearbyLabel}`
          : `Cliquer pour annoter (${target.kind})`
      }
      style={{
        position: "absolute",
        left: htmlX,
        top: htmlY,
        width: htmlW,
        height: htmlH,
      }}
      className={`transition-all duration-100 rounded-sm pointer-events-auto cursor-pointer ${
        isAnnotated
          ? "border-2 border-blue-400/40 bg-blue-200/10"
          : isActive
          ? "border-2 border-primary bg-primary/15 ring-2 ring-primary/30"
          : isHovered
          ? "border-2 border-blue-500 bg-blue-200/30 shadow-sm"
          : "border border-dashed border-blue-300/0 hover:border-blue-300/70 bg-transparent hover:bg-blue-100/10"
      }`}
    />
  );
}

interface FieldRectProps {
  field: DocumentField;
  dims: PageDims;
  scale: number;
  isSelected: boolean;
  isMultiSelected: boolean;
  isHovered: boolean;
  isPulsing: boolean;
  previewMode: boolean;
  onSelect: (id: string, e: React.MouseEvent | { shiftKey?: boolean }) => void;
  onUpdatePosition: (
    id: string,
    htmlPos: { x: number; y: number; w: number; h: number }
  ) => void;
  onEdit: (field: DocumentField) => void;
  onDuplicate: (field: DocumentField) => void;
  onRemove: (id: string) => void;
}

function FieldRect({
  field,
  dims,
  scale,
  isSelected,
  isMultiSelected,
  isHovered,
  isPulsing,
  previewMode,
  onSelect,
  onUpdatePosition,
  onEdit,
  onDuplicate,
  onRemove,
}: FieldRectProps) {
  if (!field.position) return null;
  const html = pdfToHtml(
    { x: field.position.x, y: field.position.y, w: field.position.w, h: field.position.h },
    dimsToGeometry(dims),
    scale
  );
  const htmlX = html.x;
  const htmlY = html.y;
  const htmlW = html.w;
  const htmlH = html.h;
  // Violet primary si pulse (depuis sidebar), bleu sinon
  const accent = isPulsing ? "139, 92, 246" : "37, 99, 235";

  // Le ContextMenu DOIT être à l'intérieur du Rnd : sinon le wrapper
  // ContextMenuTrigger (div en flow normal) fausse le calcul
  // `offsetFromParent` de react-rnd (cf. updateOffsetFromParent dans la lib :
  // il prend `this.resizable.parentNode` comme référence). Le wrapper se
  // retrouvant après la <Page> dans le flow, l'offset ajouté = hauteur de la
  // page → tous les champs sont rendus 1× page sous leur position correcte.
  return (
    <Rnd
      bounds="parent"
      position={{ x: htmlX, y: htmlY }}
      size={{ width: htmlW, height: htmlH }}
      onDragStop={(_, p) =>
        onUpdatePosition(field.id, { x: p.x, y: p.y, w: htmlW, h: htmlH })
      }
      onResizeStop={(_e, _dir, ref, _delta, position) =>
        onUpdatePosition(field.id, {
          x: position.x,
          y: position.y,
          w: ref.offsetWidth,
          h: ref.offsetHeight,
        })
      }
      onClick={(e: React.MouseEvent) => onSelect(field.id, e)}
      style={{
        border: `2px ${isMultiSelected ? "dashed" : "solid"} ${
          isSelected || isPulsing || isMultiSelected
            ? `rgb(${accent})`
            : `rgba(${accent}, 0.6)`
        }`,
        background:
          isSelected || isPulsing || isMultiSelected
            ? `rgba(${accent}, 0.18)`
            : `rgba(${accent}, 0.08)`,
        borderRadius: 4,
        pointerEvents: "auto",
        boxShadow: isHovered
          ? `0 0 0 3px rgba(139, 92, 246, 0.25)`
          : isPulsing
          ? `0 0 0 6px rgba(139, 92, 246, 0.18)`
          : undefined,
        transition: "box-shadow 200ms, border-color 200ms",
      }}
    >
      <ContextMenu>
        <ContextMenuTrigger
          className={`flex items-center justify-center w-full h-full overflow-hidden ${
            isPulsing
              ? "text-violet-700 dark:text-violet-300"
              : "text-blue-700 dark:text-blue-300"
          }`}
          title={`${field.label} — clic droit pour actions`}
        >
          {previewMode ? (
            <span
              className="text-[10px] truncate px-1 text-foreground font-medium"
              style={{
                fontSize: Math.max(8, Math.min(14, scale * 10)),
              }}
            >
              {getPreviewValue(field)}
            </span>
          ) : (
            createElement(getFieldTypeIcon(field.type), { className: "size-3.5" })
          )}
        </ContextMenuTrigger>
        <ContextMenuContent className="w-52">
          <ContextMenuItem onClick={() => onEdit(field)}>
            <Pencil className="size-4 mr-2" />
            Modifier
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onDuplicate(field)}>
            <Copy className="size-4 mr-2" />
            Dupliquer
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => onRemove(field.id)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="size-4 mr-2" />
            Supprimer
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </Rnd>
  );
}
