const DEFAULT_MAX_LENGTH = 500;

export function sanitizeString(value: string, maxLength = DEFAULT_MAX_LENGTH): string {
  // Strip control chars (sauf \n et \t)
  const stripped = value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  return stripped.slice(0, maxLength);
}

export function sanitizeFieldValue(
  value: unknown,
  type: string,
  maxLength?: number
): string | number | boolean | null {
  if (value === null || value === undefined) return null;

  switch (type) {
    case "checkbox":
      return Boolean(value);
    case "number":
      if (typeof value === "number") return value;
      if (typeof value === "string" && value.trim() !== "") {
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
      }
      return null;
    default:
      return sanitizeString(String(value), maxLength ?? DEFAULT_MAX_LENGTH);
  }
}
