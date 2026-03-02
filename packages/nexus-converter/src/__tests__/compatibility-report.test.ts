import { describe, expect, it } from "vitest";
import { AiMetadataType, AiPrimitiveType, createIdentityMatrix4x4, type AiScene } from "nexus-core";
import { FBXExporter } from "nexus-fbx";
import { MMDExporter } from "nexus-mmd";
import { ModelConverter } from "../ModelConverter";
import { ModelFormat } from "../formats";

function createBaseScene(): AiScene {
  return {
    flags: 0 as never,
    rootNode: {
      name: "Root",
      transformation: createIdentityMatrix4x4(),
      parent: null,
      children: [],
      meshIndices: [0],
      metadata: null,
    },
    meshes: [
      {
        name: "Mesh",
        primitiveTypes: AiPrimitiveType.TRIANGLE,
        vertices: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
          { x: 0, y: 1, z: 0 },
        ],
        normals: [
          { x: 0, y: 1, z: 0 },
          { x: 0, y: 1, z: 0 },
          { x: 0, y: 1, z: 0 },
        ],
        tangents: [],
        bitangents: [],
        textureCoords: [[{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }], null, null, null, null, null, null, null],
        colors: Array.from({ length: 8 }, () => null),
        faces: [{ indices: [0, 1, 2] }],
        bones: [],
        materialIndex: 0,
        morphTargets: [],
        aabb: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 0 } },
      },
    ],
    materials: [{ name: "Material", properties: [] }],
    animations: [],
    textures: [],
    lights: [],
    cameras: [],
    metadata: {},
  };
}

describe("converter compatibility reports", () => {
  it("reports degraded PMX morph and physics capabilities for FBX targets", () => {
    const scene = createBaseScene();
    scene.meshes[0]!.bones = [
      { name: "Bone0", weights: [{ vertexId: 0, weight: 0.4 }], offsetMatrix: createIdentityMatrix4x4() },
      { name: "Bone1", weights: [{ vertexId: 0, weight: 0.3 }], offsetMatrix: createIdentityMatrix4x4() },
      { name: "Bone2", weights: [{ vertexId: 0, weight: 0.2 }], offsetMatrix: createIdentityMatrix4x4() },
      { name: "Bone3", weights: [{ vertexId: 0, weight: 0.1 }], offsetMatrix: createIdentityMatrix4x4() },
    ];
    scene.metadata["mmd:impulseMorphs"] = {
      type: AiMetadataType.AISTRING,
      data: JSON.stringify([{ name: "Impulse", entries: [{ rigidBodyIndex: 0, localFlag: 1, velocity: [1, 2, 3], torque: [4, 5, 6] }] }]),
    };
    scene.metadata["mmd:morphCatalog"] = {
      type: AiMetadataType.AISTRING,
      data: JSON.stringify([{ name: "Impulse", englishName: "Impulse", panel: 4, type: 10, order: 0, offsets: [{ rigidBodyIndex: 0, localFlag: 1, velocity: [1, 2, 3], torque: [4, 5, 6] }] }]),
    };
    scene.metadata["mmd:softBodies"] = {
      type: AiMetadataType.AISTRING,
      data: JSON.stringify([{ name: "Soft", englishName: "SoftEN" }]),
    };
    scene.metadata["mmd:vertexSkinning"] = {
      type: AiMetadataType.AISTRING,
      data: JSON.stringify([{ meshIndex: 0, vertexIndex: 0, skinningType: 4, skinning: { bones: [] } }]),
    };

    const input = new MMDExporter().write(scene, { format: "pmx" });
    const result = new ModelConverter().convertWithReport(input, ModelFormat.PMX, ModelFormat.FBX, {
      compatibilityProfile: "maya-fbx",
    });

    expect(result.report).toBeDefined();
    expect(result.report?.checks.find((entry) => entry.capability === "pmx-morphs")?.outcome).toBe("degraded");
    expect(result.report?.checks.find((entry) => entry.capability === "pmx-physics-export")?.outcome).toBe("degraded");
    expect(result.report?.checks.find((entry) => entry.capability === "pmx-skinning")?.outcome).toBe("degraded");
  });

  it("reports exact VMD timing when frames remain integer-aligned", () => {
    const scene = createBaseScene();
    scene.animations = [
      {
        name: "Anim",
        duration: 12,
        ticksPerSecond: 30,
        channels: [],
        meshChannels: [],
        morphMeshChannels: [{ name: "Blink", keys: [{ time: 12, values: [0], weights: [0.5] }] }],
      },
    ];
    scene.metadata["mmd:morphFrames"] = {
      type: AiMetadataType.AISTRING,
      data: JSON.stringify([{ name: "Blink", frame: 12, originalFrame: 12, weight: 0.5 }]),
    };
    scene.metadata["mmd:cameraFrames"] = {
      type: AiMetadataType.AISTRING,
      data: JSON.stringify([{ frame: 10, originalFrame: 10, distance: 30, position: [0, 1, 2], rotation: [0, 0, 0], interpolation: Array(24).fill(0), fov: 45, perspective: 0 }]),
    };

    const input = new MMDExporter().write(scene, { format: "vmd" });
    const result = new ModelConverter().convertWithReport(input, ModelFormat.VMD, ModelFormat.FBX, {
      compatibilityProfile: "motionbuilder-fbx",
    });

    expect(result.report?.checks.find((entry) => entry.capability === "vmd-interpolation")?.outcome).toBe("exact");
  });

  it("emits PMX-oriented compatibility output for FBX to PMX conversion", () => {
    const scene = createBaseScene();
    const input = new FBXExporter().write(scene, { format: "fbx" });
    const result = new ModelConverter().convertWithReport(input, ModelFormat.FBX, ModelFormat.PMX, {
      compatibilityProfile: "mmd",
    });

    expect(result.output.byteLength).toBeGreaterThan(0);
    expect(result.report?.checks.find((entry) => entry.capability === "pmx-morphs")?.outcome).toBe("exact");
    expect(result.report?.targetFormat).toBe("pmx");
  });
});
