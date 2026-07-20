/**
 * Normalisation défensive des références Lookup ONEM portées par un article
 * RioLex (`legalMeta.lookupRefs`, JSON libre en base). Réutilise le type
 * `LookupCodeRef` déjà en place pour les procédures de dossiers.
 *
 * L'encart « Codes ONEM liés » de la fiche article s'appuie dessus : comme la
 * source est du JSON éditorial (peuplé par scripts/attach-lookup-refs.ts), on
 * filtre les entrées incomplètes, on trim, on dédoublonne par (tableSlug, code)
 * et on plafonne pour éviter une sidebar qui déborde.
 */

import type { LookupCodeRef } from "@/lib/dossiers/types";

const MAX_REFS = 12;

function cleanString(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

/** Filtre + trim + dédoublonne un tableau brut de refs Lookup (fail-soft). */
export function normalizeLookupRefs(raw: unknown): LookupCodeRef[] {
  if (!Array.isArray(raw)) return [];

  const out: LookupCodeRef[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;

    const tableSlug = cleanString(rec.tableSlug);
    const label = cleanString(rec.label);
    if (!tableSlug || !label) continue;

    const code = cleanString(rec.code);
    const key = `${tableSlug}::${code ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const ref: LookupCodeRef = { tableSlug, label };
    if (code) ref.code = code;
    const context = cleanString(rec.context);
    if (context) ref.context = context;

    out.push(ref);
    if (out.length >= MAX_REFS) break;
  }

  return out;
}
