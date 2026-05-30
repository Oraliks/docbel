import { describe, it, expect } from "vitest";
import { Readable } from "node:stream";
import {
  normalizeEnterpriseNumber,
  parseKboDate,
  rowToEnterprise,
  rowToAddress,
  rowToDenomination,
  streamKboCsv,
} from "../kbo-csv-parser";

describe("normalizeEnterpriseNumber", () => {
  it("nettoie préfixe BE, points, espaces", () => {
    expect(normalizeEnterpriseNumber("BE0123.456.789")).toBe("0123456789");
    expect(normalizeEnterpriseNumber("0123 456 789")).toBe("0123456789");
  });
  it("rejette les longueurs invalides", () => {
    expect(normalizeEnterpriseNumber("123")).toBeNull();
    expect(normalizeEnterpriseNumber("")).toBeNull();
    expect(normalizeEnterpriseNumber(undefined)).toBeNull();
  });
});

describe("parseKboDate", () => {
  it("accepte JJ-MM-AAAA et AAAA-MM-JJ", () => {
    expect(parseKboDate("15-03-2020")?.toISOString().slice(0, 10)).toBe("2020-03-15");
    expect(parseKboDate("2020-03-15")?.toISOString().slice(0, 10)).toBe("2020-03-15");
  });
  it("renvoie undefined pour les entrées vides ou invalides", () => {
    expect(parseKboDate("")).toBeUndefined();
    expect(parseKboDate(undefined)).toBeUndefined();
    expect(parseKboDate("not-a-date")).toBeUndefined();
  });
});

describe("rowToEnterprise", () => {
  it("mappe les colonnes PascalCase du Cookbook KBO", () => {
    const r = rowToEnterprise({
      EnterpriseNumber: "0123456789",
      Status: "AC",
      JuridicalForm: "017",
      StartDate: "01-01-2010",
    } as Record<string, string>);
    expect(r?.enterpriseNumber).toBe("0123456789");
    expect(r?.status).toBe("AC");
    expect(r?.juridicalForm).toBe("017");
    expect(r?.startDate?.toISOString().slice(0, 10)).toBe("2010-01-01");
  });
  it("rejette une ligne sans numéro valide", () => {
    expect(rowToEnterprise({ EnterpriseNumber: "" })).toBeNull();
  });
});

describe("rowToAddress / rowToDenomination", () => {
  it("utilisent EntityNumber comme clé enterprise", () => {
    const a = rowToAddress({
      EntityNumber: "0123456789",
      Zipcode: "1000",
      MunicipalityFR: "Bruxelles",
      StreetFR: "Rue de la Loi",
      HouseNumber: "16",
    } as Record<string, string>);
    expect(a?.enterpriseNumber).toBe("0123456789");
    expect(a?.zipcode).toBe("1000");

    const d = rowToDenomination({
      EntityNumber: "0123456789",
      Language: "1",
      TypeOfDenomination: "001",
      Denomination: "Cantillon",
    } as Record<string, string>);
    expect(d?.denomination).toBe("Cantillon");
  });

  it("skippe une dénomination vide", () => {
    expect(rowToDenomination({ EntityNumber: "0123456789", Denomination: "" })).toBeNull();
  });
});

describe("streamKboCsv", () => {
  it("parse en lots, applique filtre, gère backpressure async", async () => {
    const csv =
      "EnterpriseNumber,Status\n" +
      "0123456789,AC\n" +
      "0987654321,ST\n" +
      "1111111111,AC\n";
    const source = Readable.from([csv]);
    const batches: Record<string, string>[][] = [];
    const stats = await streamKboCsv(source, {
      batchSize: 2,
      filter: (r) => r.Status === "AC",
      onBatch: async (rows) => {
        await new Promise((r) => setTimeout(r, 1));
        batches.push(rows);
      },
    });
    expect(stats.rowsRead).toBe(3);
    expect(stats.rowsKept).toBe(2);
    expect(batches.flat().map((r) => r.EnterpriseNumber)).toEqual(["0123456789", "1111111111"]);
  });
});
