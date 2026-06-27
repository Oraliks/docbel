import { Prisma } from "@prisma/client";
import { prisma, withDbRetry } from "@/lib/prisma";

/**
 * Modèles dont le contenu est traduisible via `ContentTranslation`.
 * La VALEUR FR est la source : elle vit sur le record d'origine du modèle
 * (champ homonyme), PAS dans la table de traduction. Ce helper récupère ces
 * sources FR pour les afficher en regard de chaque traduction NL/EN.
 *
 * Le `model` stocké en base correspond à l'accesseur Prisma (ex. "news",
 * "documentBundle"). On groupe les demandes par modèle, on fetch les records
 * en un seul `findMany` par modèle (in: ids), puis on lit le champ demandé.
 */

/// Champs source autorisés par modèle (= colonnes texte du record d'origine).
export const SOURCE_FIELDS: Record<string, readonly string[]> = {
  news: ["title", "excerpt", "content", "keyTakeaway"],
  tool: ["name", "description"],
  organisme: ["name", "description"],
  calculatorAsset: ["label", "description"],
  commissionParitaire: ["nom", "label"],
  documentBundle: ["name", "description", "organism"],
  bureau: ["hoursNotes"],
} as const;

export const SOURCE_MODELS = Object.keys(SOURCE_FIELDS);

export type SourceItem = { model: string; recordId: string; field: string };

/**
 * La table `ContentTranslation` stocke le `model` en PascalCase ("Bureau",
 * "DocumentBundle" — aligné sur le chemin de lecture public `localizeRecords`),
 * tandis que ce module l'indexe en camelCase (= accesseur Prisma `prisma.bureau`).
 * On normalise vers le camelCase pour réconcilier les deux. Idempotent.
 */
export function normalizeModel(model: string): string {
  return model.length ? model[0].toLowerCase() + model.slice(1) : model;
}

/// Clé canonique d'une ligne de traduction (model:recordId:field).
/// Normalise le model → la clé est stable quelle que soit la casse en entrée.
export function sourceKey(model: string, recordId: string, field: string): string {
  return `${normalizeModel(model)}:${recordId}:${field}`;
}

/**
 * Récupère les textes source FR pour une liste d'items.
 * Renvoie une Map `${model}:${recordId}:${field}` → valeur FR (string, "" si
 * absente/null). Les modèles/champs inconnus sont ignorés silencieusement.
 */
export async function getSourceTexts(
  items: SourceItem[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (items.length === 0) return result;

  // Groupe par modèle → set d'ids à fetcher. On normalise la casse (DB =
  // PascalCase, index interne = camelCase) avant tout lookup.
  const idsByModel = new Map<string, Set<string>>();
  for (const it of items) {
    const model = normalizeModel(it.model);
    if (!(model in SOURCE_FIELDS)) continue;
    if (!idsByModel.has(model)) idsByModel.set(model, new Set());
    idsByModel.get(model)!.add(it.recordId);
  }

  for (const [model, idSet] of idsByModel) {
    const ids = Array.from(idSet);
    const fields = SOURCE_FIELDS[model];
    // `select` ne garde que l'id + les champs source (cast large pour le typage
    // générique : chaque branche du switch lit des champs string|null connus).
    const records = await fetchRecords(model, ids, fields);
    for (const rec of records) {
      for (const field of fields) {
        const raw = (rec as Record<string, unknown>)[field];
        const value = typeof raw === "string" ? raw : "";
        result.set(sourceKey(model, rec.id, field), value);
      }
    }
  }

  return result;
}

/// Fetch des records par modèle. Switch exhaustif sur les 7 modèles traduisibles.
async function fetchRecords(
  model: string,
  ids: string[],
  fields: readonly string[]
): Promise<Array<{ id: string } & Record<string, unknown>>> {
  // Projection dynamique : id + champs source uniquement. Les `select` Prisma
  // sont fortement typés par modèle ; on construit l'objet générique puis on
  // cast par branche (les champs proviennent de SOURCE_FIELDS, donc valides).
  const select = { id: true } as Record<string, boolean>;
  for (const f of fields) select[f] = true;

  // Helper de cast : ramène n'importe quel résultat findMany vers la forme
  // générique lue par getSourceTexts (id + champs string|null).
  type Generic = { id: string } & Record<string, unknown>;
  const cast = (p: Promise<unknown>) => p as Promise<Generic[]>;

  switch (model) {
    case "news":
      return cast(
        withDbRetry(() =>
          prisma.news.findMany({
            where: { id: { in: ids } },
            select: select as unknown as Prisma.NewsSelect,
          })
        )
      );
    case "tool":
      return cast(
        withDbRetry(() =>
          prisma.tool.findMany({
            where: { id: { in: ids } },
            select: select as unknown as Prisma.ToolSelect,
          })
        )
      );
    case "organisme":
      return cast(
        withDbRetry(() =>
          prisma.organisme.findMany({
            where: { id: { in: ids } },
            select: select as unknown as Prisma.OrganismeSelect,
          })
        )
      );
    case "calculatorAsset":
      return cast(
        withDbRetry(() =>
          prisma.calculatorAsset.findMany({
            where: { id: { in: ids } },
            select: select as unknown as Prisma.CalculatorAssetSelect,
          })
        )
      );
    case "commissionParitaire":
      return cast(
        withDbRetry(() =>
          prisma.commissionParitaire.findMany({
            where: { id: { in: ids } },
            select: select as unknown as Prisma.CommissionParitaireSelect,
          })
        )
      );
    case "documentBundle":
      return cast(
        withDbRetry(() =>
          prisma.documentBundle.findMany({
            where: { id: { in: ids } },
            select: select as unknown as Prisma.DocumentBundleSelect,
          })
        )
      );
    case "bureau":
      return cast(
        withDbRetry(() =>
          prisma.bureau.findMany({
            where: { id: { in: ids } },
            select: select as unknown as Prisma.BureauSelect,
          })
        )
      );
    default:
      return [];
  }
}
