import { describe, expect, it } from "vitest";

import {
  AppointmentParseError,
  appointmentsFilename,
  generateICS,
  parseAppointments,
  type Appointment,
} from "@/lib/rendez-vous/ics";

const SAMPLE = `Appointments for 09/06/2026

08:20 – 08:40
4 Appointments:
Patrick Jyambere
Sevil Sarıgöz
Ajazi Indrit
Mohammadi Mohammad yasin

08:40 – 09:00
4 Appointments:
Mohammed El Bidari
CEDRYX FOTSO FOTSO
Gezim Krasniqi
Zulfiye Yasar
`;

/** Découpe le `.ics` en lignes physiques. */
function physicalLines(ics: string): string[] {
  return ics.split("\r\n");
}

describe("parseAppointments", () => {
  it("extrait tous les noms en rendez-vous distincts", () => {
    const appts = parseAppointments(SAMPLE);
    expect(appts).toHaveLength(8);
    expect(appts.map((a) => a.name)).toEqual([
      "Patrick Jyambere",
      "Sevil Sarıgöz",
      "Ajazi Indrit",
      "Mohammadi Mohammad yasin",
      "Mohammed El Bidari",
      "CEDRYX FOTSO FOTSO",
      "Gezim Krasniqi",
      "Zulfiye Yasar",
    ]);
  });

  it("rattache chaque nom au bon créneau et à la bonne date", () => {
    const appts = parseAppointments(SAMPLE);
    const first = appts[0];
    expect(first.start.getUTCFullYear()).toBe(2026);
    expect(first.start.getUTCMonth()).toBe(5); // juin (0-indexé)
    expect(first.start.getUTCDate()).toBe(9);
    expect(first.start.getUTCHours()).toBe(8);
    expect(first.start.getUTCMinutes()).toBe(20);
    expect(first.end.getUTCHours()).toBe(8);
    expect(first.end.getUTCMinutes()).toBe(40);

    // 5e nom → deuxième créneau 08:40–09:00
    const fifth = appts[4];
    expect(fifth.name).toBe("Mohammed El Bidari");
    expect(fifth.start.getUTCHours()).toBe(8);
    expect(fifth.start.getUTCMinutes()).toBe(40);
    expect(fifth.end.getUTCHours()).toBe(9);
    expect(fifth.end.getUTCMinutes()).toBe(0);
  });

  it("accepte plusieurs variantes de tirets et d'espaces", () => {
    const appts = parseAppointments(
      "Appointments for 1/2/2026\n9:00-9:30\nJean Test\n10:00 — 10:30\nMarie Test",
    );
    expect(appts).toHaveLength(2);
    expect(appts[0].start.getUTCMonth()).toBe(1); // février
    expect(appts[1].start.getUTCHours()).toBe(10);
  });

  it("lève DATE_MISSING quand la date est absente", () => {
    expect(() => parseAppointments("08:20 – 08:40\nJean Test")).toThrowError(
      expect.objectContaining({ code: "DATE_MISSING" }),
    );
  });

  it("lève INVALID_TIME sur une heure hors plage", () => {
    const input = "Appointments for 09/06/2026\n25:00 – 08:40\nJean Test";
    try {
      parseAppointments(input);
      throw new Error("aurait dû lever");
    } catch (err) {
      expect(err).toBeInstanceOf(AppointmentParseError);
      expect((err as AppointmentParseError).code).toBe("INVALID_TIME");
    }
  });

  it("lève INVALID_TIME quand la fin précède le début", () => {
    expect(() =>
      parseAppointments("Appointments for 09/06/2026\n09:00 – 08:40\nJean"),
    ).toThrowError(expect.objectContaining({ code: "INVALID_TIME" }));
  });

  it("lève NO_APPOINTMENTS quand aucun nom n'est présent", () => {
    expect(() =>
      parseAppointments("Appointments for 09/06/2026\n08:20 – 08:40"),
    ).toThrowError(expect.objectContaining({ code: "NO_APPOINTMENTS" }));
  });

  it("rejette une date inexistante (31/02)", () => {
    expect(() =>
      parseAppointments("Appointments for 31/02/2026\n08:20 – 08:40\nJean"),
    ).toThrowError(expect.objectContaining({ code: "DATE_MISSING" }));
  });
});

describe("generateICS", () => {
  const ics = generateICS(parseAppointments(SAMPLE));

  it("produit une enveloppe VCALENDAR conforme", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("PRODID:-//DocBel//Rendez-vous Export//FR");
  });

  it("embarque la VTIMEZONE Europe/Bruxelles", () => {
    expect(ics).toContain("BEGIN:VTIMEZONE");
    expect(ics).toContain("TZID:Europe/Brussels");
    expect(ics).toContain("RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU");
  });

  it("génère un VEVENT par rendez-vous avec les bons champs", () => {
    const vevents = ics.match(/BEGIN:VEVENT/g) ?? [];
    expect(vevents).toHaveLength(8);
    expect(ics).toContain("DTSTART;TZID=Europe/Brussels:20260609T082000");
    expect(ics).toContain("DTEND;TZID=Europe/Brussels:20260609T084000");
    expect(ics).toContain("SUMMARY:Patrick Jyambere");
  });

  it("génère des UID uniques se terminant par le domaine", () => {
    const uids = [...ics.matchAll(/^UID:(.+)$/gm)].map((m) => m[1].trim());
    expect(uids).toHaveLength(8);
    expect(new Set(uids).size).toBe(8);
    uids.forEach((uid) => expect(uid.endsWith("@docbel.be")).toBe(true));
  });

  it("échappe les caractères spéciaux RFC 5545 dans SUMMARY", () => {
    const appts: Appointment[] = [
      {
        name: "Doe, John; A\\B",
        start: new Date(Date.UTC(2026, 5, 9, 8, 0)),
        end: new Date(Date.UTC(2026, 5, 9, 8, 30)),
      },
    ];
    expect(generateICS(appts)).toContain("SUMMARY:Doe\\, John\\; A\\\\B");
  });

  it("plie les lignes à 75 octets maximum", () => {
    const appts: Appointment[] = [
      {
        name: "Trééès loooong nom ".repeat(10).trim(),
        start: new Date(Date.UTC(2026, 5, 9, 8, 0)),
        end: new Date(Date.UTC(2026, 5, 9, 8, 30)),
      },
    ];
    const encoder = new TextEncoder();
    for (const line of physicalLines(generateICS(appts))) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    }
  });

  it("n'utilise que des fins de ligne CRLF", () => {
    expect(ics.includes("\r\n")).toBe(true);
    // Aucun \n isolé (non précédé d'un \r).
    expect(/[^\r]\n/.test(ics)).toBe(false);
  });
});

describe("appointmentsFilename", () => {
  it("formate RDV_JJ_MM_AAAA.ics", () => {
    expect(appointmentsFilename(parseAppointments(SAMPLE))).toBe(
      "RDV_09_06_2026.ics",
    );
  });
});
