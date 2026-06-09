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

  it("ignore les lignes de compteur de guichets", () => {
    const input = `Appointments for 10/06/2026

08:20 – 08:40
0 guichet disponible
ana le doare petit
Gürkan Gölçük

08:40 – 09:00
2 guichets disponibles
Julie Dupont
`;
    const appts = parseAppointments(input);
    expect(appts.map((a) => a.name)).toEqual([
      "ana le doare petit",
      "Gürkan Gölçük",
      "Julie Dupont",
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

  it("gère plusieurs journées dans un même collage", () => {
    const input = `Appointments for 09/06/2026
08:20 – 08:40
2 Appointments:
Alice Un
Bob Deux

Appointments for 10/06/2026
09:00 – 09:20
1 Appointments:
Carla Trois`;
    const appts = parseAppointments(input);
    expect(appts).toHaveLength(3);
    // Jour 1 (09/06).
    expect(appts[0].name).toBe("Alice Un");
    expect(appts[0].start.getUTCDate()).toBe(9);
    expect(appts[1].start.getUTCDate()).toBe(9);
    // Jour 2 (10/06) : date ET créneau distincts — pas de fusion avec le jour 1.
    expect(appts[2].name).toBe("Carla Trois");
    expect(appts[2].start.getUTCDate()).toBe(10);
    expect(appts[2].start.getUTCHours()).toBe(9);
    expect(appts[2].start.getUTCMinutes()).toBe(0);
  });

  it("nomme le fichier .ics avec une plage quand plusieurs jours", () => {
    const single = parseAppointments("Appointments for 09/06/2026\n08:00 – 08:20\nX");
    expect(appointmentsFilename(single)).toBe("RDV_09_06_2026.ics");
    const multi = parseAppointments(
      "Appointments for 09/06/2026\n08:00 – 08:20\nX\nAppointments for 11/06/2026\n08:00 – 08:20\nY",
    );
    expect(appointmentsFilename(multi)).toBe("RDV_09_06_2026-11_06_2026.ics");
  });

  it("ignore les boutons « Approuver » / « Refuser » collés avec la liste", () => {
    const input = `Appointments for 09/06/2026
08:20 – 08:40
Patrick Jyambere
Approuver
Sevil Sarıgöz
Refuser`;
    const appts = parseAppointments(input);
    expect(appts.map((a) => a.name)).toEqual([
      "Patrick Jyambere",
      "Sevil Sarıgöz",
    ]);
  });

  it("retire un bouton d'action accolé en fin de nom", () => {
    const appts = parseAppointments(
      "Appointments for 09/06/2026\n08:20 – 08:40\nPatrick Jyambere Approuver\nSevil Sarıgöz Refuser",
    );
    expect(appts.map((a) => a.name)).toEqual([
      "Patrick Jyambere",
      "Sevil Sarıgöz",
    ]);
  });

  it("parse le format « Liste d'attente » (NOM → DATE → HEURE par bloc)", () => {
    const input = `Rendez-vous en attente

Approve AllAnnuler tout

approuverAnnulerGabriel Niesen
  SCHAERBEEK (P200) - Pl. de la Reine 5, 1030 Schaerbeek: jeudi, 18/06/2026
  09:40–10:00

approuverAnnulerHamza Ouazehari
  SCHAERBEEK (P200) - Pl. de la Reine 5, 1030 Schaerbeek: jeudi, 18/06/2026
  10:30–11:00`;
    const appts = parseAppointments(input);
    expect(appts).toHaveLength(2);
    expect(appts.map((a) => a.name)).toEqual([
      "Gabriel Niesen",
      "Hamza Ouazehari",
    ]);
    // Gabriel : 18/06/2026 09:40-10:00.
    expect(appts[0].start.getUTCDate()).toBe(18);
    expect(appts[0].start.getUTCMonth()).toBe(5); // juin (0-indexé)
    expect(appts[0].start.getUTCHours()).toBe(9);
    expect(appts[0].start.getUTCMinutes()).toBe(40);
    expect(appts[0].end.getUTCHours()).toBe(10);
    expect(appts[0].end.getUTCMinutes()).toBe(0);
    // Hamza : son créneau spécifique (pas celui de Gabriel).
    expect(appts[1].start.getUTCHours()).toBe(10);
    expect(appts[1].start.getUTCMinutes()).toBe(30);
    expect(appts[1].end.getUTCHours()).toBe(11);
  });

  it("supporte plusieurs jours en liste d'attente", () => {
    const input = `approuverAnnulerAlice Un
  Antenne X: lundi, 15/06/2026
  09:00–09:20

approuverAnnulerBob Deux
  Antenne Y: mardi, 16/06/2026
  14:00–14:30`;
    const appts = parseAppointments(input);
    expect(appts).toHaveLength(2);
    expect(appts[0].name).toBe("Alice Un");
    expect(appts[0].start.getUTCDate()).toBe(15);
    expect(appts[1].name).toBe("Bob Deux");
    expect(appts[1].start.getUTCDate()).toBe(16);
    expect(appts[1].start.getUTCHours()).toBe(14);
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
