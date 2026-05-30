"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { nanoid } from "nanoid";
import { initialState, visualEditorReducer } from "./visual-editor-reducer";
import type { Action, SaveState, ToolName, UiState, VisualEditorState } from "./visual-editor-types";
import type { VisualField, VisualFieldsDoc } from "@/lib/pdf-forms/visual/types";
import { generateFieldName, validateVisualFieldsDoc } from "@/lib/pdf-forms/visual/validation";

interface ServerSnapshot {
  doc: VisualFieldsDoc;
  updatedAt: string;
  materializedAt: string | null;
  sourceHasAcroForm: boolean;
  hasRotatedPages: boolean;
  pageCount: number;
}

interface VisualEditorContextValue extends VisualEditorState {
  formId: string;
  dispatch: (a: Action) => void;
  // Helpers ergonomiques (calculés à partir de dispatch)
  setTool: (tool: ToolName) => void;
  setPage: (page: number) => void;
  setScale: (scale: number) => void;
  selectField: (id: string | null) => void;
  addField: (field: Omit<VisualField, "id">) => string;
  updateField: (id: string, patch: Partial<VisualField>) => void;
  removeField: (id: string) => void;
  save: () => Promise<void>;
  reload: () => Promise<void>;
  materialize: () => Promise<{ ok: boolean; error?: string }>;
  serverSnapshot: ServerSnapshot | null;
  selectedField: VisualField | null;
  isReadOnlyMode: boolean;
}

const VisualEditorCtx = createContext<VisualEditorContextValue | null>(null);

interface ProviderProps {
  formId: string;
  /// Mode lecture seule (ex. viewport mobile) : aucune mutation autorisée.
  readOnly?: boolean;
  /// Callback déclenché juste après un materialize() réussi (post-reload).
  /// Sert au parent (form-editor) à recharger ses propres fields/technicalSchema
  /// et issues, qui sont écrits côté serveur par la route /materialize mais
  /// invisibles côté provider visuel.
  onMaterialized?: () => void;
  children: ReactNode;
}

