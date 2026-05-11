import { describe, expect, it } from "vitest";
import {
  createCompatibilityDiagnostic,
  determineCompatibilityOutcome,
  isCompatibilityProfileName,
  summarizeCompatibilityChecks,
  type CompatibilityCheckResult,
} from "../types/compatibility";

describe("compatibility utilities", () => {
  it("classifies differences with default and custom tolerances", () => {
    expect(determineCompatibilityOutcome(0)).toBe("exact");
    expect(determineCompatibilityOutcome(1e-4)).toBe("normalized");
    expect(determineCompatibilityOutcome(5e-3)).toBe("degraded");
    expect(determineCompatibilityOutcome(2e-2)).toBe("unsupported");

    expect(determineCompatibilityOutcome(0.2, { exactAbsolute: 0.25 })).toBe("exact");
    expect(determineCompatibilityOutcome(0.4, { exactAbsolute: 0.25, normalizedAbsolute: 0.5 })).toBe("normalized");
  });

  it("validates known profile names", () => {
    expect(isCompatibilityProfileName("maya-fbx")).toBe(true);
    expect(isCompatibilityProfileName("bvh")).toBe(true);
    expect(isCompatibilityProfileName("unknown-profile")).toBe(false);
  });

  it("creates diagnostics and summarizes check outcomes", () => {
    const diagnostic = createCompatibilityDiagnostic("maya-fbx", "fbx-animation", "FBX_ANIMATION_NORMALIZED", "Animation was normalized.");
    const checks: CompatibilityCheckResult[] = [
      { capability: "exact-capability", outcome: "exact", diagnostics: [] },
      { capability: "normalized-capability", outcome: "normalized", diagnostics: [diagnostic] },
      { capability: "degraded-capability", outcome: "degraded", diagnostics: [] },
      { capability: "unsupported-capability", outcome: "unsupported", diagnostics: [] },
    ];

    expect(diagnostic).toMatchObject({
      capability: "fbx-animation",
      code: "FBX_ANIMATION_NORMALIZED",
      profile: "maya-fbx",
      severity: "warning",
    });
    expect(summarizeCompatibilityChecks(checks)).toEqual({
      exact: 1,
      normalized: 1,
      degraded: 1,
      unsupported: 1,
      passed: false,
    });
  });
});
