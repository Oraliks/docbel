import { safeParseTreeContent } from "./schema";
import type { DecisionTreeContent } from "./types";

const FORMAT = "docbel.decision-tree";
const FORMAT_VERSION = 1;

export type DecisionTreeImportErrorCode =
  | "invalid_json"
  | "unsupported_format"
  | "invalid_tree";

export class DecisionTreeImportError extends Error {
  constructor(public readonly code: DecisionTreeImportErrorCode) {
    super(code);
  }
}

interface ExportMeta {
  slug: string;
  title: string;
  segment: string;
}

interface DecisionTreeEnvelope {
  format: typeof FORMAT;
  formatVersion: typeof FORMAT_VERSION;
  exportedAt: string;
  tree: ExportMeta;
  content: DecisionTreeContent;
}

export function serializeDecisionTree(
  meta: ExportMeta,
  content: DecisionTreeContent,
  exportedAt = new Date(),
): string {
  const envelope: DecisionTreeEnvelope = {
    format: FORMAT,
    formatVersion: FORMAT_VERSION,
    exportedAt: exportedAt.toISOString(),
    tree: meta,
    content,
  };
  return JSON.stringify(envelope, null, 2);
}

/** Accepte le format DocBel versionné et le contenu brut historique. */
export function parseDecisionTreeJson(text: string): DecisionTreeContent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new DecisionTreeImportError("invalid_json");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new DecisionTreeImportError("invalid_tree");
  }

  const record = parsed as Record<string, unknown>;
  let candidate: unknown = parsed;
  if ("format" in record || "formatVersion" in record || "content" in record) {
    if (record.format !== FORMAT || record.formatVersion !== FORMAT_VERSION) {
      throw new DecisionTreeImportError("unsupported_format");
    }
    candidate = record.content;
  }

  const content = safeParseTreeContent(candidate);
  if (!content) throw new DecisionTreeImportError("invalid_tree");
  return content;
}

export function decisionTreeFileName(slug: string): string {
  const safeSlug = slug
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${safeSlug || "arbre-decision"}.json`;
}
