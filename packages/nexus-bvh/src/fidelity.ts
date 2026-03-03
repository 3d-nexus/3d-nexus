import { createCompatibilityDiagnostic, type AiAnimation, type AiScene, type CompatibilityDiagnostic } from "nexus-core";

export type BvhFrameDriftSummary = {
  maxFrameDrift: number;
  affectedChannels: string[];
  diagnostics: CompatibilityDiagnostic[];
};

function collectAnimatedTimes(animation: AiAnimation): Array<{ nodeName: string; time: number }> {
  return animation.channels.flatMap((channel) => [
    ...channel.positionKeys.map((key) => ({ nodeName: channel.nodeName, time: key.time })),
    ...channel.rotationKeys.map((key) => ({ nodeName: channel.nodeName, time: key.time })),
  ]);
}

export function analyzeBvhFrameDrift(scene: AiScene): BvhFrameDriftSummary {
  const animation = scene.animations[0];
  if (!animation) {
    return { maxFrameDrift: 0, affectedChannels: [], diagnostics: [] };
  }

  const entries = collectAnimatedTimes(animation)
    .map((entry) => ({
      ...entry,
      drift: Math.abs(entry.time - Math.round(entry.time)),
    }))
    .filter((entry) => entry.drift > 1e-6);

  if (entries.length === 0) {
    return { maxFrameDrift: 0, affectedChannels: [], diagnostics: [] };
  }

  const maxFrameDrift = entries.reduce((max, entry) => Math.max(max, entry.drift), 0);
  const affectedChannels = Array.from(new Set(entries.map((entry) => entry.nodeName)));

  return {
    maxFrameDrift,
    affectedChannels,
    diagnostics: [
      createCompatibilityDiagnostic(
        "bvh",
        "bvh-animation-fidelity",
        "BVH_FRAME_DRIFT",
        `BVH animation keys drift up to ${maxFrameDrift.toFixed(6)} frames from integer frame indices.`,
        "warning",
        {
          maxFrameDrift,
          affectedChannels,
        },
      ),
    ],
  };
}
