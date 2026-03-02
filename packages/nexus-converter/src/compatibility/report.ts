import {
  createCompatibilityDiagnostic,
  determineCompatibilityOutcome,
  summarizeCompatibilityChecks,
  type CompatibilityCheckResult,
  type CompatibilityDiagnostic,
  type CompatibilityFixtureManifest,
  type CompatibilityProfileName,
  type CompatibilityReport,
  type CompatibilityTolerance,
} from "nexus-core";

export interface CompatibilityScalarCheckInput {
  capability: string;
  expected: number;
  actual: number;
  tolerance?: CompatibilityTolerance;
  profile: CompatibilityProfileName;
  diagnostics?: CompatibilityDiagnostic[];
}

export function createScalarCompatibilityCheck(input: CompatibilityScalarCheckInput): CompatibilityCheckResult {
  const difference = Math.abs(input.actual - input.expected);
  const outcome = determineCompatibilityOutcome(difference, input.tolerance);
  const diagnostics = [...(input.diagnostics ?? [])];
  if (outcome !== "exact") {
    diagnostics.push(
      createCompatibilityDiagnostic(
        input.profile,
        input.capability,
        `COMPAT_${outcome.toUpperCase()}`,
        `Capability ${input.capability} evaluated as ${outcome} (difference=${difference}).`,
        outcome === "unsupported" ? "error" : "warning",
        {
          expected: input.expected,
          actual: input.actual,
          difference,
        },
      ),
    );
  }

  return {
    capability: input.capability,
    outcome,
    difference,
    expected: input.expected,
    actual: input.actual,
    diagnostics,
  };
}

export interface CreateCompatibilityReportInput {
  profile: CompatibilityProfileName;
  fixture?: CompatibilityFixtureManifest;
  sourceFormat?: string;
  targetFormat?: string;
  checks: CompatibilityCheckResult[];
}

export function createCompatibilityReport(input: CreateCompatibilityReportInput): CompatibilityReport {
  const report: CompatibilityReport = {
    profile: input.profile,
    generatedAt: new Date().toISOString(),
    checks: input.checks,
    summary: summarizeCompatibilityChecks(input.checks),
  };
  const sourceFormat = input.sourceFormat ?? input.fixture?.sourceFormat;
  if (input.fixture?.id) {
    report.fixtureId = input.fixture.id;
  }
  if (sourceFormat) {
    report.sourceFormat = sourceFormat;
  }
  if (input.targetFormat) {
    report.targetFormat = input.targetFormat;
  }
  return report;
}

export function renderCompatibilityReportMarkdown(report: CompatibilityReport): string {
  const header = [
    `# Compatibility Report`,
    ``,
    `- Profile: ${report.profile}`,
    `- Generated: ${report.generatedAt}`,
    `- Source Format: ${report.sourceFormat ?? "unknown"}`,
    `- Target Format: ${report.targetFormat ?? "n/a"}`,
    `- Fixture: ${report.fixtureId ?? "n/a"}`,
    ``,
    `## Summary`,
    ``,
    `| exact | normalized | degraded | unsupported | passed |`,
    `|---|---|---|---|---|`,
    `| ${report.summary.exact} | ${report.summary.normalized} | ${report.summary.degraded} | ${report.summary.unsupported} | ${report.summary.passed ? "yes" : "no"} |`,
    ``,
    `## Checks`,
    ``,
    `| capability | outcome | difference | diagnostics |`,
    `|---|---|---|---|`,
  ];

  const rows = report.checks.map((check) => {
    const difference = typeof check.difference === "number" ? check.difference.toPrecision(4) : "";
    return `| ${check.capability} | ${check.outcome} | ${difference} | ${check.diagnostics.length} |`;
  });

  return [...header, ...rows, ""].join("\n");
}
