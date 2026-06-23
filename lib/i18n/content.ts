import "server-only";
import { prisma } from "@/lib/prisma";
import { defaultLocale } from "@/i18n/config";

/**
 * Résolveur de traductions du CONTENU DB (table ContentTranslation).
 *
 * FR = langue source : les champs des modèles (News.title, Bureau.hoursNotes…)
 * SONT le français. Pour NL/EN/…, on superpose les valeurs traduites stockées
 * dans ContentTranslation, avec fallback FR si une traduction manque
 * (« informatif jamais bloquant »).
 *
 * Usage (server component) :
 *   const locale = await getLocale();
 *   const articles = await localizeRecords("News", rows, ["title","excerpt","content"], locale);
 */

/** Charge en un seul appel les traductions d'un modèle pour N records + 1 locale. */
async function loadTranslations(
  model: string,
  recordIds: string[],
  locale: string,
): Promise<Map<string, Record<string, string>>> {
  const byRecord = new Map<string, Record<string, string>>();
  if (recordIds.length === 0) return byRecord;
  const rows = await prisma.contentTranslation
    .findMany({
      where: { model, locale, recordId: { in: recordIds } },
      select: { recordId: true, field: true, value: true },
    })
    .catch(() => []); // jamais bloquant : si la requête échoue, on rend le FR
  for (const r of rows) {
    const m = byRecord.get(r.recordId) ?? {};
    m[r.field] = r.value;
    byRecord.set(r.recordId, m);
  }
  return byRecord;
}

/**
 * Superpose les champs traduits sur une liste d'enregistrements (fallback FR).
 * - locale FR (ou liste vide) → renvoie les records tels quels (zéro requête).
 * - `fields` = champs traduisibles à remplacer s'ils existent en `locale`.
 * - `idOf` extrait l'identifiant (défaut : `r.id`).
 */
export async function localizeRecords<T extends Record<string, unknown>>(
  model: string,
  records: T[],
  fields: (keyof T & string)[],
  locale: string,
  idOf: (r: T) => string = (r) => String(r.id),
): Promise<T[]> {
  if (locale === defaultLocale || records.length === 0) return records;
  const byRecord = await loadTranslations(model, records.map(idOf), locale);
  if (byRecord.size === 0) return records;
  return records.map((r) => {
    const tr = byRecord.get(idOf(r));
    if (!tr) return r;
    const copy: T = { ...r };
    for (const f of fields) {
      // N'écrase qu'un champ DÉJÀ présent sur l'enregistrement (sûr avec les
      // requêtes `select` : on n'ajoute jamais une clé non sélectionnée).
      if (!(f in copy)) continue;
      const v = tr[f];
      if (typeof v === "string" && v.length > 0) {
        (copy as Record<string, unknown>)[f] = v;
      }
    }
    return copy;
  });
}

/** Variante pour un seul enregistrement. */
export async function localizeRecord<T extends Record<string, unknown>>(
  model: string,
  record: T,
  fields: (keyof T & string)[],
  locale: string,
  idOf: (r: T) => string = (r) => String(r.id),
): Promise<T> {
  const [out] = await localizeRecords(model, [record], fields, locale, idOf);
  return out ?? record;
}
