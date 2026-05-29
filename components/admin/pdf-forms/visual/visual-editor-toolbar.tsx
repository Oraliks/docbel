"use client";

import {
  MousePointer2Icon,
  TypeIcon,
  CheckSquareIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ZoomInIcon,
  ZoomOutIcon,
  SaveIcon,
  Loader2Icon,
  CheckIcon,
  AlertCircleIcon,
  WandSparklesIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useVisualEditor } from "./provider/visual-editor-context";

interface ToolbarProps {
  numPages: number;
  onMaterialize: () => void;
  hasRotatedPages: boolean;
  sourceHasAcroForm: boolean;
}

const TOOLS = [
  { value: "select" as const, label: "Sélection", Icon: MousePointer2Icon, shortcut: "V" },
  { value: "text" as const, label: "Texte", Icon: TypeIcon, shortcut: "T" },
  { value: "checkbox" as const, label: "Case à cocher", Icon: CheckSquareIcon, shortcut: "C" },
];

export function VisualEditorToolbar({ numPages, onMaterialize, hasRotatedPages, sourceHasAcroForm }: ToolbarProps) {
  const { ui, setTool, setPage, setScale, save, doc, isReadOnlyMode, saveState } = useVisualEditor();

  const blockMaterialize = sourceHasAcroForm || hasRotatedPages || doc.fields.length === 0 || saveState === "dirty" || saveState === "saving";

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-background p-2">
      {/* Palette d'outils */}
      <div className="flex items-center rounded border p-0.5">
        {TOOLS.map(({ value, label, Icon, shortcut }) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={ui.tool === value ? "default" : "ghost"}
            onClick={() => setTool(value)}
            disabled={isReadOnlyMode}
            className="h-7 px-2"
            title={`${label} (${shortcut})`}
          >
            <Icon className="size-4" />
            <span className="ml-1 hidden lg:inline">{label}</span>
          </Button>
        ))}
      </div>

      <div className="mx-1 h-6 w-px bg-border" />

      {/* Navigation pages */}
      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7"
          onClick={() => setPage(Math.max(0, ui.page - 1))}
          disabled={ui.page <= 0}
          aria-label="Page précédente"
        >
          <ChevronLeftIcon className="size-4" />
        </Button>
        <span className="min-w-16 text-center text-xs text-muted-foreground tabular-nums">
          Page {ui.page + 1} / {numPages || "?"}
        </span>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7"
          onClick={() => setPage(Math.min(numPages - 1, ui.page + 1))}
          disabled={ui.page >= numPages - 1}
          aria-label="Page suivante"
        >
          <ChevronRightIcon className="size-4" />
        </Button>
      </div>

      <div className="mx-1 h-6 w-px bg-border" />

      {/* Zoom */}
      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7"
          onClick={() => setScale(Math.max(0.5, ui.scale - 0.1))}
          disabled={ui.scale <= 0.5}
          aria-label="Dézoomer"
        >
          <ZoomOutIcon className="size-4" />
        </Button>
        <span className="min-w-12 text-center text-xs text-muted-foreground tabular-nums">{Math.round(ui.scale * 100)}%</span>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7"
          onClick={() => setScale(Math.min(3, ui.scale + 0.1))}
          disabled={ui.scale >= 3}
          aria-label="Zoomer"
        >
          <ZoomInIcon className="size-4" />
        </Button>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <SaveBadge state={saveState} fieldCount={doc.fields.length} />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={save}
          disabled={isReadOnlyMode || saveState === "saving" || saveState === "saved"}
        >
          {saveState === "saving" ? <Loader2Icon className="size-4 animate-spin" /> : <SaveIcon className="size-4" />}
          Enregistrer
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onMaterialize}
          disabled={isReadOnlyMode || blockMaterialize}
          title={
            sourceHasAcroForm
              ? "Désactivé : le PDF contient déjà un AcroForm."
              : hasRotatedPages
              ? "Désactivé : une page du PDF est pivotée."
              : doc.fields.length === 0
              ? "Aucun champ à matérialiser."
              : saveState === "dirty"
              ? "Enregistrez d'abord."
              : "Matérialise les champs dans le PDF source."
          }
        >
          <WandSparklesIcon className="size-4" />
          Appliquer au PDF
        </Button>
      </div>
    </div>
  );
}

function SaveBadge({ state, fieldCount }: { state: ReturnType<typeof useVisualEditor>["saveState"]; fieldCount: number }) {
  if (state === "saving") {
    return (
      <Badge variant="secondary" className="gap-1">
        <Loader2Icon className="size-3 animate-spin" /> Sauvegarde…
      </Badge>
    );
  }
  if (state === "dirty") {
    return (
      <Badge variant="outline" className="gap-1 text-amber-700 dark:text-amber-400">
        <AlertCircleIcon className="size-3" /> Modifications non sauvegardées
      </Badge>
    );
  }
  if (state === "error") {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertCircleIcon className="size-3" /> Erreur
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1">
      <CheckIcon className="size-3" /> {fieldCount} champ{fieldCount > 1 ? "s" : ""}
    </Badge>
  );
}
