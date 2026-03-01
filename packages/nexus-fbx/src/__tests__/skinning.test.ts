import { describe, expect, it } from "vitest";
import { createIdentityMatrix4x4, type AiScene } from "nexus-core";
import { FBXExporter } from "../FBXExporter";
import { FBXImporter } from "../FBXImporter";

function createScene(): AiScene {
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
        name: "SkinnedMesh",
        primitiveTypes: 4 as never,
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
        bones: [
          {
            name: "BoneA",
            weights: [
              { vertexId: 0, weight: 1 },
              { vertexId: 1, weight: 0.5 },
            ],
            offsetMatrix: createIdentityMatrix4x4(),
          },
          {
            name: "BoneB",
            weights: [
              { vertexId: 1, weight: 0.5 },
              { vertexId: 2, weight: 1 },
            ],
            offsetMatrix: createIdentityMatrix4x4(),
          },
        ],
        materialIndex: 0,
        morphTargets: [],
        aabb: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 0 } },
      },
    ],
    materials: [{ name: "Mat", properties: [] }],
    animations: [],
    textures: [],
    lights: [],
    cameras: [],
    metadata: {},
  };
}

describe("FBX skinning", () => {
  it("imports exported skin clusters as bones", () => {
    const buffer = new FBXExporter().write(createScene());
    const scene = new FBXImporter().read(buffer, "skinned.fbx").scene;

    expect(scene.meshes[0]?.bones.length).toBeGreaterThan(0);
    expect(scene.meshes[0]?.bones[0]?.weights.length).toBeGreaterThan(0);
  });
});
