import {
  createCompatibilityDiagnostic,
  type AiScene,
  determineCompatibilityOutcome,
  summarizeCompatibilityChecks,
  type CompatibilityCheckResult,
  type CompatibilityDiagnostic,
  type CompatibilityFixtureManifest,
  type CompatibilityProfileName,
  type CompatibilityReport,
  type CompatibilityTolerance,
} from "@3d-nexus/core";
import { analyzeBvhFrameDrift } from "@3d-nexus/bvh";

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

function readSceneArray(scene: AiScene, key: string): Array<Record<string, unknown>> {
  const raw = scene.metadata[key]?.data;
  if (typeof raw !== "string") {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function createOutcomeCheck(
  profile: CompatibilityProfileName,
  capability: string,
  outcome: CompatibilityCheckResult["outcome"],
  diagnostics: CompatibilityDiagnostic[] = [],
  expected?: unknown,
  actual?: unknown,
): CompatibilityCheckResult {
  return {
    capability,
    outcome,
    expected,
    actual,
    difference: outcome === "exact" ? 0 : 1,
    diagnostics,
  };
}

export interface CreateSceneCompatibilityReportInput {
  scene: AiScene;
  profile: CompatibilityProfileName;
  sourceFormat: string;
  targetFormat: string;
}

export function createSceneCompatibilityReport(input: CreateSceneCompatibilityReportInput): CompatibilityReport {
  const diagnostics = readSceneArray(input.scene, "nexus:compatDiagnostics");
  const vertexSkinning = readSceneArray(input.scene, "mmd:vertexSkinning");
  const impulseMorphs = readSceneArray(input.scene, "mmd:impulseMorphs");
  const softBodies = readSceneArray(input.scene, "mmd:softBodies");
  const morphFrames = readSceneArray(input.scene, "mmd:morphFrames");
  const cameraFrames = readSceneArray(input.scene, "mmd:cameraFrames");
  const lightFrames = readSceneArray(input.scene, "mmd:lightFrames");
  const checks: CompatibilityCheckResult[] = [];

  const qdefVertices = vertexSkinning.filter((entry) => Number(entry.skinningType ?? 0) === 4).length;
  const qdefDiagnostics =
    qdefVertices > 0 && input.targetFormat !== "pmx"
      ? [
          createCompatibilityDiagnostic(
            input.profile,
            "pmx-skinning",
            "PMX_QDEF_FALLBACK",
            `Target ${input.targetFormat} cannot preserve ${qdefVertices} QDEF-authored vertices exactly.`,
            "warning",
            { count: qdefVertices, targetFormat: input.targetFormat },
          ),
        ]
      : [];
  checks.push(createOutcomeCheck(input.profile, "pmx-skinning", qdefDiagnostics.length > 0 ? "degraded" : "exact", qdefDiagnostics));

  const impulseDiagnostics =
    impulseMorphs.length > 0 && input.targetFormat !== "pmx"
      ? [
          createCompatibilityDiagnostic(
            input.profile,
            "pmx-morphs",
            "PMX_IMPULSE_MORPH_FALLBACK",
            `Target ${input.targetFormat} normalizes or drops ${impulseMorphs.length} impulse morph entries.`,
            "warning",
            { count: impulseMorphs.length, targetFormat: input.targetFormat },
          ),
        ]
      : [];
  checks.push(createOutcomeCheck(input.profile, "pmx-morphs", impulseDiagnostics.length > 0 ? "degraded" : "exact", impulseDiagnostics));

  const physicsDiagnostics =
    softBodies.length > 0 && input.targetFormat !== "pmx"
      ? [
          createCompatibilityDiagnostic(
            input.profile,
            "pmx-physics-export",
            "PMX_SOFT_BODY_NORMALIZED",
            `Target ${input.targetFormat} does not keep ${softBodies.length} PMX soft-body blocks as first-class data.`,
            "warning",
            { count: softBodies.length, targetFormat: input.targetFormat },
          ),
        ]
      : [];
  checks.push(createOutcomeCheck(input.profile, "pmx-physics-export", physicsDiagnostics.length > 0 ? "degraded" : "exact", physicsDiagnostics));

  const driftDiagnostics = diagnostics
    .filter((entry) => String(entry.capability ?? "") === "vmd-interpolation")
    .map((entry) =>
      createCompatibilityDiagnostic(
        input.profile,
        "vmd-interpolation",
        String(entry.code ?? "VMD_FRAME_DRIFT"),
        String(entry.message ?? "VMD frame timing drift detected."),
        "warning",
        entry.details,
      ),
    );
  const hasTimingData = morphFrames.length > 0 || cameraFrames.length > 0 || lightFrames.length > 0;
  checks.push(
    createOutcomeCheck(
      input.profile,
      "vmd-interpolation",
      driftDiagnostics.length > 0 ? "degraded" : hasTimingData ? "exact" : "normalized",
      driftDiagnostics,
    ),
  );

  const bvhInvolved = input.profile === "bvh" || input.sourceFormat === "bvh" || input.targetFormat === "bvh";
  if (bvhInvolved) {
    const bvhLayout = readSceneArray(input.scene, "bvh:jointChannelLayout");
    const bvhDrift = analyzeBvhFrameDrift(input.scene);
    const bvhAnimationDiagnostics = [
      ...bvhDrift.diagnostics,
      ...diagnostics
        .filter((entry) => String(entry.capability ?? "") === "bvh-animation-fidelity")
        .map((entry) =>
          createCompatibilityDiagnostic(
            input.profile,
            "bvh-animation-fidelity",
            String(entry.code ?? "BVH_FRAME_DRIFT"),
            String(entry.message ?? "BVH animation drift detected."),
            "warning",
            entry.details,
          ),
        ),
    ];

    let skeletonOutcome: CompatibilityCheckResult["outcome"] = "exact";
    const skeletonDiagnostics: CompatibilityDiagnostic[] = [];
    if (input.sourceFormat === "bvh" && input.targetFormat === "fbx") {
      skeletonOutcome = "normalized";
      skeletonDiagnostics.push(
        createCompatibilityDiagnostic(
          input.profile,
          "bvh-skeleton-motion",
          "BVH_TO_FBX_CHANNEL_LAYOUT_NORMALIZED",
          "BVH channel layout is normalized when exported into FBX transform curves.",
          "warning",
        ),
      );
    } else if (input.sourceFormat === "fbx" && input.targetFormat === "bvh") {
      skeletonOutcome = "normalized";
      skeletonDiagnostics.push(
        createCompatibilityDiagnostic(
          input.profile,
          "bvh-skeleton-motion",
          "FBX_TO_BVH_SKELETON_NORMALIZED",
          "FBX skeleton transforms are flattened into canonical BVH hierarchy and channel layout.",
          "warning",
        ),
      );
    } else if (input.sourceFormat === "bvh" && (input.targetFormat === "pmx" || input.targetFormat === "vmd")) {
      skeletonOutcome = "degraded";
      skeletonDiagnostics.push(
        createCompatibilityDiagnostic(
          input.profile,
          "bvh-skeleton-motion",
          "BVH_SKELETON_DEGRADED",
          `Target ${input.targetFormat} cannot preserve BVH hierarchy and channel layout exactly.`,
          "warning",
          { targetFormat: input.targetFormat },
        ),
      );
    } else if (input.targetFormat === "bvh" && bvhLayout.length === 0) {
      skeletonOutcome = "normalized";
      skeletonDiagnostics.push(
        createCompatibilityDiagnostic(
          input.profile,
          "bvh-skeleton-motion",
          "BVH_CANONICAL_LAYOUT",
          "BVH export falls back to canonical channel layout because original BVH metadata is absent.",
          "warning",
        ),
      );
    }
    checks.push(createOutcomeCheck(input.profile, "bvh-skeleton-motion", skeletonOutcome, skeletonDiagnostics));

    let animationOutcome: CompatibilityCheckResult["outcome"] = bvhAnimationDiagnostics.length > 0 ? "degraded" : "exact";
    if (animationOutcome === "exact" && input.sourceFormat === "bvh" && input.targetFormat === "fbx") {
      animationOutcome = "normalized";
      bvhAnimationDiagnostics.push(
        createCompatibilityDiagnostic(
          input.profile,
          "bvh-animation-fidelity",
          "BVH_TO_FBX_TIMING_NORMALIZED",
          "BVH frame-based timing is normalized into FBX curve time while preserving authored cadence metadata.",
          "warning",
        ),
      );
    } else if (animationOutcome === "exact" && input.sourceFormat === "fbx" && input.targetFormat === "bvh") {
      animationOutcome = "normalized";
      bvhAnimationDiagnostics.push(
        createCompatibilityDiagnostic(
          input.profile,
          "bvh-animation-fidelity",
          "FBX_TO_BVH_TIMING_NORMALIZED",
          "FBX animation keys are resampled into BVH frame timing.",
          "warning",
        ),
      );
    } else if (animationOutcome === "exact" && input.sourceFormat === "bvh" && input.targetFormat === "pmx") {
      animationOutcome = "degraded";
      bvhAnimationDiagnostics.push(
        createCompatibilityDiagnostic(
          input.profile,
          "bvh-animation-fidelity",
          "BVH_TO_PMX_ANIMATION_DEGRADED",
          "PMX targets do not preserve standalone BVH animation semantics exactly.",
          "warning",
        ),
      );
    } else if (animationOutcome === "exact" && input.sourceFormat === "bvh" && input.targetFormat === "vmd") {
      animationOutcome = "normalized";
      bvhAnimationDiagnostics.push(
        createCompatibilityDiagnostic(
          input.profile,
          "bvh-animation-fidelity",
          "BVH_TO_VMD_TIMING_NORMALIZED",
          "BVH animation is mapped into VMD frame channels with normalized rotation conventions.",
          "warning",
        ),
      );
    }
    checks.push(createOutcomeCheck(input.profile, "bvh-animation-fidelity", animationOutcome, bvhAnimationDiagnostics));

    const workflowOutcome =
      skeletonOutcome === "degraded" || animationOutcome === "degraded"
        ? "degraded"
        : skeletonOutcome === "normalized" || animationOutcome === "normalized"
          ? "normalized"
          : "exact";
    checks.push(createOutcomeCheck(input.profile, "bvh-conversion-workflow", workflowOutcome));
  }

  return createCompatibilityReport({
    profile: input.profile,
    sourceFormat: input.sourceFormat,
    targetFormat: input.targetFormat,
    checks,
  });
}