export function VisualEditorProvider({ formId, readOnly = false, onMaterialized, children }: ProviderProps) {
  const [state, dispatch] = useReducer(visualEditorReducer, initialState);
  const [serverSnapshot, setServerSnapshot] = useState<ServerSnapshot | null>(null);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/admin/pdf/forms/${formId}/visual-fields`);
    if (!res.ok) {
      dispatch({ type: "SET_SAVE", state: "error" });
      return;
    }
    const data = (await res.json()) as ServerSnapshot;
    setServerSnapshot(data);
    dispatch({
      type: "REPLACE_DOC",
      doc: data.doc,
      serverUpdatedAt: data.updatedAt,
      serverMaterializedAt: data.materializedAt,
    });
  }, [formId]);

  useEffect(() => {
    // Chargement initial : la fonction `reload` est stable (useCallback) et
    // l'éventuel dispatch déclenché est l'effet recherché (synchroniser avec
    // l'API). Pas d'option propre pour signaler ça à react-hooks/set-state-in-effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  const setTool: VisualEditorContextValue["setTool"] = useCallback((tool) => {
    dispatch({ type: "SET_UI", patch: { tool } });
  }, []);
  const setPage: VisualEditorContextValue["setPage"] = useCallback((page) => {
    dispatch({ type: "SET_UI", patch: { page, selectedId: null } });
  }, []);
  const setScale: VisualEditorContextValue["setScale"] = useCallback((scale) => {
    dispatch({ type: "SET_UI", patch: { scale } });
  }, []);
  const selectField: VisualEditorContextValue["selectField"] = useCallback((id) => {
    dispatch({ type: "SET_UI", patch: { selectedId: id } });
  }, []);

  const addField: VisualEditorContextValue["addField"] = useCallback((partial) => {
    const id = `vf_${nanoid(8)}`;
    let finalName = partial.name;
    dispatch({
      type: "PATCH_FIELDS",
      updater: (fields) => {
        finalName = generateFieldName({ version: 1, fields }, partial.name);
        return [...fields, { ...partial, id, name: finalName } as VisualField];
      },
    });
    dispatch({ type: "SET_UI", patch: { selectedId: id, tool: "select" } });
    return id;
  }, []);

  const updateField: VisualEditorContextValue["updateField"] = useCallback((id, patch) => {
    dispatch({
      type: "PATCH_FIELDS",
      updater: (fields) =>
        fields.map((f) => {
          if (f.id !== id) return f;
          // Discriminator union : on garde le type d'origine si non précisé.
          const next = { ...f, ...patch } as VisualField;
          if (patch.type && patch.type !== f.type) {
            // Changement de type non supporté en v1 → on ignore.
            return f;
          }
          return next;
        }),
    });
  }, []);

  const removeField: VisualEditorContextValue["removeField"] = useCallback((id) => {
    dispatch({
      type: "PATCH_FIELDS",
      updater: (fields) => fields.filter((f) => f.id !== id),
    });
    dispatch({ type: "SET_UI", patch: { selectedId: null } });
  }, []);

  const save: VisualEditorContextValue["save"] = useCallback(async () => {
    if (readOnly) return;
    const v = validateVisualFieldsDoc(state.doc);
    if (!v.ok) {
      toast.error(`Doc invalide : ${v.errors?.[0]?.message ?? ""}`);
      dispatch({ type: "SET_SAVE", state: "error" });
      return;
    }
    dispatch({ type: "SET_SAVE", state: "saving" });
    const res = await fetch(`/api/admin/pdf/forms/${formId}/visual-fields`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(state.serverUpdatedAt ? { "If-Match": state.serverUpdatedAt } : {}),
      },
      body: JSON.stringify({ doc: state.doc }),
    });
    if (res.status === 412) {
      toast.error("Modification concurrente — rechargement.");
      await reload();
      return;
    }
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      toast.error(detail.error ?? "Échec de l'enregistrement.");
      dispatch({ type: "SET_SAVE", state: "error" });
      return;
    }
    const data = (await res.json()) as { updatedAt: string };
    dispatch({
      type: "REPLACE_DOC",
      savedDoc: state.doc,
      serverUpdatedAt: data.updatedAt,
    });
    toast.success("Brouillon visuel enregistré.");
  }, [formId, readOnly, reload, state.doc, state.serverUpdatedAt]);

  const materialize: VisualEditorContextValue["materialize"] = useCallback(async () => {
    if (readOnly) return { ok: false, error: "Lecture seule" };
    if (state.saveState === "dirty") {
      toast.error("Enregistrez le brouillon avant la matérialisation.");
      return { ok: false, error: "Save first" };
    }
    const res = await fetch(`/api/admin/pdf/forms/${formId}/visual-fields/materialize`, {
      method: "POST",
      headers: state.serverUpdatedAt ? { "If-Match": state.serverUpdatedAt } : {},
    });
    if (res.status === 412) {
      toast.error("Modification concurrente — rechargement.");
      await reload();
      return { ok: false, error: "Stale" };
    }
    const data = (await res.json().catch(() => ({}))) as { error?: string; updatedAt?: string; materializedAt?: string | null };
    if (!res.ok) {
      toast.error(data.error ?? "Échec de la matérialisation.");
      return { ok: false, error: data.error };
    }
    toast.success("Champs matérialisés dans le PDF.");
    await reload();
    onMaterialized?.();
    return { ok: true };
  }, [formId, readOnly, reload, state.saveState, state.serverUpdatedAt, onMaterialized]);

  const selectedField = useMemo(
    () => state.doc.fields.find((f) => f.id === state.ui.selectedId) ?? null,
    [state.doc.fields, state.ui.selectedId]
  );

  const value: VisualEditorContextValue = useMemo(
    () => ({
      ...state,
      formId,
      dispatch,
      setTool,
      setPage,
      setScale,
      selectField,
      addField,
      updateField,
      removeField,
      save,
      reload,
      materialize,
      serverSnapshot,
      selectedField,
      isReadOnlyMode: readOnly,
    }),
    [
      state,
      formId,
      setTool,
      setPage,
      setScale,
      selectField,
      addField,
      updateField,
      removeField,
      save,
      reload,
      materialize,
      serverSnapshot,
      selectedField,
      readOnly,
    ]
  );

  return <VisualEditorCtx.Provider value={value}>{children}</VisualEditorCtx.Provider>;
}

export function useVisualEditor(): VisualEditorContextValue {
  const ctx = useContext(VisualEditorCtx);
  if (!ctx) throw new Error("useVisualEditor doit être utilisé dans <VisualEditorProvider>");
  return ctx;
}

export type { SaveState, ToolName, UiState, ServerSnapshot };
