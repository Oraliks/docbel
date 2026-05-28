import { FormPayload } from "./types";

/// Construit un nom de fichier sûr : `{base}-{date}.pdf`.
/// Supporte les placeholders `{{fieldId}}` substitués depuis le payload
/// (valeurs assainies : seuls a-z 0-9 . _ - sont conservés).
export function renderFilename(base: string, payload: FormPayload = {}): string {
  const date = new Date().toISOString().slice(0, 10);
  const safeBase = base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60) || "document";
  const withVars = safeBase.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = payload[key];
    if (v === null || v === undefined) return "";
    return String(v).replace(/[^a-zA-Z0-9._-]/g, "_");
  });
  return `${withVars}-${date}.pdf`;
}
