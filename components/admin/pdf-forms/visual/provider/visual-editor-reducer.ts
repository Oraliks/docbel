import type { Action, VisualEditorState } from "./visual-editor-types";
import { EMPTY_DOC } from "@/lib/pdf-forms/visual/types";

export const initialState: VisualEditorState = {
  doc: EMPTY_DOC,
  ui: { tool: "select", page: 0, scale: 1.3, selectedId: null },
  saveState: "idle",
  pageDims: {},
  serverUpdatedAt: null,
  serverMaterializedAt: null,
};

/// Reducer pur — toute mutation de `doc` passe par PATCH_FIELDS ce qui marque
/// automatiquement le state comme "dirty" (sauf si on est déjà en saving).
export function visualEditorReducer(state: VisualEditorState, action: Action): VisualEditorState {
  switch (action.type) {
    case "PATCH_FIELDS": {
      const nextFields = action.updater(state.doc.fields);
      if (nextFields === state.doc.fields) return state;
      return {
        ...state,
        doc: { ...state.doc, fields: nextFields },
        saveState: state.saveState === "saving" ? "saving" : "dirty",
      };
    }
    case "SET_UI":
      return { ...state, ui: { ...state.ui, ...action.patch } };
    case "SET_SAVE":
      return { ...state, saveState: action.state };
    case "REGISTER_PAGE_DIMS":
      if (state.pageDims[action.page]) {
        const prev = state.pageDims[action.page];
        const next = action.dims;
        if (prev.width === next.width && prev.height === next.height && prev.offsetX === next.offsetX && prev.offsetY === next.offsetY) {
          return state;
        }
      }
      return {
        ...state,
        pageDims: { ...state.pageDims, [action.page]: action.dims },
      };
    case "REPLACE_DOC":
      return {
        ...state,
        doc: action.doc,
        saveState: "saved",
        serverUpdatedAt: action.serverUpdatedAt ?? state.serverUpdatedAt,
        serverMaterializedAt:
          action.serverMaterializedAt !== undefined ? action.serverMaterializedAt : state.serverMaterializedAt,
      };
    default:
      return state;
  }
}
