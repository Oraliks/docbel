import { describe, expect, it } from "vitest";
import { classifyOverall, SLOW_DB_MS } from "../classify";

describe("classifyOverall", () => {
  it("down si la DB est down", () => {
    expect(classifyOverall({ status: "down", latencyMs: null })).toBe("down");
  });
  it("ok si la DB répond vite", () => {
    expect(classifyOverall({ status: "up", latencyMs: 15 })).toBe("ok");
  });
  it("degraded si la DB répond au-delà du seuil", () => {
    expect(classifyOverall({ status: "up", latencyMs: SLOW_DB_MS + 1 })).toBe("degraded");
  });
  it("ok exactement au seuil", () => {
    expect(classifyOverall({ status: "up", latencyMs: SLOW_DB_MS })).toBe("ok");
  });
  it("seuil paramétrable", () => {
    expect(classifyOverall({ status: "up", latencyMs: 600 }, 500)).toBe("degraded");
  });
  it("une DB up sans mesure de latence reste ok (mesure best-effort)", () => {
    expect(classifyOverall({ status: "up", latencyMs: null })).toBe("ok");
  });
});
