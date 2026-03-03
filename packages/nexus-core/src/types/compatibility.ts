export const COMPATIBILITY_PROFILES = [
  "mmd",
  "blender-fbx",
  "maya-fbx",
  "3dsmax-fbx",
  "motionbuilder-fbx",
  "unity",
  "unreal",
  "bvh",
] as const;

export type CompatibilityProfileName = (typeof COMPATIBILITY_PROFILES)[number];

export type CompatibilityOutcome = "exact" | "normalized" | "degraded" | "unsupported";
export type CompatibilitySeverity = "info" | "warning" | "error";

export interface CompatibilityTolerance {
  exactAbsolute?: number;
  normalizedAbsolute?: number;
  degradedAbsolute?: number;
}

export interface CompatibilityDiagnostic {
  code: string;
  message: string;
  severity: CompatibilitySeverity;
  capability: string;
  profile: CompatibilityProfileName;
  details?: unknown;
}

export interface CompatibilityFixtureManifest {
  id: string;
  profile: CompatibilityProfileName;
  label: string;
  tool: string;
  toolVersion: string;
  sourceFormat: string;
  fixturePath: string;
  capabilities: string[];
  expectedDiagnostics?: string[];
  tolerances?: Record<string, CompatibilityTolerance>;
  tags?: string[];
}

export interface CompatibilityCheckResult {
  capability: string;
  outcome: CompatibilityOutcome;
  difference?: number;
  expected?: unknown;
  actual?: unknown;
  diagnostics: CompatibilityDiagnostic[];
}

export interface CompatibilityReportSummary {
  exact: number;
  normalized: number;
  degraded: number;
  unsupported: number;
  passed: boolean;
}

export interface CompatibilityReport {
  profile: CompatibilityProfileName;
  generatedAt: string;
  sourceFormat?: string;
  targetFormat?: string;
  fixtureId?: string;
  checks: CompatibilityCheckResult[];
  summary: CompatibilityReportSummary;
}

export function isCompatibilityProfileName(value: string): value is CompatibilityProfileName {
  return (COMPATIBILITY_PROFILES as readonly string[]).includes(value);
}

export function createCompatibilityDiagnostic(
  profile: CompatibilityProfileName,
  capability: string,
  code: string,
  message: string,
  severity: CompatibilitySeverity = "warning",
  details?: unknown,
): CompatibilityDiagnostic {
  return {
    code,
    message,
    severity,
    capability,
    profile,
    details,
  };
}

export function determineCompatibilityOutcome(
  difference: number,
  tolerance: CompatibilityTolerance = {},
): CompatibilityOutcome {
  const exactAbsolute = tolerance.exactAbsolute ?? 1e-6;
  const normalizedAbsolute = tolerance.normalizedAbsolute ?? 1e-3;
  const degradedAbsolute = tolerance.degradedAbsolute ?? 1e-2;

  if (difference <= exactAbsolute) {
    return "exact";
  }
  if (difference <= normalizedAbsolute) {
    return "normalized";
  }
  if (difference <= degradedAbsolute) {
    return "degraded";
  }
  return "unsupported";
}

export function summarizeCompatibilityChecks(checks: CompatibilityCheckResult[]): CompatibilityReportSummary {
  const summary: CompatibilityReportSummary = {
    exact: 0,
    normalized: 0,
    degraded: 0,
    unsupported: 0,
    passed: true,
  };

  checks.forEach((check) => {
    summary[check.outcome] += 1;
    if (check.outcome === "unsupported") {
      summary.passed = false;
    }
  });

  return summary;
}
