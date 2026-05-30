/// Parsers pour les CSV de la KBO Open Data. Les colonnes sont stables depuis
/// 2008 ; les types sont volontairement permissifs (strings) pour absorber les
/// variations mineures du Cookbook KBO.
/// Référence : https://economie.fgov.be/sites/default/files/Files/Entreprises/KBO/Cookbook-KBO-Open-Data.pdf

import { parse } from "csv-parse";

export interface KboEnterpriseRow {
  enterpriseNumber: string;
  status: string;
  juridicalSituation: string;
  typeOfEnterprise: string;
  juridicalForm: string;
  startDate?: Date;
}

export interface KboDenominationRow {
  enterpriseNumber: string;
  language: string;
  typeOfDenomination: string;
  denomination: string;
}

export interface KboAddressRow {
  enterpriseNumber: string;
  typeOfAddress: string;
  countryFR: string;
  countryNL: string;
  zipcode: string;
  municipalityFR: string;
  municipalityNL: string;
  streetFR: string;
  streetNL: string;
  houseNumber: string;
  box: string;
  extraAddressInfo: string;
  dateStrikingOff?: Date;
}

export interface KboActivityRow {
  enterpriseNumber: string;
  activityGroup: string;
  naceVersion: string;
  naceCode: string;
  classification: string;
}

/// Normalise le numéro BCE : enlève préfixe "BE", points et tirets.
/// Garde uniquement les chiffres. Retourne null si vide ou invalide.
export function normalizeEnterpriseNumber(raw: string | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.length !== 10) return null;
  return digits;
}

/// Les CSV BCE utilisent souvent JJ-MM-AAAA. On accepte aussi AAAA-MM-JJ.
export function parseKboDate(raw: string | undefined): Date | undefined {
  if (!raw) return undefined;
  const s = raw.trim();
  if (!s) return undefined;
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return new Date(`${s}T00:00:00Z`);
  const beMatch = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (beMatch) return new Date(`${beMatch[3]}-${beMatch[2]}-${beMatch[1]}T00:00:00Z`);
  return undefined;
}

interface ParseOptions {
  /// Callback batched (par défaut 5000 lignes). Le callback peut être async ;
  /// la backpressure est gérée via pause/resume du stream.
  onBatch: (rows: Record<string, string>[]) => Promise<void>;
  batchSize?: number;
  /// Filtre optionnel — utile pour skipper les unités d'établissement (qui ont
  /// un EntityNumber commençant par "2.") quand on ne veut que les entreprises.
  filter?: (row: Record<string, string>) => boolean;
}

/// Parse un flux CSV KBO en streaming, en passant des lots de lignes au
/// callback. La backpressure est naturelle via l'async iterator : tant que le
/// `onBatch` n'a pas résolu, on ne consomme pas la ligne suivante.
export async function streamKboCsv(
  source: NodeJS.ReadableStream,
  { onBatch, batchSize = 5000, filter }: ParseOptions
): Promise<{ rowsRead: number; rowsKept: number }> {
  const parser = parse({ columns: true, skip_empty_lines: true, trim: true });
  source.pipe(parser);

  let buffer: Record<string, string>[] = [];
  let rowsRead = 0;
  let rowsKept = 0;

  for await (const record of parser as AsyncIterable<Record<string, string>>) {
    rowsRead++;
    if (filter && !filter(record)) continue;
    buffer.push(record);
    rowsKept++;
    if (buffer.length >= batchSize) {
      const batch = buffer;
      buffer = [];
      await onBatch(batch);
    }
  }
  if (buffer.length > 0) await onBatch(buffer);
  return { rowsRead, rowsKept };
}

/// Mappe une ligne brute (clés EnterpriseNumber, Status, …) vers un
/// `KboEnterpriseRow`. Les noms de colonnes du Cookbook KBO sont en
/// PascalCase ; on tolère aussi des variantes camelCase pour les fixtures.
export function rowToEnterprise(row: Record<string, string>): KboEnterpriseRow | null {
  const num = normalizeEnterpriseNumber(row.EnterpriseNumber || row.enterpriseNumber);
  if (!num) return null;
  return {
    enterpriseNumber: num,
    status: row.Status || row.status || "",
    juridicalSituation: row.JuridicalSituation || row.juridicalSituation || "",
    typeOfEnterprise: row.TypeOfEnterprise || row.typeOfEnterprise || "",
    juridicalForm: row.JuridicalForm || row.juridicalForm || "",
    startDate: parseKboDate(row.StartDate || row.startDate),
  };
}

export function rowToDenomination(row: Record<string, string>): KboDenominationRow | null {
  const num = normalizeEnterpriseNumber(row.EntityNumber || row.entityNumber || row.EnterpriseNumber);
  const denom = (row.Denomination || row.denomination || "").trim();
  if (!num || !denom) return null;
  return {
    enterpriseNumber: num,
    language: row.Language || row.language || "",
    typeOfDenomination: row.TypeOfDenomination || row.typeOfDenomination || "",
    denomination: denom,
  };
}

export function rowToAddress(row: Record<string, string>): KboAddressRow | null {
  const num = normalizeEnterpriseNumber(row.EntityNumber || row.entityNumber || row.EnterpriseNumber);
  if (!num) return null;
  return {
    enterpriseNumber: num,
    typeOfAddress: row.TypeOfAddress || row.typeOfAddress || "",
    countryFR: row.CountryFR || row.countryFR || "",
    countryNL: row.CountryNL || row.countryNL || "",
    zipcode: row.Zipcode || row.zipcode || "",
    municipalityFR: row.MunicipalityFR || row.municipalityFR || "",
    municipalityNL: row.MunicipalityNL || row.municipalityNL || "",
    streetFR: row.StreetFR || row.streetFR || "",
    streetNL: row.StreetNL || row.streetNL || "",
    houseNumber: row.HouseNumber || row.houseNumber || "",
    box: row.Box || row.box || "",
    extraAddressInfo: row.ExtraAddressInfo || row.extraAddressInfo || "",
    dateStrikingOff: parseKboDate(row.DateStrikingOff || row.dateStrikingOff),
  };
}

export function rowToActivity(row: Record<string, string>): KboActivityRow | null {
  const num = normalizeEnterpriseNumber(row.EntityNumber || row.entityNumber || row.EnterpriseNumber);
  if (!num) return null;
  return {
    enterpriseNumber: num,
    activityGroup: row.ActivityGroup || row.activityGroup || "",
    naceVersion: row.NaceVersion || row.naceVersion || "",
    naceCode: row.NaceCode || row.naceCode || "",
    classification: row.Classification || row.classification || "",
  };
}
