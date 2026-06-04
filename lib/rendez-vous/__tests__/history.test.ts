import { describe, expect, it } from "vitest";

import { parseAppointments } from "@/lib/rendez-vous/ics";
import {
  computeDuplicates,
  dateKey,
  formatDateKey,
  normalizeName,
  resolveScope,
  timeKey,
  toStoredRdvs,
  type StoredRdv,
} from "@/lib/rendez-vous/history";

describe("resolveScope", () => {
  it("partenaire → son organisation", () => {
    expect(
      resolveScope({
        isAdmin: false,
        partnerOrganization: "FGTB",
        requestedOrg: "AutreChose",
        userId: "u1",
      }),
    ).toBe("FGTB"); // l'org demandée est ignorée pour un partenaire
  });

  it("admin → l'organisation demandée", () => {
    expect(
      resolveScope({
        isAdmin: true,
        partnerOrganization: null,
        requestedOrg: "FGTB",
        userId: "u1",
      }),
    ).toBe("FGTB");
  });

  it("admin sans org demandée → espace admin isolé", () => {
    expect(
      resolveScope({
        isAdmin: true,
        partnerOrganization: null,
        requestedOrg: "",
        userId: "u1",
      }),
    ).toBe("admin:u1");
  });

  it("partenaire sans organisation → null", () => {
    expect(
      resolveScope({
        isAdmin: false,
        partnerOrganization: null,
        userId: "u1",
      }),
    ).toBeNull();
  });
});

describe("normalizeName", () => {
  it("ignore casse, accents et espaces multiples", () => {
    expect(normalizeName("  Gölçük   Gürkan ")).toBe("golcuk gurkan");
    expect(normalizeName("GÖLÇÜK GÜRKAN")).toBe(normalizeName("gölçük gürkan"));
  });

  it("rapproche İ turc et i latin", () => {
    expect(normalizeName("İğde")).toBe("igde");
  });
});

describe("clés date/heure", () => {
  it("dérive YYYY-MM-DD et HH:MM des champs UTC", () => {
    const d = new Date(Date.UTC(2026, 5, 10, 8, 20));
    expect(dateKey(d)).toBe("2026-06-10");
    expect(timeKey(d)).toBe("08:20");
    expect(formatDateKey("2026-06-10")).toBe("10/06/2026");
  });
});

describe("computeDuplicates", () => {
  const current = toStoredRdvs(
    parseAppointments(
      "Appointments for 10/06/2026\n08:20 – 08:40\nJean Dupont\nMarie Curie",
    ),
  );

  it("ne signale rien sans historique ni répétition", () => {
    expect(computeDuplicates(current, [])).toEqual([]);
  });

  it("signale une personne déjà présente dans l'historique (autre créneau)", () => {
    const existing: StoredRdv[] = [
      { name: "Jean DUPONT", date: "2026-06-03", startTime: "09:00", endTime: "09:20" },
    ];
    const dups = computeDuplicates(current, existing);
    expect(dups).toHaveLength(1);
    expect(dups[0].name).toBe("Jean Dupont");
    expect(dups[0].history[0].date).toBe("2026-06-03");
    expect(dups[0].history[0].startTime).toBe("09:00");
  });

  it("ignore un historique identique au créneau courant (déjà enregistré)", () => {
    const existing: StoredRdv[] = [
      { name: "Jean Dupont", date: "2026-06-10", startTime: "08:20", endTime: "08:40" },
    ];
    expect(computeDuplicates(current, existing)).toEqual([]);
  });

  it("signale les noms répétés dans la liste collée", () => {
    const repeated = toStoredRdvs(
      parseAppointments(
        "Appointments for 10/06/2026\n08:20 – 08:40\nJean Dupont\n09:00 – 09:20\nJean Dupont",
      ),
    );
    const dups = computeDuplicates(repeated, []);
    expect(dups).toHaveLength(1);
    expect(dups[0].inListCount).toBe(2);
  });

  it("trie l'historique par date puis heure", () => {
    const existing: StoredRdv[] = [
      { name: "Jean Dupont", date: "2026-06-09", startTime: "10:00", endTime: "10:20" },
      { name: "Jean Dupont", date: "2026-06-02", startTime: "08:00", endTime: "08:20" },
    ];
    const dups = computeDuplicates(current, existing);
    expect(dups[0].history.map((h) => h.date)).toEqual([
      "2026-06-02",
      "2026-06-09",
    ]);
  });
});
