import { describe, it, expect } from "vitest";
import {
  bucketSubmissionsByDay,
  computeSuccessRate,
  diagnosticsBreakdown,
  reportsByFieldType,
  submissionsByLocale,
  type SubmissionRow,
} from "../analytics";

/** Construit une Date à minuit local, décalée de `offsetDays` par rapport à `ref`. */
function dayBefore(ref: Date, offsetDays: number, hour = 12): Date {
  const d = new Date(ref);
  d.setHours(hour, 0, 0, 0);
  d.setDate(d.getDate() - offsetDays);
  return d;
}

describe("bucketSubmissionsByDay", () => {
  const now = new Date(2026, 5, 21, 15, 30); // 21 juin 2026, 15h30 local

  it("produit un point par jour, dans l'ordre chronologique, jours vides à 0", () => {
    const series = bucketSubmissionsByDay([], 7, now);
    expect(series).toHaveLength(7);
    // Ordre croissant : le dernier point est aujourd'hui.
    expect(series[6].date).toBe("2026-06-21");
    expect(series[0].date).toBe("2026-06-15");
    // Tous vides.
    for (const p of series) {
      expect(p).toMatchObject({ download: 0, doccle: 0, total: 0 });
    }
  });

  it("ventile download / doccle et remplit les jours sans soumission", () => {
    const rows: SubmissionRow[] = [
      { createdAt: dayBefore(now, 0), success: true, delivery: "download" },
      { createdAt: dayBefore(now, 0), success: true, delivery: "doccle" },
      { createdAt: dayBefore(now, 2), success: false, delivery: "download" },
    ];
    const series = bucketSubmissionsByDay(rows, 3, now);
    expect(series).toHaveLength(3);

    const today = series.find((p) => p.date === "2026-06-21")!;
    expect(today).toMatchObject({ download: 1, doccle: 1, total: 2 });

    const yesterday = series.find((p) => p.date === "2026-06-20")!;
    expect(yesterday).toMatchObject({ download: 0, doccle: 0, total: 0 });

    const twoDaysAgo = series.find((p) => p.date === "2026-06-19")!;
    expect(twoDaysAgo).toMatchObject({ download: 1, doccle: 0, total: 1 });
  });

  it("ignore les soumissions hors fenêtre et compte une livraison inconnue dans total seulement", () => {
    const rows: SubmissionRow[] = [
      { createdAt: dayBefore(now, 10), success: true, delivery: "download" }, // hors fenêtre
      { createdAt: dayBefore(now, 0), success: true, delivery: "autre" }, // livraison inconnue
    ];
    const series = bucketSubmissionsByDay(rows, 3, now);
    const today = series.find((p) => p.date === "2026-06-21")!;
    expect(today).toMatchObject({ download: 0, doccle: 0, total: 1 });
    // La ligne hors fenêtre n'apparaît nulle part.
    const sumTotal = series.reduce((acc, p) => acc + p.total, 0);
    expect(sumTotal).toBe(1);
  });

  it("borne days à au moins 1", () => {
    expect(bucketSubmissionsByDay([], 0, now)).toHaveLength(1);
  });
});

describe("computeSuccessRate", () => {
  it("renvoie rate=0 sans division par zéro quand le tableau est vide", () => {
    const r = computeSuccessRate([]);
    expect(r).toEqual({ total: 0, success: 0, rate: 0 });
    expect(Number.isNaN(r.rate)).toBe(false);
  });

  it("calcule le ratio de succès", () => {
    const r = computeSuccessRate([
      { success: true },
      { success: true },
      { success: false },
      { success: true },
    ]);
    expect(r.total).toBe(4);
    expect(r.success).toBe(3);
    expect(r.rate).toBeCloseTo(0.75, 5);
  });

  it("gère 100% et 0% sans NaN", () => {
    expect(computeSuccessRate([{ success: true }]).rate).toBe(1);
    expect(computeSuccessRate([{ success: false }]).rate).toBe(0);
  });
});

