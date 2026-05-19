"use client";

import { createElement, useMemo, useState } from "react";
import {
  Trash2,
  GripVertical,
  Pencil,
  Copy,
  Search,
  AlertCircle,
  Rows3,
  StickyNote,
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
import { Input } from "@/components/ui/input";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { LucideIcon } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  FieldLibraryPicker,
  type CanonicalFieldPreset,
} from "./field-library-picker";
import type { DocumentField } from "@/lib/documents/types";

const TYPE_ICONS: Record<string, LucideIcon> = {
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

const TYPE_COLORS: Record<string, string> = {
  text: "text-blue-600 dark:text-blue-400",
  textarea: "text-blue-600 dark:text-blue-400",
  number: "text-emerald-600 dark:text-emerald-400",
  date: "text-violet-600 dark:text-violet-400",
  checkbox: "text-amber-600 dark:text-amber-400",
  select: "text-amber-600 dark:text-amber-400",
  niss: "text-rose-600 dark:text-rose-400",
  iban: "text-emerald-600 dark:text-emerald-400",
  postal_be: "text-sky-600 dark:text-sky-400",
  tva_be: "text-slate-600 dark:text-slate-400",
  bce: "text-slate-600 dark:text-slate-400",
  phone_be: "text-sky-600 dark:text-sky-400",
  signature: "text-rose-600 dark:text-rose-400",
};

function typeIcon(t: string): LucideIcon {
  return TYPE_ICONS[t] ?? HelpCircle;
}

interface Props {
  schema: DocumentField[];
  selectedFieldId: string | null;
  /// La page actuellement affichée — pour pouvoir afficher un badge "autre page".
  currentPage: number;
  presets: CanonicalFieldPreset[];
  onSelectField: (id: string | null) => void;
  /// Quand l'admin survole un row, on prévient le parent pour afficher un halo
  /// discret sur le Rnd correspondant dans le PDF (preview sans cliquer).
  onHoverField: (id: string | null) => void;
  onRemoveField: (id: string) => void;
  onReorder: (orderedIds: string[]) => void;
  onAddFromLibrary: (preset: CanonicalFieldPreset) => void;
  /// Ouvre le popover en mode édition pour un champ existant. Le caller
  /// calcule la position du popover depuis la position du champ sur le PDF.
  onEditField: (field: DocumentField) => void;
  /// Duplique un champ existant (copie + décalage).
  onDuplicateField: (field: DocumentField) => void;
  /// Désactive les actions de placement (pendant le chargement du PDF).
  placementDisabled: boolean;
}

export function AnnotatedFieldsSidebar({
  schema,
  selectedFieldId,
  currentPage,
  presets,
  onSelectField,
  onHoverField,
  onRemoveField,
  onReorder,
  onAddFromLibrary,
  onEditField,
  onDuplicateField,
  placementDisabled,
}: Props) {
  const [filter, setFilter] = useState<"all" | "current" | "issues">("all");
  const [search, setSearch] = useState("");
  const [groupBySection, setGroupBySection] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  /// Filtre actif + recherche texte. La recherche prend le pas sur le filtre
  /// pour pouvoir rechercher dans tout le doc même si on est sur "Page actuelle".
  const visibleFields = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = schema;
    if (filter === "current" && !q) {
      list = list.filter((f) => f.position?.page === currentPage);
    } else if (filter === "issues") {
      list = list.filter((f) => fieldQualityIssues(f).length > 0);
    }
    if (q) {
      list = list.filter((f) => {
        const hay = `${f.label} ${f.type} ${f.presetId ?? ""}`.toLowerCase();
        return hay.includes(q);
      });
    }
    return list;
  }, [schema, filter, currentPage, search]);

  const fieldsOnOtherPage = useMemo(
    () =>
      schema.filter((f) => f.position && f.position.page !== currentPage).length,
    [schema, currentPage]
  );

  /// Groupe les champs visibles par bande Y (haut/milieu/bas) en supposant
  /// une page A4 portrait (842pt). Sert au mode "Grouper par section" qui
  /// rend la lecture plus simple sur les longs templates.
  const grouped = useMemo(() => {
    if (!groupBySection) return null;
    const top: DocumentField[] = [];
    const middle: DocumentField[] = [];
    const bottom: DocumentField[] = [];
    const orphan: DocumentField[] = [];
    for (const f of visibleFields) {
      if (!f.position) {
        orphan.push(f);
        continue;
      }
      if (f.position.y > 500) top.push(f);
      else if (f.position.y > 200) middle.push(f);
      else bottom.push(f);
    }
    return { top, middle, bottom, orphan };
  }, [visibleFields, groupBySection]);

  /// Compteur de qualité : nombre de champs sans aucun problème vs total.
  const qualityStats = useMemo(() => {
    let ready = 0;
    let withIssues = 0;
    for (const f of schema) {
      const issues = fieldQualityIssues(f);
      if (issues.length === 0) ready++;
      else withIssues++;
    }
    return { ready, withIssues, total: schema.length };
  }, [schema]);

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = schema.findIndex((f) => f.id === active.id);
    const newIdx = schema.findIndex((f) => f.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(schema, oldIdx, newIdx);
    onReorder(reordered.map((f) => f.id));
  }

  const countCurrent = schema.filter((f) => f.position?.page === currentPage).length;

  return (
    <aside className="w-[320px] flex-shrink-0 flex flex-col rounded-xl border border-border bg-card/40 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2.5 border-b space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            Champs
            <span className="text-muted-foreground font-normal">
              ({qualityStats.ready}/{qualityStats.total} prêts)
            </span>
          </h3>
          <button
            type="button"
            onClick={() => setGroupBySection((v) => !v)}
            title={
              groupBySection
                ? "Désactiver le groupage par section"
                : "Grouper les champs par section (haut/milieu/bas de page)"
            }
            className={`p-1 rounded transition-colors ${
              groupBySection
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Rows3 className="size-3.5" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher dans les champs…"
            className="pl-8 h-7 text-xs"
          />
        </div>

        {/* Filter pills */}
        <div className="flex gap-1 flex-wrap">
          <FilterPill
            active={filter === "all"}
            onClick={() => setFilter("all")}
            label={`Tous · ${schema.length}`}
          />
          <FilterPill
            active={filter === "current"}
            onClick={() => setFilter("current")}
            label={`Page actuelle · ${countCurrent}`}
          />
          {qualityStats.withIssues > 0 && (
            <FilterPill
              active={filter === "issues"}
              onClick={() => setFilter("issues")}
              label={
                <span className="inline-flex items-center gap-1">
                  <AlertCircle className="size-3" />
                  Problèmes · {qualityStats.withIssues}
                </span>
              }
              variant="warning"
            />
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2">
        {visibleFields.length === 0 ? (
          <div className="text-center py-12 px-4 space-y-2">
            <p className="text-xs text-muted-foreground">
              {filter === "current"
                ? "Aucun champ sur cette page."
                : "Aucun champ encore. Cliquez sur un élément du PDF pour le transformer en champ."}
            </p>
            {filter === "current" && fieldsOnOtherPage > 0 && (
              <button
                type="button"
                onClick={() => setFilter("all")}
                className="text-[11px] text-primary hover:underline"
              >
                Voir les {fieldsOnOtherPage} champs des autres pages
              </button>
            )}
          </div>
        ) : grouped ? (
          // Mode groupé par section (haut/milieu/bas)
          <div className="space-y-3">
            {grouped.top.length > 0 && (
              <SectionGroup
                title="Haut de page"
                fields={grouped.top}
                selectedFieldId={selectedFieldId}
                currentPage={currentPage}
                onSelectField={onSelectField}
                onHoverField={onHoverField}
                onRemoveField={onRemoveField}
                onEditField={onEditField}
                onDuplicateField={onDuplicateField}
              />
            )}
            {grouped.middle.length > 0 && (
              <SectionGroup
                title="Milieu"
                fields={grouped.middle}
                selectedFieldId={selectedFieldId}
                currentPage={currentPage}
                onSelectField={onSelectField}
                onHoverField={onHoverField}
                onRemoveField={onRemoveField}
                onEditField={onEditField}
                onDuplicateField={onDuplicateField}
              />
            )}
            {grouped.bottom.length > 0 && (
              <SectionGroup
                title="Bas de page"
                fields={grouped.bottom}
                selectedFieldId={selectedFieldId}
                currentPage={currentPage}
                onSelectField={onSelectField}
                onHoverField={onHoverField}
                onRemoveField={onRemoveField}
                onEditField={onEditField}
                onDuplicateField={onDuplicateField}
              />
            )}
            {grouped.orphan.length > 0 && (
              <SectionGroup
                title="Sans position"
                fields={grouped.orphan}
                selectedFieldId={selectedFieldId}
                currentPage={currentPage}
                onSelectField={onSelectField}
                onHoverField={onHoverField}
                onRemoveField={onRemoveField}
                onEditField={onEditField}
                onDuplicateField={onDuplicateField}
              />
            )}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={visibleFields.map((f) => f.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="space-y-1">
                {visibleFields.map((f) => (
                  <FieldRow
                    key={f.id}
                    field={f}
                    selected={f.id === selectedFieldId}
                    onPage={f.position?.page === currentPage}
                    onSelect={() => onSelectField(f.id)}
                    onHover={(hovering) => onHoverField(hovering ? f.id : null)}
                    onRemove={() => onRemoveField(f.id)}
                    onEdit={() => onEditField(f)}
                    onDuplicate={() => onDuplicateField(f)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Footer actions */}
      <div className="border-t p-2 flex items-center gap-1.5 flex-wrap">
        <FieldLibraryPicker
          presets={presets}
          onPick={onAddFromLibrary}
          disabled={placementDisabled}
        />
        <p className="text-[10px] text-muted-foreground ml-1 leading-tight">
          Clic droit sur le PDF pour
          <br />
          ajouter une zone vide
        </p>
      </div>
    </aside>
  );
}

interface SectionGroupProps {
  title: string;
  fields: DocumentField[];
  selectedFieldId: string | null;
  currentPage: number;
  onSelectField: (id: string | null) => void;
  onHoverField: (id: string | null) => void;
  onRemoveField: (id: string) => void;
  onEditField: (field: DocumentField) => void;
  onDuplicateField: (field: DocumentField) => void;
}

/// Section de la sidebar avec son titre + liste de champs. Pas de drag-drop
/// inter-sections (les champs sont logés par leur position Y de toute façon).
function SectionGroup({
  title,
  fields,
  selectedFieldId,
  currentPage,
  onSelectField,
  onHoverField,
  onRemoveField,
  onEditField,
  onDuplicateField,
}: SectionGroupProps) {
  return (
    <div>
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-1 flex items-center gap-1.5">
        <span>{title}</span>
        <span className="text-muted-foreground/60">· {fields.length}</span>
      </div>
      <ul className="space-y-1">
        {fields.map((f) => (
          <FieldRow
            key={f.id}
            field={f}
            selected={f.id === selectedFieldId}
            onPage={f.position?.page === currentPage}
            onSelect={() => onSelectField(f.id)}
            onHover={(hovering) => onHoverField(hovering ? f.id : null)}
            onRemove={() => onRemoveField(f.id)}
            onEdit={() => onEditField(f)}
            onDuplicate={() => onDuplicateField(f)}
          />
        ))}
      </ul>
    </div>
  );
}

/// Calcule les problèmes "qualité" d'un champ — utilisé pour les badges et
/// pour le filtre "Problèmes" dans la sidebar.
///
/// On reste minimaliste : les vrais problèmes bloquants à la sauvegarde sont
/// déjà gérés ailleurs (duplicate IDs). Ici on signale juste les "à finir" :
///   - pas de label significatif
///   - pas de position sur la page (rare, mais possible si edit raté)
///   - pas de preset (juste un info, pas un blocker)
function fieldQualityIssues(field: DocumentField): string[] {
  const issues: string[] = [];
  if (!field.label?.trim() || field.label === "Nouveau champ") {
    issues.push("sans label");
  }
  if (!field.position) {
    issues.push("sans position");
  }
  return issues;
}

interface FilterPillProps {
  active: boolean;
  onClick: () => void;
  label: React.ReactNode;
  variant?: "default" | "warning";
}

function FilterPill({ active, onClick, label, variant = "default" }: FilterPillProps) {
  const activeClass =
    variant === "warning"
      ? "bg-amber-500 text-white"
      : "bg-primary text-primary-foreground";
  const inactiveClass =
    variant === "warning"
      ? "bg-amber-100 hover:bg-amber-200 text-amber-700 dark:bg-amber-950 dark:hover:bg-amber-900 dark:text-amber-300"
      : "bg-muted hover:bg-muted/80 text-muted-foreground";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-0.5 text-[10px] rounded-full transition-colors ${
        active ? activeClass : inactiveClass
      }`}
    >
      {label}
    </button>
  );
}

