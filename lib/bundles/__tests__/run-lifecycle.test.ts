import { describe, expect, it } from "vitest";
import {
  deriveBundleRunLifecycle,
  isBundleRunEditable,
} from "../run-lifecycle";

describe("BundleRun lifecycle", () => {
  it("distinguishes a new run from a completed but editable run", () => {
    expect(
      deriveBundleRunLifecycle({ status: "in_progress", completedAt: null }),
    ).toBe("in_progress");
    expect(
      deriveBundleRunLifecycle({
        status: "in_progress",
        completedAt: new Date("2026-07-15T10:00:00Z"),
      }),
    ).toBe("completed_editable");
  });

  it("keeps legacy completed runs editable", () => {
    const run = { status: "completed", completedAt: null };
    expect(deriveBundleRunLifecycle(run)).toBe("completed_editable");
    expect(isBundleRunEditable(run)).toBe(true);
  });

  it("closes abandoned and anonymized runs", () => {
    const abandoned = { status: "abandoned", completedAt: null };
    const anonymized = {
      status: "in_progress",
      completedAt: new Date(),
      anonymizedAt: new Date(),
    };
    expect(deriveBundleRunLifecycle(abandoned)).toBe("abandoned");
    expect(isBundleRunEditable(abandoned)).toBe(false);
    expect(deriveBundleRunLifecycle(anonymized)).toBe("anonymized");
    expect(isBundleRunEditable(anonymized)).toBe(false);
  });
});
