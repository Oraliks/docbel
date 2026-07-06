import { describe, it, expect } from "vitest";
import { mapLegacyStatus } from "@/lib/reports/engine";

describe("mapLegacyStatus", () => {
  it("mappe les statuts identiques tels quels", () => {
    expect(mapLegacyStatus("pending")).toBe("pending");
    expect(mapLegacyStatus("in_progress")).toBe("in_progress");
    expect(mapLegacyStatus("resolved")).toBe("resolved");
    expect(mapLegacyStatus("dismissed")).toBe("dismissed");
  });
  it("mappe new (Training) vers pending", () => {
    expect(mapLegacyStatus("new")).toBe("pending");
  });
  it("mappe accepted (Translation) vers resolved", () => {
    expect(mapLegacyStatus("accepted")).toBe("resolved");
  });
  it("mappe rejected (Training, Translation) vers dismissed", () => {
    expect(mapLegacyStatus("rejected")).toBe("dismissed");
  });
});
