import { describe, expect, it } from "vitest";
import { createIdentityMatrix4x4, type AiScene } from "nexus-core";
import { FBXExporter } from "../FBXExporter";

function createScene(): AiScene {
  return {
    flags: 0 as never,
    rootNode: {
      name: "Root",
      transformation: createIdentityMatrix4x4(),
      parent: null,
      children: [],
      meshIndices: [0, 1, 2],
      metadata: null,
    },
    meshes: Array.from({ length: 3 }, (_, index) => ({
      name: `Mesh_${index}`,
      primitiveTypes: 4 as never,
      vertices: [
        { x: 0, y: 0, z: index },
        { x: 1, y: 0, z: index },
        { x: 0, y: 1, z: index },
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
      materialIndex: index === 2 ? 1 : 0,
      morphTargets: [],
      aabb: { min: { x: 0, y: 0, z: index }, max: { x: 1, y: 1, z: index } },
    })),
    materials: [
      { name: "Shared", properties: [] },
      { name: "Unique", properties: [] },
    ],
    animations: [],
    textures: [],
    lights: [],
    cameras: [],
    metadata: {},
  };
}

describe("FBX multi-mesh export", () => {
  it("writes one geometry and model per mesh, deduplicating materials", () => {
    const output = new TextDecoder().decode(new FBXExporter().write(createScene()));

    expect(output.match(/^\s*Geometry:/gm)).toHaveLength(3);
    expect(output.match(/^\s*Model:/gm)).toHaveLength(4);
    expect(output.match(/^\s*Material:/gm)).toHaveLength(2);
  });
});