describe("reportsByFieldType", () => {
  it("compte et trie par count décroissant", () => {
    const out = reportsByFieldType([
      { fieldType: "niss" },
      { fieldType: "iban" },
      { fieldType: "niss" },
      { fieldType: "niss" },
      { fieldType: "iban" },
      { fieldType: "tva_be" },
    ]);
    expect(out).toEqual([
      { fieldType: "niss", count: 3 },
      { fieldType: "iban", count: 2 },
      { fieldType: "tva_be", count: 1 },
    ]);
  });

  it("départage à count égal par fieldType croissant (ordre stable)", () => {
    const out = reportsByFieldType([{ fieldType: "zeta" }, { fieldType: "alpha" }]);
    expect(out.map((o) => o.fieldType)).toEqual(["alpha", "zeta"]);
  });

  it("range les fieldType vides sous (inconnu)", () => {
    const out = reportsByFieldType([{ fieldType: "" }]);
    expect(out).toEqual([{ fieldType: "(inconnu)", count: 1 }]);
  });

  it("renvoie un tableau vide pour une entrée vide", () => {
    expect(reportsByFieldType([])).toEqual([]);
  });
});

describe("submissionsByLocale", () => {
  it("compte par locale, trié décroissant, sans locale → (inconnu)", () => {
    const out = submissionsByLocale([
      { locale: "fr" },
      { locale: "nl" },
      { locale: "fr" },
      {},
    ]);
    expect(out).toEqual([
      { locale: "fr", count: 2 },
      { locale: "(inconnu)", count: 1 },
      { locale: "nl", count: 1 },
    ]);
  });
});

describe("diagnosticsBreakdown", () => {
  const form = (slug: string) => ({ id: `id-${slug}`, slug, title: slug.toUpperCase() });

  it("distingue « vérifiée et complète » de « non évaluée »", () => {
    // `null` = génération antérieure à S7, ou PDF jamais produit : elle ne
    // compte NI comme vérifiée NI comme anomalie. Confondre les deux ferait
    // passer un parc non instrumenté pour un parc sain.
    const out = diagnosticsBreakdown([
      { diagnosticsSummary: { count: 0, kinds: {} }, form: form("c1a") },
      { diagnosticsSummary: null, form: form("c1a") },
    ]);
    expect(out.checked).toBe(1);
    expect(out.withAnomalies).toBe(0);
  });

  it("compte les générations à anomalie et ventile par type", () => {
    const out = diagnosticsBreakdown([
      { diagnosticsSummary: { count: 2, kinds: { "widget-introuvable": 2 } }, form: form("c1a") },
      { diagnosticsSummary: { count: 1, kinds: { "stamp-refuse": 1 } }, form: form("c47") },
      { diagnosticsSummary: { count: 0, kinds: {} }, form: form("c47") },
    ]);
    expect(out.checked).toBe(3);
    expect(out.withAnomalies).toBe(2);
    expect(out.byKind).toEqual([
      { kind: "widget-introuvable", count: 2 },
      { kind: "stamp-refuse", count: 1 },
    ]);
  });

  it("regroupe par formulaire, du plus touché au moins touché", () => {
    const out = diagnosticsBreakdown([
      { diagnosticsSummary: { count: 1, kinds: { "stamp-refuse": 1 } }, form: form("c47") },
      { diagnosticsSummary: { count: 3, kinds: { "widget-introuvable": 3 } }, form: form("c1a") },
      { diagnosticsSummary: { count: 2, kinds: { "widget-introuvable": 2 } }, form: form("c1a") },
    ]);
    // `id` et non `slug` pour le lien : l'admin qui constate des documents
    // incomplets veut ouvrir le mapping du formulaire (/admin/pdf/[id]), pas
    // sa page publique.
    expect(out.byForm).toEqual([
      { id: "id-c1a", slug: "c1a", title: "C1A", generations: 2, anomalies: 5 },
      { id: "id-c47", slug: "c47", title: "C47", generations: 1, anomalies: 1 },
    ]);
  });

  it("aucune ligne → tout à zéro, jamais de NaN", () => {
    expect(diagnosticsBreakdown([])).toEqual({
      checked: 0,
      withAnomalies: 0,
      byKind: [],
      byForm: [],
    });
  });

  it("encaisse un JSON de forme inattendue sans planter le dashboard", () => {
    // La colonne est du Json libre : une ligne écrite par une version future
    // (ou corrompue) ne doit pas faire tomber la page admin.
    const out = diagnosticsBreakdown([
      { diagnosticsSummary: "pas un objet", form: form("c1a") },
      { diagnosticsSummary: { count: "deux" }, form: form("c1a") },
      { diagnosticsSummary: { count: 1, kinds: null }, form: form("c1a") },
    ]);
    expect(out.checked).toBe(1);
    expect(out.withAnomalies).toBe(1);
    expect(out.byKind).toEqual([]);
  });
});
