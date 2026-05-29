import { describe, it, expect } from "vitest";
import { visualEditorReducer, initialState } from "../visual-editor-reducer";
import type { Action } from "../visual-editor-types";
import type { VisualField, VisualFieldsDoc } from "@/lib/pdf-forms/visual/types";

const field = (id: string, page = 0): VisualField => ({
  id,
  name: id,
  type: "text",
  page,
  rect: { x: 0, y: 0, w: 100, h: 20 },
});

describe("visualEditorReducer", () => {
  it("PATCH_FIELDS marque dirty et applique l'updater", () => {
    const s = visualEditorReducer(initialState, {
      type: "PATCH_FIELDS",
      updater: () => [field("a"), field("b")],
    });
    expect(s.doc.fields.map((f) => f.id)).toEqual(["a", "b"]);
    expect(s.saveState).toBe("dirty");
  });

  it("PATCH_FIELDS no-op si l'updater renvoie la même référence", () => {
    const s = visualEditorReducer(initialState, {
      type: "PATCH_FIELDS",
      updater: (f) => f,
    });
    expect(s).toBe(initialState);
  });

  it("SET_UI patche partiellement l'état UI", () => {
    const s = visualEditorReducer(initialState, { type: "SET_UI", patch: { page: 2, tool: "text" } });
    expect(s.ui).toEqual({ ...initialState.ui, page: 2, tool: "text" });
  });

  it("SET_SAVE met à jour save", () => {
    const s = visualEditorReducer(initialState, { type: "SET_SAVE", state: "saving" });
    expect(s.saveState).toBe("saving");
  });

  it("REGISTER_PAGE_DIMS ajoute la géométrie", () => {
    const s = visualEditorReducer(initialState, {
      type: "REGISTER_PAGE_DIMS",
      page: 0,
      dims: { width: 595, height: 842, offsetX: 0, offsetY: 0 },
    });
    expect(s.pageDims[0]).toEqual({ width: 595, height: 842, offsetX: 0, offsetY: 0 });
  });

  it("REGISTER_PAGE_DIMS idempotent si dims inchangées", () => {
    const s1 = visualEditorReducer(initialState, {
      type: "REGISTER_PAGE_DIMS",
      page: 0,
      dims: { width: 1, height: 2, offsetX: 0, offsetY: 0 },
    });
    const s2 = visualEditorReducer(s1, {
      type: "REGISTER_PAGE_DIMS",
      page: 0,
      dims: { width: 1, height: 2, offsetX: 0, offsetY: 0 },
    });
    expect(s2).toBe(s1);
  });

  it("REPLACE_DOC réinitialise save=saved et stocke updatedAt + materializedAt", () => {
    const doc: VisualFieldsDoc = { version: 1, fields: [field("z")] };
    const s = visualEditorReducer(
      { ...initialState, saveState: "dirty" },
      { type: "REPLACE_DOC", doc, serverUpdatedAt: "2025-05-29T00:00:00Z", serverMaterializedAt: "2025-05-28T00:00:00Z" }
    );
    expect(s.doc).toBe(doc);
    expect(s.saveState).toBe("saved");
    expect(s.serverUpdatedAt).toBe("2025-05-29T00:00:00Z");
    expect(s.serverMaterializedAt).toBe("2025-05-28T00:00:00Z");
  });

  it("REPLACE_DOC post-save (sans doc) acquitte la version et marque saved si doc inchangé", () => {
    const saved: VisualFieldsDoc = { version: 1, fields: [field("a")] };
    const base = { ...initialState, doc: saved, saveState: "saving" as const };
    const s = visualEditorReducer(base, {
      type: "REPLACE_DOC",
      savedDoc: saved,
      serverUpdatedAt: "2025-05-29T01:00:00Z",
    });
    expect(s.doc).toBe(saved);
    expect(s.saveState).toBe("saved");
    expect(s.serverUpdatedAt).toBe("2025-05-29T01:00:00Z");
  });

  it("REPLACE_DOC post-save reste dirty si une édition a eu lieu pendant le PUT", () => {
    const saved: VisualFieldsDoc = { version: 1, fields: [field("a")] };
    // Édition concurrente : le doc courant a une nouvelle référence (≠ savedDoc).
    const edited: VisualFieldsDoc = { version: 1, fields: [field("a"), field("b")] };
    const s = visualEditorReducer(
      { ...initialState, doc: edited, saveState: "saving" },
      { type: "REPLACE_DOC", savedDoc: saved, serverUpdatedAt: "2025-05-29T01:00:00Z" }
    );
    // Les éditions concurrentes ne sont pas écrasées…
    expect(s.doc).toBe(edited);
    // …et l'état reste dirty pour signaler le travail non sauvegardé.
    expect(s.saveState).toBe("dirty");
    // La nouvelle version serveur est bien acquittée (pour le prochain If-Match).
    expect(s.serverUpdatedAt).toBe("2025-05-29T01:00:00Z");
  });

  it("PATCH_FIELDS pendant saving garde l'état saving (évite flicker)", () => {
    const s = visualEditorReducer(
      { ...initialState, saveState: "saving" },
      { type: "PATCH_FIELDS", updater: () => [field("a")] }
    );
    expect(s.saveState).toBe("saving");
  });

  it("action inconnue → state inchangé", () => {
    const s = visualEditorReducer(initialState, { type: "UNKNOWN" } as unknown as Action);
    expect(s).toBe(initialState);
  });
});
