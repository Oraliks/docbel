import type { VisualField, VisualFieldsDoc } from "@/lib/pdf-forms/visual/types";
import type { PageGeometry } from "@/lib/pdf-canvas/coords";

export type ToolName = "select" | "text" | "checkbox";

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export interface UiState {
  tool: ToolName;
  page: number;
  scale: number;
  selectedId: string | null;
}

export interface VisualEditorState {
  doc: VisualFieldsDoc;
  ui: UiState;
  saveState: SaveState;
  /// Géométrie PDF par page (clé = index 0-based) renseignée au chargement
  /// de chaque page côté react-pdf.
  pageDims: Record<number, PageGeometry>;
  /// Dernière valeur de `updatedAt` reçue (utilisée pour le header If-Match).
  serverUpdatedAt: string | null;
  /// Date de dernière matérialisation (ISO) lue du serveur.
  serverMaterializedAt: string | null;
}

export type Action =
  | { type: "PATCH_FIELDS"; updater: (fields: VisualField[]) => VisualField[] }
  | { type: "SET_UI"; patch: Partial<UiState> }
  | { type: "SET_SAVE"; state: SaveState }
  | { type: "REGISTER_PAGE_DIMS"; page: number; dims: PageGeometry }
  | {
      type: "REPLACE_DOC";
      doc: VisualFieldsDoc;
      serverUpdatedAt?: string | null;
      serverMaterializedAt?: string | null;
    };
