/**
 * Fonctions PURES d'agrégation pour le dashboard analytics PDF Forms
 * (`/admin/pdf/analytics`).
 *
 * Aucune dépendance à Prisma ni à la DB ici : on prend en entrée des tableaux
 * déjà chargés (lignes minimales sélectionnées côté page server) et on les
 * transforme en view-model prêt pour recharts. Toutes les fonctions sont
 * déterministes — l'horloge (`now`) est passée en paramètre pour rester
 * testable sans figer `Date.now()`.
 */

/** Une soumission, réduite aux champs nécessaires aux agrégats. */
export interface SubmissionRow {
  createdAt: Date;
  success: boolean;
  /// "download" | "doccle" (texte libre côté schema ; on tolère d'autres valeurs).
  delivery: string;
  locale?: string;
}

/** Point d'une série quotidienne de soumissions, ventilée par canal de livraison. */
export interface DailySubmissionPoint {
  /// Clé ISO du jour (YYYY-MM-DD), en heure locale du serveur.
  date: string;
  download: number;
  doccle: number;
  total: number;
}

/** Clé de jour locale (YYYY-MM-DD), insensible au fuseau d'affichage. */
function dayKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Ventile les soumissions par jour sur les `days` derniers jours (jour courant
 * inclus), du plus ancien au plus récent. Les jours sans soumission sont
 * remplis à 0 pour éviter les trous dans le graphe. Une livraison non reconnue
 * (ni "download" ni "doccle") est comptée dans `total` uniquement.
 */
export function bucketSubmissionsByDay(
  rows: SubmissionRow[],
  days: number,
  now: Date
): DailySubmissionPoint[] {
  const span = Math.max(1, Math.floor(days));

  // Squelette : un point par jour, initialisé à 0, dans l'ordre chronologique.
  const points: DailySubmissionPoint[] = [];
  const indexByKey = new Map<string, number>();
  for (let i = span - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    indexByKey.set(key, points.length);
    points.push({ date: key, download: 0, doccle: 0, total: 0 });
  }

  for (const row of rows) {
    const idx = indexByKey.get(dayKey(row.createdAt));
    if (idx === undefined) continue; // hors fenêtre → ignoré
    const point = points[idx];
    point.total += 1;
    if (row.delivery === "download") point.download += 1;
    else if (row.delivery === "doccle") point.doccle += 1;
  }

  return points;
}

/** Résultat du calcul de taux de succès. */
export interface SuccessRate {
  total: number;
  success: number;
  /// Ratio dans [0, 1]. Vaut 0 quand `total` est 0 (jamais de NaN).
  rate: number;
}

/**
 * Taux de succès des soumissions. Sûr en cas de tableau vide : `rate` vaut 0
 * (pas de division par zéro). `rate` est un ratio (0..1) ; à l'affichage on
 * multiplie par 100.
 */
export function computeSuccessRate(rows: { success: boolean }[]): SuccessRate {
  const total = rows.length;
  const success = rows.reduce((acc, r) => acc + (r.success ? 1 : 0), 0);
  const rate = total === 0 ? 0 : success / total;
  return { total, success, rate };
}

/** Agrégat de signalements de validation par type de champ. */
export interface FieldTypeCount {
  fieldType: string;
  count: number;
}

/**
 * Compte les signalements de validation par `fieldType`, trié par count
 * décroissant (puis par `fieldType` croissant pour un ordre stable). Met en
 * évidence les validateurs qui rejettent le plus — le plus actionnable côté
 * admin.
 */
export function reportsByFieldType(rows: { fieldType: string }[]): FieldTypeCount[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = row.fieldType || "(inconnu)";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([fieldType, count]) => ({ fieldType, count }))
    .sort((a, b) => b.count - a.count || a.fieldType.localeCompare(b.fieldType));
}

/** Agrégat de soumissions par locale. */
export interface LocaleCount {
  locale: string;
  count: number;
}

/**
 * Compte les soumissions par locale, trié par count décroissant (puis locale
 * croissante). Une ligne sans locale est rangée sous "(inconnu)".
 */
export function submissionsByLocale(rows: { locale?: string }[]): LocaleCount[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = row.locale || "(inconnu)";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([locale, count]) => ({ locale, count }))
    .sort((a, b) => b.count - a.count || a.locale.localeCompare(b.locale));
}
