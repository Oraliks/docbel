import { describe, expect, it } from "vitest";

import { parseAppointments } from "@/lib/rendez-vous/ics";
import {
  buildPlanning,
  buildPlannings,
  dayTheme,
  planningFilename,
  planningsFilename,
} from "@/lib/rendez-vous/planning";

const SAMPLE = `Appointments for 10/06/2026

08:20 – 08:40
0 guichet disponible
Patrick Jyambere
Sevil Sarıgöz

08:40 – 09:00
2 guichets disponibles
Mohammed El Bidari
`;

describe("dayTheme", () => {
  it("déduit le jour de la semaine de la date (mercredi 10/06/2026)", () => {
    // 10/06/2026 est un mercredi.
    expect(dayTheme(new Date(Date.UTC(2026, 5, 10))).name).toBe("Mercredi");
  });

  it("attribue une couleur distincte à chaque jour", () => {
    const accents = new Set<string>();
    for (let i = 0; i < 7; i += 1) {
      // i jours après dimanche 07/06/2026.
      accents.add(dayTheme(new Date(Date.UTC(2026, 5, 7 + i))).accent.join(","));
    }
    expect(accents.size).toBe(7);
  });
});

describe("buildPlannings (multi-jours)", () => {
  const MULTI = `Appointments for 09/06/2026
08:00 – 08:20
Alice Un

Appointments for 11/06/2026
09:00 – 09:20
Bob Deux
Carla Trois`;

  it("produit un planning par journée, daté et thématisé séparément", () => {
    const plannings = buildPlannings(parseAppointments(MULTI));
    expect(plannings).toHaveLength(2);
    expect(plannings[0].dateLabel).toBe("09/06/2026");
    expect(plannings[0].total).toBe(1);
    expect(plannings[1].dateLabel).toBe("11/06/2026");
    expect(plannings[1].total).toBe(2);
    // Jours différents → thèmes (couleurs) différents.
    expect(plannings[0].theme.name).not.toBe(plannings[1].theme.name);
  });

  it("nomme le fichier multi-jours avec une plage", () => {
    const plannings = buildPlannings(parseAppointments(MULTI));
    expect(planningsFilename(plannings)).toBe(
      "Planning_09_06_2026-11_06_2026.pdf",
    );
  });
});

describe("buildPlanning", () => {
  const planning = buildPlanning(parseAppointments(SAMPLE));

  it("reprend le thème du jour des rendez-vous", () => {
    expect(planning.theme.name).toBe("Mercredi");
    expect(planning.dateLabel).toBe("10/06/2026");
  });

  it("crée une colonne par créneau avec ses noms", () => {
    expect(planning.columns).toHaveLength(2);
    expect(planning.columns[0].time).toBe("8:20");
    expect(planning.columns[0].range).toBe("08:20 – 08:40");
    expect(planning.columns[0].names).toEqual([
      "Patrick Jyambere",
      "Sevil Sarıgöz",
    ]);
    expect(planning.columns[1].names).toEqual(["Mohammed El Bidari"]);
  });

  it("calcule le nombre de lignes et le total", () => {
    expect(planning.rowCount).toBe(2); // plus grand créneau
    expect(planning.total).toBe(3);
  });

  it("lève une erreur sur une liste vide", () => {
    expect(() => buildPlanning([])).toThrowError();
  });
});

describe("planningFilename", () => {
  it("formate Planning_Jour_JJ_MM_AAAA.pdf", () => {
    const planning = buildPlanning(parseAppointments(SAMPLE));
    expect(planningFilename(planning)).toBe("Planning_Mercredi_10_06_2026.pdf");
  });
});