interface FieldRowProps {
  field: DocumentField;
  selected: boolean;
  onPage: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onHover: (hovering: boolean) => void;
}

function FieldRow({
  field,
  selected,
  onPage,
  onSelect,
  onHover,
  onRemove,
  onEdit,
  onDuplicate,
}: FieldRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const colorClass = TYPE_COLORS[field.type] ?? "text-muted-foreground";
  const issues = fieldQualityIssues(field);

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <li
          ref={setNodeRef}
          style={style}
          className={`group flex items-center gap-1 rounded-md border transition-colors cursor-pointer ${
            selected
              ? "border-primary bg-primary/10"
              : "border-transparent hover:border-border hover:bg-muted/50"
          } ${!onPage ? "opacity-60" : ""}`}
          onClick={onSelect}
          onDoubleClick={onEdit}
          onMouseEnter={() => onHover(true)}
          onMouseLeave={() => onHover(false)}
          title="Clic droit pour les actions, double-clic pour modifier"
        >
          {/* Drag handle */}
          <button
            type="button"
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            className="cursor-grab active:cursor-grabbing px-1 py-2 text-muted-foreground hover:text-foreground"
            title="Réordonner"
          >
            <GripVertical className="size-3.5" />
          </button>

          {/* Icon */}
          <span
            className={`inline-flex items-center justify-center size-7 rounded ${colorClass} flex-shrink-0`}
          >
            {createElement(typeIcon(field.type), { className: "size-4" })}
          </span>

          {/* Label + meta */}
          <div className="flex-1 min-w-0 py-1.5 pr-2">
            <div className="text-xs font-medium truncate">
              {field.label || (
                <span className="italic text-muted-foreground">sans label</span>
              )}
            </div>
            <div className="text-[10px] text-muted-foreground flex items-center gap-1 flex-wrap">
              <span>{field.type}</span>
              {field.position && (
                <>
                  <span>·</span>
                  <span>p{field.position.page + 1}</span>
                </>
              )}
              {field.presetId && (
                <>
                  <span>·</span>
                  <Pencil className="size-2.5" />
                </>
              )}
              {field.internalNote && (
                <>
                  <span>·</span>
                  <StickyNote
                    className="size-2.5 text-amber-600 dark:text-amber-400"
                    aria-label={`Note interne : ${field.internalNote}`}
                  />
                </>
              )}
              {issues.length > 0 && (
                <span
                  className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-medium"
                  title={issues.join(", ")}
                >
                  <AlertCircle className="size-2.5" />
                  {issues.length === 1 ? issues[0] : `${issues.length} pbs`}
                </span>
              )}
            </div>
          </div>
        </li>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuItem onClick={onEdit}>
          <Pencil className="size-4 mr-2" />
          Modifier
        </ContextMenuItem>
        <ContextMenuItem onClick={onDuplicate}>
          <Copy className="size-4 mr-2" />
          Dupliquer
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={onRemove}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="size-4 mr-2" />
          Supprimer
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
