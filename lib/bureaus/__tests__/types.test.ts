import { describe, it, expect } from "vitest";
import {
  computeOpenStatus,
  parseHours,
  parseServices,
  haversineKm,
  dayLabelFr,
} from "../types";

const STD_HOURS = [
  { day: 1, slots: [{ open: "09:00", close: "12:00" }, { open: "13:00", close: "16:00" }] },
  { day: 2, slots: [{ open: "09:00", close: "12:00" }, { open: "13:00", close: "16:00" }] },
  { day: 3, slots: [{ open: "09:00", close: "12:00" }] },
  { day: 4, slots: [{ open: "09:00", close: "12:00" }, { open: "13:00", close: "16:00" }] },
  { day: 5, slots: [{ open: "09:00", close: "12:00" }] },
  { day: 0, slots: [] },
  { day: 6, slots: [] },
];

describe("computeOpenStatus", () => {
  it("renvoie 'open' pendant les heures d'ouverture", () => {
    // Mardi 15 juin 2026 à 10h00 (jour ouvrable normal)
    const at = new Date(2026, 5, 16, 10, 0);
    const status = computeOpenStatus(STD_HOURS, at);
    expect(status.state).toBe("open");
    if (status.state === "open") {
      expect(status.closesAt).toBe("12:00");
      expect(status.minutesLeft).toBe(120);
    }
  });

  it("renvoie 'closed' avec nextOpen pendant la pause midi", () => {
    // Mardi 16 juin 2026 à 12h30 (pause midi)
    const at = new Date(2026, 5, 16, 12, 30);
    const status = computeOpenStatus(STD_HOURS, at);
    expect(status.state).toBe("closed");
    if (status.state === "closed") {
      expect(status.nextOpen?.day).toBe(2);
      expect(status.nextOpen?.time).toBe("13:00");
    }
  });

  it("renvoie 'closed_today' après fermeture si rien ce jour", () => {
    // Mercredi 17 juin 2026 à 14h (fermé l'aprem)
    const at = new Date(2026, 5, 17, 14, 0);
    const status = computeOpenStatus(STD_HOURS, at);
    expect(status.state).toBe("closed");
    if (status.state === "closed") {
      expect(status.nextOpen?.day).toBe(4);
    }
  });

  it("renvoie 'holiday' pendant les jours fériés", () => {
    // 21 juillet 2026 (mardi, fête nationale)
    const at = new Date(2026, 6, 21, 10, 0);
    const status = computeOpenStatus(STD_HOURS, at);
    expect(status.state).toBe("holiday");
    if (status.state === "holiday") {
      expect(status.holidayName).toBe("Fête nationale");
    }
  });

  it("saute les fériés en cherchant la prochaine ouverture", () => {
    // Lundi de Pâques 2026 (lundi 6 avril) → prochaine = mardi 7 avril 9h
    const at = new Date(2026, 3, 6, 10, 0);
    const status = computeOpenStatus(STD_HOURS, at);
    expect(status.state).toBe("holiday");
    if (status.state === "holiday") {
      expect(status.nextOpen?.day).toBe(2); // mardi
      expect(status.nextOpen?.time).toBe("09:00");
    }
  });

  it("renvoie 'no_data' si pas d'horaires", () => {
    expect(computeOpenStatus([], new Date()).state).toBe("no_data");
  });

  it("week-end (samedi) → closed avec nextOpen lundi", () => {
    const at = new Date(2026, 5, 20, 11, 0); // samedi 20 juin 2026
    const status = computeOpenStatus(STD_HOURS, at);
    expect(status.state).toBe("closed");
    if (status.state === "closed") {
      expect(status.nextOpen?.day).toBe(1); // lundi
    }
  });
});

describe("parseHours", () => {
  it("parse JSON valide", () => {
    const parsed = parseHours([
      { day: 1, slots: [{ open: "09:00", close: "12:00" }] },
    ]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].day).toBe(1);
    expect(parsed[0].slots[0].open).toBe("09:00");
  });

  it("ignore les jours invalides", () => {
    const parsed = parseHours([
      { day: 99, slots: [] },
      { day: 1, slots: [] },
    ]);
    expect(parsed).toHaveLength(1);
  });

  it("ignore les slots avec format temps invalide", () => {
    const parsed = parseHours([
      { day: 1, slots: [{ open: "9h", close: "12h" }] },
    ]);
    expect(parsed[0].slots).toHaveLength(0);
  });

  it("renvoie [] sur entrée non-array", () => {
    expect(parseHours(null)).toEqual([]);
    expect(parseHours("foo")).toEqual([]);
    expect(parseHours({ day: 1 })).toEqual([]);
  });
});

describe("parseServices", () => {
  it("filtre les non-strings et les vides", () => {
    expect(parseServices(["a", "", null, "b"])).toEqual(["a", "b"]);
  });

  it("trim les valeurs", () => {
    expect(parseServices(["  RIS  "])).toEqual(["RIS"]);
  });

  it("renvoie [] sur entrée invalide", () => {
    expect(parseServices(null)).toEqual([]);
    expect(parseServices("oops")).toEqual([]);
  });
});

describe("haversineKm", () => {
  it("calcule la distance entre Bruxelles et Liège (~ 90km)", () => {
    const d = haversineKm({ lat: 50.85, lng: 4.35 }, { lat: 50.63, lng: 5.58 });
    expect(d).toBeGreaterThan(80);
    expect(d).toBeLessThan(100);
  });

  it("renvoie 0 si même point", () => {
    expect(haversineKm({ lat: 50, lng: 4 }, { lat: 50, lng: 4 })).toBe(0);
  });
});

describe("dayLabelFr", () => {
  it("renvoie les abréviations correctes", () => {
    expect(dayLabelFr(0)).toBe("Dim.");
    expect(dayLabelFr(1)).toBe("Lun.");
    expect(dayLabelFr(6)).toBe("Sam.");
  });

  it("fallback sur '?' pour valeurs invalides", () => {
    expect(dayLabelFr(99)).toBe("?");
  });
});
