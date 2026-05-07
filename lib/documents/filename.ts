import { GenerationPayload } from "./types";

export function renderFilename(template: string, payload: GenerationPayload): string {
  const now = new Date();
  const isoDate = now.toISOString().slice(0, 10);
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (key === "date") return isoDate;
    const v = payload[key];
    if (v === null || v === undefined) return "";
    return String(v).replace(/[^a-zA-Z0-9._-]/g, "_");
  });
}
