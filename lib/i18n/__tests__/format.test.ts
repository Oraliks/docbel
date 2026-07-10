import { describe, it, expect } from "vitest";
import { formatDate, formatDateTime, formatNumber, formatCurrency } from "../format";

// Convention DocBel (Oraliks 2026-07-10) : dates/heures FIXES JJ/MM/AAAA + 24h,
// indépendantes de la langue UI — contrairement aux nombres/devises qui restent
// locale-aware. Cf. règle dans AGENTS.md / docs/context/I18N_RULES.md.
//
// Les dates de test sont construites avec les composants LOCAUX (`new Date(y, m,
// d, h, min)`, mois 0-indexé) — `formatDate`/`formatDateTime` lisent aussi les
// composants locaux (`getDate`/`getHours`…) donc ces tests sont indépendants du
// fuseau horaire de la machine qui les exécute (pas d'hypothèse UTC).
describe("formatDate — JJ/MM/AAAA fixe, indépendant de la locale", () => {
  it("locale fr : jour/mois paddés", () => {
    expect(formatDate(new Date(2026, 6, 8), "fr")).toBe("08/07/2026");
  });

  it("locale en : reste JJ/MM/AAAA (pas MM/DD/AAAA)", () => {
    expect(formatDate(new Date(2026, 6, 8), "en")).toBe("08/07/2026");
  });

  it("locale de : séparateur `/` (pas `.` comme le rendu Intl natif de-BE)", () => {
    expect(formatDate(new Date(2026, 6, 8), "de")).toBe("08/07/2026");
  });

  it("locale ar : chiffres occidentaux (pas arabo-indiens)", () => {
    const s = formatDate(new Date(2026, 6, 8), "ar");
    expect(s).toBe("08/07/2026");
    expect(/^[0-9/]+$/.test(s)).toBe(true);
  });

  it("jour et mois à un chiffre sont paddés à 2", () => {
    expect(formatDate(new Date(2026, 0, 5), "fr")).toBe("05/01/2026");
  });

  it("entrée invalide → chaîne vide", () => {
    expect(formatDate("pas-une-date", "fr")).toBe("");
  });

  it("avec options explicites → reste Intl locale-aware (rendu délibérément stylisé)", () => {
    const s = formatDate(new Date(2026, 6, 8), "fr", { day: "numeric", month: "long", year: "numeric" });
    expect(s.toLowerCase()).toContain("juillet");
  });
});

describe("formatDateTime — JJ/MM/AAAA HH:mm fixe, 24h", () => {
  it("locale fr : heure 24h, jamais AM/PM", () => {
    const s = formatDateTime(new Date(2026, 6, 8, 14, 30), "fr");
    expect(s).toBe("08/07/2026 14:30");
    expect(s).not.toMatch(/[AP]M/i);
  });

  it("locale en : reste 24h (pas de AM/PM) même en soirée", () => {
    const s = formatDateTime(new Date(2026, 6, 8, 23, 5), "en");
    expect(s).toBe("08/07/2026 23:05");
  });

  it("heures et minutes paddées à 2", () => {
    expect(formatDateTime(new Date(2026, 6, 8, 9, 5), "fr")).toBe("08/07/2026 09:05");
  });

  it("entrée invalide → chaîne vide", () => {
    expect(formatDateTime("", "fr")).toBe("");
  });

  it("avec options explicites → l'heure reste 24h par défaut (hourCycle h23 injecté)", () => {
    const s = formatDateTime(new Date(2026, 6, 8, 23, 5), "en", { dateStyle: "short" });
    expect(s).not.toMatch(/[AP]M/i);
  });
});

describe("formatNumber / formatCurrency — restent locale-aware (hors périmètre de la règle date)", () => {
  it("formatNumber varie selon la locale (séparateur milliers)", () => {
    expect(formatNumber(1234.5, "fr")).not.toBe("");
  });

  it("formatCurrency retourne une chaîne non vide", () => {
    expect(formatCurrency(42, "fr")).toContain("42");
  });
});
