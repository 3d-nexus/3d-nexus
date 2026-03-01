import { describe, expect, it } from "vitest";
import { createIdentityMatrix4x4, type AiScene } from "nexus-core";
import { MMDPmxExporter } from "../MMDPmxExporter";
import { MMDPmxParser } from "../MMDPmxParser";

function createScene(): AiScene {
  return {
    flags: 0 as never,
    rootNode: {
      name: "MultiMeshRoot",
      transformation: createIdentityMatrix4x4(),
      parent: null,
      children: [],
      meshIndices: [0, 1],
      metadata: null,
    },
    meshes: [
      {
        name: "MeshA",
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
        bones: [],
        materialIndex: 0,
        morphTargets: [],
        aabb: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 0 } },
      },
      {
        name: "MeshB",
        primitiveTypes: 4 as never,
        vertices: [
          { x: 0, y: 0, z: 1 },
          { x: 1, y: 0, z: 1 },
          { x: 0, y: 1, z: 1 },
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
        materialIndex: 1,
        morphTargets: [],
        aabb: { min: { x: 0, y: 0, z: 1 }, max: { x: 1, y: 1, z: 1 } },
      },
    ],
    materials: [
      {
        name: "MatA",
        properties: [
          { key: "$clr.diffuse", semantic: 1 as never, index: 0, type: 0 as never, data: { r: 1, g: 0, b: 0, a: 1 } },
          { key: "$clr.specular", semantic: 2 as never, index: 0, type: 0 as never, data: { r: 0.4, g: 0.4, b: 0.4, a: 1 } },
          { key: "$clr.ambient", semantic: 3 as never, index: 0, type: 0 as never, data: { r: 0.1, g: 0.1, b: 0.1, a: 1 } },
          { key: "$tex.file", semantic: 1 as never, index: 0, type: 2 as never, data: "shared.png" },
        ],
      },
      {
        name: "MatB",
        properties: [
          { key: "$clr.diffuse", semantic: 1 as never, index: 0, type: 0 as never, data: { r: 0, g: 1, b: 0, a: 1 } },
          { key: "$clr.specular", semantic: 2 as never, index: 0, type: 0 as never, data: { r: 0.3, g: 0.3, b: 0.3, a: 1 } },
          { key: "$clr.ambient", semantic: 3 as never, index: 0, type: 0 as never, data: { r: 0.2, g: 0.2, b: 0.2, a: 1 } },
          { key: "$tex.file", semantic: 1 as never, index: 0, type: 2 as never, data: "shared.png" },
        ],
      },
    ],
    animations: [],
    textures: [],
    lights: [],
    cameras: [],
    metadata: {},
  };
}

describe("PMX multi-mesh export", () => {
  it("concatenates vertices, writes one material per mesh, and deduplicates textures", () => {
    const buffer = new MMDPmxExporter().write(createScene());
    const document = new MMDPmxParser().parse(buffer);

    expect(document.vertices).toHaveLength(6);
    expect(document.materials).toHaveLength(2);
    expect(document.textures).toEqual(["shared.png"]);
  });
});
