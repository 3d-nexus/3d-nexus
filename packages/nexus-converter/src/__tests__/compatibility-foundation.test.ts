import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  determineCompatibilityOutcome,
  isCompatibilityProfileName,
  type CompatibilityFixtureManifest,
} from "@3d-nexus/core";
import {
  createCompatibilityReport,
  createScalarCompatibilityCheck,
  listBuiltInCompatibilityFixtures,
  renderCompatibilityReportMarkdown,
} from "../index";

function readJson(pathParts: string[]): unknown {
  const file = readFileSync(join(import.meta.dirname, ...pathParts), "utf8");
  return JSON.parse(file);
}

describe("compatibility foundation", () => {
  it("defines known compatibility profiles in openspec and runtime fixtures", () => {
    const profiles = readJson(["../../../../openspec/compatibility", "profiles.json"]) as {
      profiles: Array<{ name: string }>;
    };
    const fixtures = listBuiltInCompatibilityFixtures();

    expect(profiles.profiles.every((entry) => isCompatibilityProfileName(entry.name))).toBe(true);
    expect(new Set(fixtures.map((entry) => entry.profile)).size).toBe(profiles.profiles.length);
  });

  it("ships canonical fixture manifests that point to real fixture files", () => {
    const fixtures = listBuiltInCompatibilityFixtures();

    fixtures.forEach((fixture: CompatibilityFixtureManifest) => {
      expect(fixture.capabilities.length).toBeGreaterThan(0);
      const absolute = join(import.meta.dirname, "../../../..", fixture.fixturePath);
      expect(existsSync(absolute)).toBe(true);
    });
  });

  it("classifies exact, normalized, degraded, and unsupported outcomes with report output", () => {
    const profile = "maya-fbx";
    const checks = [
      createScalarCompatibilityCheck({ capability: "exact-cap", expected: 1, actual: 1, profile }),
      createScalarCompatibilityCheck({
        capability: "normalized-cap",
        expected: 1,
        actual: 1.0005,
        profile,
        tolerance: { exactAbsolute: 1e-6, normalizedAbsolute: 1e-3, degradedAbsolute: 1e-2 },
      }),
      createScalarCompatibilityCheck({
        capability: "degraded-cap",
        expected: 1,
        actual: 1.005,
        profile,
        tolerance: { exactAbsolute: 1e-6, normalizedAbsolute: 1e-3, degradedAbsolute: 1e-2 },
      }),
      createScalarCompatibilityCheck({
        capability: "unsupported-cap",
        expected: 1,
        actual: 1.5,
        profile,
        tolerance: { exactAbsolute: 1e-6, normalizedAbsolute: 1e-3, degradedAbsolute: 1e-2 },
      }),
    ];

    const fixture = listBuiltInCompatibilityFixtures().find((entry) => entry.profile === profile);
    expect(fixture).toBeDefined();
    const report = createCompatibilityReport({
      profile,
      fixture: fixture!,
      checks,
      targetFormat: "fbx",
    });
    const markdown = renderCompatibilityReportMarkdown(report);

    expect(determineCompatibilityOutcome(0)).toBe("exact");
    expect(report.summary.exact).toBe(1);
    expect(report.summary.normalized).toBe(1);
    expect(report.summary.degraded).toBe(1);
    expect(report.summary.unsupported).toBe(1);
    expect(report.summary.passed).toBe(false);
    expect(markdown).toContain("| exact | normalized | degraded | unsupported | passed |");
    expect(markdown).toContain("| unsupported-cap | unsupported |");
  });
});

