import { describe, expect, it } from "vitest";
import {
  AiAnimBehaviour,
  AiMetadataType,
  AiPrimitiveType,
  createIdentityMatrix4x4,
  type AiScene,
} from "@3d-nexus/core";
import { FBXExporter } from "../FBXExporter";
import { FBXImporter } from "../FBXImporter";

function createScene(): AiScene {
  const bones = Array.from({ length: 5 }, (_, index) => ({
    name: `Bone${index}`,
    weights: [{ vertexId: 0, weight: 0.2 }],
    offsetMatrix: createIdentityMatrix4x4(),
    node: {
      name: `Bone${index}`,
      transformation: createIdentityMatrix4x4(),
      parent: null,
      children: [],
      meshIndices: [],
      metadata: {
        "fbx:skinCluster": {
          type: AiMetadataType.AISTRING,
          data: JSON.stringify({
            linkMode: "Additive",
            transformMatrix: Array.from(createIdentityMatrix4x4().data),
            transformLinkMatrix: Array.from(createIdentityMatrix4x4().data),
            skinningType: "DualQuaternion",
            deformAccuracy: 1,
          }),
        },
      },
    },
  }));

  return {
    flags: 0 as never,
    rootNode: {
      name: "Root",
      transformation: createIdentityMatrix4x4(),
      parent: null,
      children: [
        {
          name: "SkinnedMesh",
          transformation: createIdentityMatrix4x4(),
          parent: null,
          children: [],
          meshIndices: [0],
          metadata: null,
        },
      ],
      meshIndices: [],
      metadata: null,
    },
    meshes: [
      {
        name: "SkinnedMesh",
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
        bones,
        materialIndex: 0,
        morphTargets: [
          {
            name: "Blink",
            vertices: [
              { x: 0, y: 0.1, z: 0 },
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
            colors: Array.from({ length: 8 }, () => null),
            textureCoords: [[{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }], null, null, null, null, null, null, null],
            weight: 75,
          },
        ],
        aabb: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 0 } },
      },
    ],
    materials: [{ name: "Mat", properties: [] }],
    animations: [
      {
        name: "Take001",
        duration: 1,
        ticksPerSecond: 1,
        channels: [],
        meshChannels: [],
        morphMeshChannels: [{ name: "Blink", keys: [{ time: 0, values: [0], weights: [0] }, { time: 1, values: [0], weights: [1] }] }],
      },
    ],
    textures: [],
    lights: [],
    cameras: [],
    metadata: {
      "fbx:blendShapeChannels": {
        type: AiMetadataType.AISTRING,
        data: JSON.stringify([{ meshName: "SkinnedMesh", channelName: "Blink", deformPercent: 75, fullWeights: [75, 100] }]),
      },
    },
  };
}

describe("FBX skinning and blendshape fidelity", () => {
  it("preserves cluster metadata, blendshape channel settings, morph bindings, and influence diagnostics", () => {
    const scene = new FBXImporter().read(new FBXExporter().write(createScene()), "skinning-fidelity.fbx").scene;
    const diagnostics = JSON.parse(String(scene.metadata["nexus:compatDiagnostics"]?.data ?? "[]"));
    const blendShapeChannels = JSON.parse(String(scene.metadata["fbx:blendShapeChannels"]?.data ?? "[]"));
    const blendShapeAnimationCurves = JSON.parse(String(scene.metadata["fbx:blendShapeAnimationCurves"]?.data ?? "[]"));

    expect(scene.meshes[0]?.bones[0]?.node?.metadata?.["fbx:skinCluster"]).toBeDefined();
    expect(diagnostics.some((entry: { code?: string }) => entry.code === "FBX_RUNTIME_INFLUENCE_LIMIT")).toBe(true);
    expect(scene.meshes[0]?.morphTargets[0]?.weight).toBe(75);
    expect(blendShapeChannels[0]?.fullWeights?.[1]).toBe(100);
    expect(blendShapeAnimationCurves[0]?.objectName).toBe("Blink");
  });
});

