"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FieldEditor } from "./field-editor";
import { PdfFormField, Locale } from "@/lib/pdf-forms/types";

interface PresetOpt { key: string; label: string }

/// Wrapper rendant un FieldEditor draggable via @dnd-kit/sortable.
/// La poignée (GripVertical) à l'intérieur de FieldEditor reçoit les listeners.
export function SortableField({
  field, locales, presets, allFields, onChange, onRemove,
}: {
  field: PdfFormField;
  locales: Locale[];
  presets: PresetOpt[];
  allFields: PdfFormField[];
  onChange: (next: PdfFormField) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <FieldEditor
        field={field}
        locales={locales}
        presets={presets}
        allFields={allFields}
        onChange={onChange}
        onRemove={onRemove}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}
