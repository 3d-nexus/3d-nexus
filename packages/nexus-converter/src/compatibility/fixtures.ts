import type { CompatibilityFixtureManifest } from "nexus-core";

export const BUILTIN_COMPATIBILITY_FIXTURES: CompatibilityFixtureManifest[] = [
  {
    id: "bvh-minimal-motion",
    profile: "bvh",
    label: "Baseline BVH skeleton motion round-trip",
    tool: "Canonical BVH",
    toolVersion: "1.0",
    sourceFormat: "bvh",
    fixturePath: "packages/nexus-bvh/fixtures/minimal.bvh",
    capabilities: ["bvh-skeleton-motion", "bvh-animation-fidelity", "bvh-conversion-workflow"],
    tags: ["baseline", "bvh"],
  },
  {
    id: "mmd-model-baseline",
    profile: "mmd",
    label: "Baseline PMX model round-trip",
    tool: "MikuMikuDance",
    toolVersion: "9.x",
    sourceFormat: "pmx",
    fixturePath: "packages/nexus-mmd/fixtures/model.pmx",
    capabilities: ["pmx-skinning", "pmx-morphs", "pmx-physics-export", "vmd-interpolation"],
    tags: ["baseline", "pmx"],
  },
  {
    id: "blender-fbx-pivot",
    profile: "blender-fbx",
    label: "Blender pivot and material baseline",
    tool: "Blender",
    toolVersion: "4.2",
    sourceFormat: "fbx",
    fixturePath: "packages/nexus-fbx/fixtures/blender-pivot.fbx",
    capabilities: ["fbx-coordinate-system", "fbx-transform-fidelity", "fbx-textures-materials"],
    tags: ["pivot", "material"],
  },
  {
    id: "maya-fbx-pivot",
    profile: "maya-fbx",
    label: "Maya pivot and rotation-order baseline",
    tool: "Maya",
    toolVersion: "2025",
    sourceFormat: "fbx",
    fixturePath: "packages/nexus-fbx/fixtures/maya-pivot.fbx",
    capabilities: ["fbx-coordinate-system", "fbx-transform-fidelity", "fbx-animation"],
    tags: ["pivot", "rotation-order"],
  },
  {
    id: "3dsmax-negative-scale",
    profile: "3dsmax-fbx",
    label: "3ds Max mirrored transform baseline",
    tool: "3ds Max",
    toolVersion: "2025",
    sourceFormat: "fbx",
    fixturePath: "packages/nexus-fbx/fixtures/max-negative-scale.fbx",
    capabilities: ["fbx-transform-fidelity", "fbx-coordinate-system"],
    tags: ["mirrored", "negative-scale"],
  },
  {
    id: "motionbuilder-animation",
    profile: "motionbuilder-fbx",
    label: "MotionBuilder animation baseline",
    tool: "MotionBuilder",
    toolVersion: "2024",
    sourceFormat: "fbx",
    fixturePath: "packages/nexus-fbx/fixtures/motionbuilder-animation.fbx",
    capabilities: ["fbx-animation", "fbx-skinning"],
    tags: ["animation"],
  },
  {
    id: "unity-runtime-material",
    profile: "unity",
    label: "Unity runtime material baseline",
    tool: "Unity",
    toolVersion: "6.0",
    sourceFormat: "fbx",
    fixturePath: "packages/nexus-fbx/fixtures/unity-material.fbx",
    capabilities: ["fbx-textures-materials", "fbx-skinning"],
    tags: ["runtime", "material"],
  },
  {
    id: "unreal-runtime-material",
    profile: "unreal",
    label: "Unreal runtime material baseline",
    tool: "Unreal Engine",
    toolVersion: "5.5",
    sourceFormat: "fbx",
    fixturePath: "packages/nexus-fbx/fixtures/unreal-material.fbx",
    capabilities: ["fbx-textures-materials", "fbx-animation"],
    tags: ["runtime", "material"],
  },
];

export function listBuiltInCompatibilityFixtures(): CompatibilityFixtureManifest[] {
  return BUILTIN_COMPATIBILITY_FIXTURES.map((entry) => {
    const next: CompatibilityFixtureManifest = {
      ...entry,
      capabilities: [...entry.capabilities],
    };
    if (entry.expectedDiagnostics) {
      next.expectedDiagnostics = [...entry.expectedDiagnostics];
    }
    if (entry.tags) {
      next.tags = [...entry.tags];
    }
    if (entry.tolerances) {
      next.tolerances = { ...entry.tolerances };
    }
    return next;
  });
}
